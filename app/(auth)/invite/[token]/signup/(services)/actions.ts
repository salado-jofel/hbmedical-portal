"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { InviteSignUpState } from "@/utils/interfaces/invite";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  validateInviteToken,
  consumeInviteToken,
} from "@/app/(dashboard)/dashboard/(services)/invite-tokens/actions";
import { addFacilityMember } from "@/app/(dashboard)/dashboard/(services)/facility-members/actions";
import { formatMessage } from "@/utils/helpers/signup";
import type { InviteTokenRole } from "@/utils/interfaces/invite-tokens";
import {
  stampContractPdf,
  signedContractPath,
  previewContractPath,
  CONTRACT_SOURCES,
  MERIDIAN_SIGNER,
  type ContractType,
} from "@/lib/pdf/sign-contract";
import { sendProviderContractsSignedEmail } from "@/lib/emails/send-provider-contracts-signed";

const initialInviteSignUpState: InviteSignUpState = { error: null };

function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 8) return `+${digits}`;
  return `+1${digits.padEnd(10, "0")}`;
}

function friendlyDbError(error: { code?: string; message?: string }, fallback: string): string {
  if (error.code === "23514") return "Please enter a valid phone number (e.g. +16155550123).";
  return fallback;
}

export async function inviteSignUp(
  token: string,
  _prevState: InviteSignUpState,
  formData: FormData,
): Promise<InviteSignUpState> {
  console.log("[inviteSignUp] formData:", Object.fromEntries(formData));

  let createdUserId: string | null = null;
  let createdFacilityId: string | null = null;

  try {
    // Re-validate token at submission time
    const inviteToken = await validateInviteToken(token);
    if (!inviteToken) {
      return { error: "This invite link is no longer valid." };
    }

    const firstName = (formData.get("first_name") as string)?.trim();
    const lastName = (formData.get("last_name") as string)?.trim();
    // Always prefer the email captured on the invite token — it's the source of
    // truth (admin entered it when the invite was issued). Fall back to the
    // submitted email only for legacy tokens without invited_email set.
    const tokenEmail = inviteToken.invited_email?.trim().toLowerCase();
    const submittedEmail = (formData.get("email") as string)?.trim().toLowerCase();
    const email = tokenEmail || submittedEmail;
    const phone = toE164((formData.get("phone") as string) ?? "");
    const password = (formData.get("password") as string)?.trim();
    const agreed = formData.get("agreed") === "true";

    if (!firstName || !lastName) return { error: "Name is required." };
    if (!email) return { error: "Email is required." };
    if (!password || password.length < 8)
      return { error: "Password must be at least 8 characters." };
    if (!agreed) return { error: "You must accept the terms to continue." };

    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();

    // Create auth user.
    // emailRedirectTo controls where Supabase's confirmation-email link lands
    // after the user clicks it. We route to /sign-in so they're dropped right
    // at the login page instead of the marketing site (the project's default
    // Site URL). This URL must be in Authentication → URL Configuration →
    // Redirect URLs on the Supabase dashboard (wildcarded /** on all envs).
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      "http://localhost:3000";
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${appUrl}/sign-in`,
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`.trim(),
          role: inviteToken.role_type,
          phone,
        },
      },
    });

    if (authError) {
      return { error: formatMessage(authError.message) };
    }

    if (!authData.user) {
      return { error: "Failed to create account." };
    }

    createdUserId = authData.user.id;

    // Insert profile
    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: createdUserId,
      email,
      first_name: firstName,
      last_name: lastName,
      phone: phone || null,
      role: inviteToken.role_type,
    });

    if (profileError) {
      console.error("[inviteSignUp] Profile insert error:", JSON.stringify(profileError));
      await supabaseAdmin.auth.admin.deleteUser(createdUserId);
      return { error: friendlyDbError(profileError, "Failed to create account. Please try again.") };
    }

    // ── CASE B — Sales representative (sub-rep) ───────────────────────────────
    if (inviteToken.role_type === "sales_representative") {
      // Record the parent-child rep relationship
      const { error: hierarchyError } = await supabaseAdmin
        .from("rep_hierarchy")
        .insert({
          parent_rep_id: inviteToken.created_by,
          child_rep_id: createdUserId,
        });

      if (hierarchyError) {
        console.error("[inviteSignUp] rep_hierarchy error:", JSON.stringify(hierarchyError));
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
        return { error: "Failed to link rep hierarchy. Please try again." };
      }

      // Sub-reps need to set up their own practice after sign-in
      await supabaseAdmin
        .from("profiles")
        .update({ has_completed_setup: false })
        .eq("id", createdUserId);

      await consumeInviteToken(token, createdUserId);
    } else {
      // ── Clinical roles (clinical_provider or clinical_staff) ──────────────

      // Step 1 — PIN + NPI credentials for clinical_provider
      if (inviteToken.role_type === "clinical_provider") {
        const pin = (formData.get("pin") as string)?.trim();
        const npiNumber = (formData.get("npi_number") as string)?.trim();
        const credential = (formData.get("credential") as string)?.trim() || null;
        if (!pin || !/^\d{4,6}$/.test(pin)) {
          await supabaseAdmin.auth.admin.deleteUser(createdUserId);
          return { error: "A valid 4–6 digit PIN is required for clinical providers." };
        }
        if (!npiNumber || !/^\d{10}$/.test(npiNumber)) {
          await supabaseAdmin.auth.admin.deleteUser(createdUserId);
          return { error: "NPI must be exactly 10 digits." };
        }
        const { data: hashResult, error: hashError } = await supabaseAdmin.rpc("hash_pin", { input_pin: pin });
        if (hashError || !hashResult) {
          await supabaseAdmin.auth.admin.deleteUser(createdUserId);
          return { error: "Failed to hash PIN." };
        }
        const pinHash = hashResult as string;
        const now = new Date().toISOString();
        const { error: credError } = await supabaseAdmin
          .from("provider_credentials")
          .insert({
            user_id: createdUserId,
            pin_hash: pinHash,
            npi_number: npiNumber,
            credential: credential,
            baa_signed_at: now,
            terms_signed_at: now,
          });
        if (credError) {
          console.error("[inviteSignUp] provider_credentials error:", JSON.stringify(credError));
          await supabaseAdmin.auth.admin.deleteUser(createdUserId);
          return { error: credError.message ?? "Failed to save provider credentials." };
        }
      }

      if (inviteToken.role_type === "clinical_provider") {
        // ── CASE C / CASE D — clinical_provider ALWAYS creates their own clinic ──
        //
        // CASE C: rep invited (facility_id = null) → assigned_rep = token.created_by
        // CASE D: admin invited (facility_id = rep's facility) → look up rep via facility
        let assignedRepId: string | null = null;

        if (inviteToken.facility_id) {
          // CASE D: admin-invited — resolve the rep who owns the selected facility
          const { data: repFacility, error: repFacErr } = await supabaseAdmin
            .from("facilities")
            .select("user_id")
            .eq("id", inviteToken.facility_id)
            .single();
          if (repFacErr || !repFacility) {
            console.error("[inviteSignUp] Failed to resolve rep facility:", repFacErr);
            await supabaseAdmin.auth.admin.deleteUser(createdUserId);
            return { error: "Failed to resolve assigned rep. Please try again." };
          }
          assignedRepId = repFacility.user_id;
        } else {
          // CASE C: rep-invited — the token creator is the rep
          assignedRepId = inviteToken.created_by;
        }

        const officeName = (formData.get("office_name") as string)?.trim();
        const officePhone = toE164((formData.get("office_phone") as string) ?? "");
        const officeAddress = (formData.get("office_address") as string)?.trim();
        const officeCity = (formData.get("office_city") as string)?.trim();
        const officeState = (formData.get("office_state") as string)?.trim();
        const officePostalCode = (formData.get("office_postal_code") as string)?.trim();

        // Idempotency: check if clinic already exists for this user (double-submit protection)
        const { data: existingClinic } = await supabaseAdmin
          .from("facilities")
          .select("id")
          .eq("user_id", createdUserId)
          .maybeSingle();

        let clinicId: string;

        if (existingClinic?.id) {
          clinicId = existingClinic.id;
        } else {
          const { data: newFacility, error: facilityError } = await supabaseAdmin
            .from("facilities")
            .insert({
              user_id: createdUserId,
              name: officeName || `${firstName} ${lastName}'s Practice`,
              contact: `${firstName} ${lastName}`,
              phone: officePhone || phone,
              address_line_1: officeAddress || "",
              city: officeCity || "",
              state: officeState || "",
              postal_code: officePostalCode || "",
              country: "US",
              status: "active",
              facility_type: "clinic",
              assigned_rep: assignedRepId,
            })
            .select("id")
            .single();

          if (facilityError) {
            console.error("[inviteSignUp] Facility creation error:", JSON.stringify(facilityError));
            await supabaseAdmin.auth.admin.deleteUser(createdUserId);
            return { error: friendlyDbError(facilityError, "Failed to create facility. Please check your information.") };
          }

          clinicId = newFacility.id;
        }

        createdFacilityId = clinicId;
        await addFacilityMember(clinicId, createdUserId, "clinical_provider", {
          isPrimary: true,
          invitedBy: inviteToken.created_by,
        });

        // Insert facility_enrollment — all fields optional. Dropped fields
        // (facility_tin, *_fax, shipping_days_times, shipping2_*, claims_*)
        // stay NULL on new rows; the DB columns remain for backward
        // compatibility with existing production data.
        const { error: enrollError } = await supabaseAdmin
          .from("facility_enrollment")
          .insert({
            facility_id: clinicId,
            facility_npi:               (formData.get("facility_npi") as string)?.trim() || null,
            facility_ein:               (formData.get("facility_ein") as string)?.trim() || null,
            facility_ptan:              (formData.get("facility_ptan") as string)?.trim() || null,
            medicare_mac:               (formData.get("medicare_mac") as string)?.trim() || null,
            ap_contact_name:            (formData.get("ap_contact_name") as string)?.trim() || null,
            ap_contact_email:           (formData.get("ap_contact_email") as string)?.trim() || null,
            billing_address:            (formData.get("billing_address") as string)?.trim() || null,
            billing_city:               (formData.get("billing_city") as string)?.trim() || null,
            billing_state:              (formData.get("billing_state") as string)?.trim() || null,
            billing_zip:                (formData.get("billing_zip") as string)?.trim() || null,
            billing_phone:              (formData.get("billing_phone") as string)?.trim() || null,
            dpa_contact:                (formData.get("dpa_contact") as string)?.trim() || null,
            dpa_contact_email:          (formData.get("dpa_contact_email") as string)?.trim() || null,
            additional_provider_1_name: (formData.get("additional_provider_1_name") as string)?.trim() || null,
            additional_provider_1_npi:  (formData.get("additional_provider_1_npi") as string)?.trim() || null,
            additional_provider_2_name: (formData.get("additional_provider_2_name") as string)?.trim() || null,
            additional_provider_2_npi:  (formData.get("additional_provider_2_npi") as string)?.trim() || null,
            shipping_facility_name:     (formData.get("shipping_facility_name") as string)?.trim() || null,
            shipping_facility_npi:      (formData.get("shipping_facility_npi") as string)?.trim() || null,
            shipping_facility_ptan:     (formData.get("shipping_facility_ptan") as string)?.trim() || null,
            shipping_contact_name:      (formData.get("shipping_contact_name") as string)?.trim() || null,
            shipping_contact_email:     (formData.get("shipping_contact_email") as string)?.trim() || null,
            shipping_address:           (formData.get("shipping_address") as string)?.trim() || null,
            shipping_phone:             (formData.get("shipping_phone") as string)?.trim() || null,
            completed_at:               new Date().toISOString(),
          });

        if (enrollError) {
          console.error("[inviteSignUp] facility_enrollment error:", JSON.stringify(enrollError));
          await supabaseAdmin.from("facilities").delete().eq("id", clinicId);
          await supabaseAdmin.auth.admin.deleteUser(createdUserId);
          return { error: "Failed to save enrollment data. Please try again." };
        }

        await supabaseAdmin
          .from("profiles")
          .update({ has_completed_setup: true })
          .eq("id", createdUserId);

      } else if (inviteToken.facility_id) {
        // ── CASE A — clinical_staff joins an existing facility ─────────────────
        const { error: memberError } = await supabaseAdmin
          .from("facility_members")
          .insert({
            facility_id: inviteToken.facility_id,
            user_id: createdUserId,
            role_type: inviteToken.role_type,
            can_sign_orders: false,
            is_primary: false,
            invited_by: inviteToken.created_by,
          });

        if (memberError) {
          console.error("[inviteSignUp] facility_members error:", JSON.stringify(memberError));
          await supabaseAdmin.auth.admin.deleteUser(createdUserId);
          return { error: "Failed to link to facility. Please try again." };
        }

        await supabaseAdmin
          .from("profiles")
          .update({ has_completed_setup: true })
          .eq("id", createdUserId);

      } else {
        // Edge case: clinical_staff with no facility_id (should not happen after fixes)
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
        return { error: "Invalid invite: no facility assigned. Please contact your rep." };
      }

      await consumeInviteToken(token, createdUserId);

      // Adopt any contract signatures that were captured under this invite
      // token (signed before the auth user existed). One row per contract type.
      if (inviteToken.role_type === "clinical_provider") {
        const { error: adoptErr } = await supabaseAdmin
          .from("provider_contract_signatures")
          .update({ user_id: createdUserId })
          .eq("invite_token", token)
          .is("user_id", null);
        if (adoptErr) {
          console.error(
            "[inviteSignUp] provider_contract_signatures adopt error:",
            JSON.stringify(adoptErr),
          );
          // Non-fatal — signatures remain keyed by invite_token for audit.
        }

        // Fire-and-forget: email the signed contracts to internal recipients.
        // Failures are logged; account creation is already committed so we
        // never block the redirect on email.
        const providerEmail = authData.user.email ?? "";
        const providerName = `${firstName} ${lastName}`.trim();
        const clinicNameRaw = (formData.get("office_name") as string | null)?.trim() || null;
        emailSignedContractsToStaff({
          token,
          providerName,
          providerEmail,
          clinicName: clinicNameRaw,
        }).catch((err) =>
          console.error("[inviteSignUp] contracts email error:", err),
        );
      }
    }

    // Pick the right landing page:
    //   - email_confirmed_at is null → Supabase sent a verification email; user
    //     must see the "Check your email" page and click the link to confirm.
    //   - email_confirmed_at is set → the "Confirm email" toggle is OFF in auth
    //     settings, so Supabase auto-confirmed on signUp. Skip /verify-email
    //     and drop the user straight into the dashboard.
    var emailAlreadyConfirmed = Boolean(authData.user.email_confirmed_at);
  } catch (err) {
    if (createdFacilityId) {
      try {
        const supabaseAdmin = createAdminClient();
        await supabaseAdmin.from("facilities").delete().eq("id", createdFacilityId);
      } catch {
        // noop
      }
    }
    if (createdUserId) {
      try {
        const supabaseAdmin = createAdminClient();
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
      } catch {
        // noop
      }
    }
    return {
      error:
        err instanceof Error
          ? err.message
          : "Unable to create account. Please try again.",
    };
  }

  redirect(emailAlreadyConfirmed ? "/dashboard" : "/verify-email");
}

/* ── Signed URLs for provider contract PDFs ── */

/**
 * Returns preview URLs for the BAA and Product & Services contracts with the
 * MERIDIAN block pre-stamped (Dr John Pienkos / CEO / today's date). The CLIENT
 * block stays blank until the user signs via ContractSignModal. Previews are
 * cached per-token at `provider-contracts-previews/{token}/*.pdf`.
 */
export async function getContractSignedUrls(token: string): Promise<{
  baaUrl: string | null;
  productServicesUrl: string | null;
  error: string | null;
}> {
  try {
    const adminClient = createAdminClient();
    const EXPIRES_IN = 3600;

    // Try to download Dr Pienkos's signature once; both previews reuse it.
    let meridianSigPng: Uint8Array | null = null;
    try {
      const { data: sigBlob } = await adminClient.storage
        .from(BUCKET)
        .download(MERIDIAN_SIGNER.signaturePath);
      if (sigBlob) {
        meridianSigPng = new Uint8Array(await sigBlob.arrayBuffer());
      }
    } catch {
      meridianSigPng = null;
    }

    const today = new Date();
    const buildPreview = async (contractType: ContractType): Promise<string | null> => {
      const source = CONTRACT_SOURCES[contractType];
      const { data: sourceBlob, error: sourceErr } = await adminClient.storage
        .from(BUCKET)
        .download(source.path);
      if (sourceErr || !sourceBlob) {
        console.error(
          `[getContractSignedUrls] source download failed for ${contractType}:`,
          sourceErr?.message,
        );
        return null;
      }
      const sourceBytes = new Uint8Array(await sourceBlob.arrayBuffer());
      const stamped = await stampContractPdf({
        sourcePdf: sourceBytes,
        contractType,
        meridian: {
          name: MERIDIAN_SIGNER.name,
          title: MERIDIAN_SIGNER.title,
          date: today,
          signaturePng: meridianSigPng,
        },
        // client omitted — leaves CLIENT block blank for the user to sign
      });
      const previewPath = previewContractPath(token, contractType);
      const { error: uploadErr } = await adminClient.storage
        .from(BUCKET)
        .upload(previewPath, stamped, {
          contentType: "application/pdf",
          upsert: true,
        });
      if (uploadErr) {
        console.error(
          `[getContractSignedUrls] upload failed for ${contractType}:`,
          uploadErr.message,
        );
        return null;
      }
      const { data: urlData } = await adminClient.storage
        .from(BUCKET)
        .createSignedUrl(previewPath, EXPIRES_IN);
      return urlData?.signedUrl ?? null;
    };

    const [baaUrl, productServicesUrl] = await Promise.all([
      buildPreview("baa"),
      buildPreview("product_services"),
    ]);

    if (!baaUrl || !productServicesUrl) {
      return {
        baaUrl,
        productServicesUrl,
        error: "Failed to load contract documents.",
      };
    }

    return { baaUrl, productServicesUrl, error: null };
  } catch (err) {
    console.error("[getContractSignedUrls] Unexpected:", err);
    return { baaUrl: null, productServicesUrl: null, error: "Failed to load contract documents." };
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  signContract — DocuSign-style inline signing during invite signup.        */
/* ────────────────────────────────────────────────────────────────────────── */

export interface SignContractInput {
  token: string;
  contractType: ContractType;
  typedName: string;
  typedTitle: string;
  signatureMethod: "type" | "draw" | "upload";
  /** data: URL from the signature canvas / typed renderer / uploaded image */
  signatureDataUrl: string;
}

export interface SignContractResult {
  success: boolean;
  signedUrl?: string;
  error?: string;
}

const BUCKET = "hbmedical-bucket-private";
const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024; // 2MB

function decodeDataUrl(dataUrl: string): Uint8Array | null {
  const match = /^data:image\/(png|jpeg|jpg);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  try {
    return Buffer.from(match[2], "base64");
  } catch {
    return null;
  }
}

export async function signContract(
  input: SignContractInput,
): Promise<SignContractResult> {
  try {
    const {
      token,
      contractType,
      typedName,
      typedTitle,
      signatureMethod,
      signatureDataUrl,
    } = input;

    if (!token || !typedName?.trim() || !typedTitle?.trim()) {
      return { success: false, error: "Name, title, and signature are required." };
    }

    if (!["baa", "product_services"].includes(contractType)) {
      return { success: false, error: "Invalid contract type." };
    }

    if (!["type", "draw", "upload"].includes(signatureMethod)) {
      return { success: false, error: "Invalid signature method." };
    }

    const inviteToken = await validateInviteToken(token);
    if (!inviteToken) {
      return { success: false, error: "This invite link is no longer valid." };
    }
    if (inviteToken.role_type !== "clinical_provider") {
      return { success: false, error: "Only provider invites can sign contracts." };
    }

    const signatureBytes = decodeDataUrl(signatureDataUrl);
    if (!signatureBytes) {
      return { success: false, error: "Invalid signature image." };
    }
    if (signatureBytes.length > MAX_SIGNATURE_BYTES) {
      return { success: false, error: "Signature image is too large (max 2 MB)." };
    }

    const admin = createAdminClient();
    const source = CONTRACT_SOURCES[contractType];

    // ── Fetch source PDF ──
    const { data: sourceBlob, error: sourceErr } = await admin.storage
      .from(BUCKET)
      .download(source.path);
    if (sourceErr || !sourceBlob) {
      console.error("[signContract] source download failed:", sourceErr?.message);
      return { success: false, error: "Failed to load contract template." };
    }
    const sourceBytes = new Uint8Array(await sourceBlob.arrayBuffer());

    // ── Optional: fetch Pienkos signature (swallow errors) ──
    let meridianSigPng: Uint8Array | null = null;
    try {
      const { data: sigBlob } = await admin.storage
        .from(BUCKET)
        .download(MERIDIAN_SIGNER.signaturePath);
      if (sigBlob) {
        meridianSigPng = new Uint8Array(await sigBlob.arrayBuffer());
      }
    } catch {
      meridianSigPng = null;
    }

    const today = new Date();

    // ── Stamp PDF ──
    const stamped = await stampContractPdf({
      sourcePdf: sourceBytes,
      contractType,
      client: {
        name: typedName.trim(),
        title: typedTitle.trim(),
        date: today,
        signaturePng: signatureBytes,
      },
      meridian: {
        name: MERIDIAN_SIGNER.name,
        title: MERIDIAN_SIGNER.title,
        date: today,
        signaturePng: meridianSigPng,
      },
    });

    // ── Upload signed PDF ──
    const signedPath = signedContractPath(token, contractType);
    const { error: uploadErr } = await admin.storage
      .from(BUCKET)
      .upload(signedPath, stamped, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (uploadErr) {
      console.error("[signContract] upload failed:", uploadErr.message);
      return { success: false, error: "Failed to save signed contract." };
    }

    // ── Audit metadata from request headers ──
    const h = await headers();
    const forwardedFor = h.get("x-forwarded-for") ?? "";
    const ipAddress = forwardedFor.split(",")[0]?.trim() || h.get("x-real-ip") || null;
    const userAgent = h.get("user-agent") || null;

    // ── Upsert signature row (unique on invite_token + contract_type) ──
    const { error: rowErr } = await admin
      .from("provider_contract_signatures")
      .upsert(
        {
          invite_token: token,
          contract_type: contractType,
          source_path: source.path,
          signed_path: signedPath,
          typed_name: typedName.trim(),
          typed_title: typedTitle.trim(),
          signature_method: signatureMethod,
          signed_at: today.toISOString(),
          ip_address: ipAddress,
          user_agent: userAgent,
        },
        { onConflict: "invite_token,contract_type" },
      );
    if (rowErr) {
      console.error("[signContract] row insert failed:", JSON.stringify(rowErr));
      return { success: false, error: "Failed to record signature." };
    }

    // ── Return a short-lived signed URL so the UI can show the result ──
    const { data: urlData } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(signedPath, 3600);

    return { success: true, signedUrl: urlData?.signedUrl };
  } catch (err) {
    console.error("[signContract] unexpected:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to sign contract.",
    };
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  emailSignedContractsToStaff — notify internal recipients with PDFs.       */
/* ────────────────────────────────────────────────────────────────────────── */

const SIGNED_CONTRACTS_NOTIFY_TO = [
  "ben@hbmedicalsupplies.io",
  "saladojofel@gmail.com",
  "screductions@gmail.com",
];

async function emailSignedContractsToStaff({
  token,
  providerName,
  providerEmail,
  clinicName,
}: {
  token: string;
  providerName: string;
  providerEmail: string;
  clinicName: string | null;
}): Promise<void> {
  const admin = createAdminClient();

  // Download both signed PDFs in parallel.
  const contracts: Array<{ type: ContractType; filename: string }> = [
    { type: "baa", filename: `BAA - ${providerName}.pdf` },
    { type: "product_services", filename: `Product & Services - ${providerName}.pdf` },
  ];

  const downloaded = await Promise.all(
    contracts.map(async (c) => {
      const path = signedContractPath(token, c.type);
      const { data, error } = await admin.storage.from(BUCKET).download(path);
      if (error || !data) {
        console.error(
          `[emailSignedContractsToStaff] download failed for ${c.type}:`,
          error?.message,
        );
        return null;
      }
      const buf = Buffer.from(await data.arrayBuffer());
      return { filename: c.filename, content: buf };
    }),
  );

  const attachments = downloaded.filter((a) => a !== null) as Array<{
    filename: string;
    content: Buffer;
  }>;

  if (attachments.length === 0) {
    console.error(
      "[emailSignedContractsToStaff] no signed PDFs available; skipping email",
    );
    return;
  }

  const { error: sendErr } = await sendProviderContractsSignedEmail({
    to: SIGNED_CONTRACTS_NOTIFY_TO,
    providerName,
    providerEmail,
    clinicName,
    signedAt: new Date(),
    attachments,
  });
  if (sendErr) {
    console.error("[emailSignedContractsToStaff] send error:", sendErr);
  }
}
