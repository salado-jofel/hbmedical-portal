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
  type ContractType,
  type ContractParagraphFields,
} from "@/lib/pdf/sign-contract";
import { sendProviderContractsSignedEmail } from "@/lib/emails/send-provider-contracts-signed";
import {
  SALES_REP_CONTRACTS,
  getContractDef,
  salesRepContractSignedPath,
  type SalesRepContractKey,
} from "@/lib/pdf/sales-rep-contracts";
import { stampSalesRepContract } from "@/lib/pdf/sign-sales-rep-contract";
import {
  isKnownContractTemplate,
  loadContractTemplate,
} from "@/lib/pdf/templates";
import { sendSalesRepContractsSignedEmail } from "@/lib/emails/send-sales-rep-contracts-signed";

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
      // Read the rep's account (rep_office) details captured in the office step.
      const officeName = (formData.get("office_name") as string)?.trim();
      const officePhone = toE164((formData.get("office_phone") as string) ?? "");
      const officeAddress = (formData.get("office_address") as string)?.trim();
      const officeCity = (formData.get("office_city") as string)?.trim();
      const officeState = (formData.get("office_state") as string)?.trim();
      const officePostalCode = (formData.get("office_postal_code") as string)?.trim();

      if (!officeName || !officeAddress || !officeCity || !officeState || !officePostalCode) {
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
        return { error: "Account name and full address are required." };
      }

      // Create the rep's account/office facility.
      const { error: facilityError } = await supabaseAdmin
        .from("facilities")
        .insert({
          user_id: createdUserId,
          name: officeName,
          contact: `${firstName} ${lastName}`.trim(),
          phone: officePhone,
          address_line_1: officeAddress,
          city: officeCity,
          state: officeState,
          postal_code: officePostalCode,
          country: "US",
          status: "active",
          facility_type: "rep_office",
        });

      if (facilityError) {
        console.error("[inviteSignUp] facilities insert error:", JSON.stringify(facilityError));
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
        return { error: "Failed to save account information. Please try again." };
      }

      // rep_hierarchy links a sub-rep to their parent rep. When the invite was
      // created by an admin (admin-onboarded main rep), there's no parent — skip.
      // When created by another sales_rep, link them as parent.
      const { data: creatorProfile } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", inviteToken.created_by)
        .maybeSingle();
      const creatorRole = (creatorProfile as { role?: string } | null)?.role ?? null;

      if (creatorRole === "sales_representative") {
        const { error: hierarchyError } = await supabaseAdmin
          .from("rep_hierarchy")
          .insert({
            parent_rep_id: inviteToken.created_by,
            child_rep_id: createdUserId,
            created_by: inviteToken.created_by,
          });

        if (hierarchyError) {
          console.error("[inviteSignUp] rep_hierarchy error:", JSON.stringify(hierarchyError));
          await supabaseAdmin.auth.admin.deleteUser(createdUserId);
          return { error: "Failed to link rep hierarchy. Please try again." };
        }
      }

      // Seed the commission_rates row from the invite (admin or parent rep
      // locked the values at invite time via CommissionSliders). Non-fatal —
      // if this insert fails the rep still gets an account; the setter can
      // manually adjust via the Commissions page.
      if (
        inviteToken.commission_rate != null &&
        inviteToken.commission_override != null
      ) {
        const todayISO = new Date().toISOString().slice(0, 10);
        const { error: rateError } = await supabaseAdmin
          .from("commission_rates")
          .insert({
            rep_id: createdUserId,
            set_by: inviteToken.created_by,
            rate_percent: inviteToken.commission_rate,
            override_percent: inviteToken.commission_override,
            effective_from: todayISO,
            effective_to: null,
          });
        if (rateError) {
          console.error(
            "[inviteSignUp] commission_rates insert error:",
            JSON.stringify(rateError),
          );
        }
      }

      // Account details captured inline — rep can skip /onboarding/setup.
      await supabaseAdmin
        .from("profiles")
        .update({ has_completed_setup: true })
        .eq("id", createdUserId);

      await consumeInviteToken(token, createdUserId);

      // Adopt any onboarding contract signatures captured under this invite
      // token (signed before the auth user existed). One row per contract type.
      const { error: adoptErr } = await supabaseAdmin
        .from("sales_rep_contract_signatures")
        .update({ user_id: createdUserId })
        .eq("invite_token", token)
        .is("user_id", null);
      if (adoptErr) {
        console.error(
          "[inviteSignUp] sales_rep_contract_signatures adopt error:",
          JSON.stringify(adoptErr),
        );
        // Non-fatal — signatures remain keyed by invite_token for audit.
      }

      // Fire-and-forget: email the signed contracts to internal recipients.
      // Account creation is already committed; never block redirect on email.
      const repEmail = authData.user.email ?? "";
      const repName = `${firstName} ${lastName}`.trim();
      const accountName =
        (formData.get("office_name") as string | null)?.trim() || null;
      emailSignedSalesRepContractsToStaff({
        token,
        repName,
        repEmail,
        accountName,
      }).catch((err) =>
        console.error("[inviteSignUp] sales-rep contracts email error:", err),
      );
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

    const today = new Date();
    const buildPreview = async (contractType: ContractType): Promise<string | null> => {
      const source = CONTRACT_SOURCES[contractType];
      let sourceBytes: Uint8Array;
      try {
        if (!isKnownContractTemplate(source.templateFile)) {
          console.error(
            `[getContractSignedUrls] unknown template for ${contractType}: ${source.templateFile}`,
          );
          return null;
        }
        sourceBytes = await loadContractTemplate(source.templateFile);
      } catch (err) {
        console.error(
          `[getContractSignedUrls] template load failed for ${contractType}:`,
          err,
        );
        return null;
      }
      const stamped = await stampContractPdf({
        sourcePdf: sourceBytes,
        contractType,
        meridianDate: today,
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
  /** BAA + PSA share the same 6 opening-paragraph field shape. Pre-filled
   *  client-side from the provider's signup state (officeName, officeAddress,
   *  etc.) plus today's date and the user-typed entity type. */
  paragraph?: ContractParagraphFields;
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

    // ── Load source PDF from lib/pdf/templates/ (not Supabase Storage — see
    //    lib/pdf/templates/index.ts) ──
    let sourceBytes: Uint8Array;
    try {
      if (!isKnownContractTemplate(source.templateFile)) {
        return { success: false, error: "Unknown contract template." };
      }
      sourceBytes = await loadContractTemplate(source.templateFile);
    } catch (err) {
      console.error("[signContract] template load failed:", err);
      return { success: false, error: "Failed to load contract template." };
    }

    const today = new Date();

    // ── Stamp PDF (Meridian name/title/signature already baked into template) ──
    const stamped = await stampContractPdf({
      sourcePdf: sourceBytes,
      contractType,
      client: {
        name: typedName.trim(),
        title: typedTitle.trim(),
        date: today,
        signaturePng: signatureBytes,
      },
      meridianDate: today,
      paragraph: input.paragraph,
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
          source_path: source.templateFile,
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

/* ────────────────────────────────────────────────────────────────────────── */
/*  Sales-rep onboarding contracts (6 documents)                              */
/* ────────────────────────────────────────────────────────────────────────── */

export interface SalesRepContractMeta {
  key: SalesRepContractKey;
  label: string;
  sourceUrl: string | null;
  signedUrl: string | null;
}

export async function getSalesRepContractUrls(
  token: string,
): Promise<{ contracts: SalesRepContractMeta[]; error: string | null }> {
  try {
    const admin = createAdminClient();
    const EXPIRES_IN = 3600;

    const contracts: SalesRepContractMeta[] = [];
    for (const def of SALES_REP_CONTRACTS) {
      // Source previews are now served by our own API route that reads from
      // lib/pdf/templates/. Token gates the route so the iframe URLs can't be
      // scraped by anyone without a live invite.
      const sourceUrl = `/api/contract-template/${def.templateFile}?token=${encodeURIComponent(token)}`;
      // Check if there's an already-signed copy for this token+contract
      const signedPath = salesRepContractSignedPath(token, def.key);
      const { data: signedList } = await admin.storage
        .from(BUCKET)
        .list(`sales-rep-contracts-signed/${token}`, { search: `${def.key}.pdf` });
      let signedUrl: string | null = null;
      if (signedList && signedList.some((f) => f.name === `${def.key}.pdf`)) {
        const { data } = await admin.storage
          .from(BUCKET)
          .createSignedUrl(signedPath, EXPIRES_IN);
        signedUrl = data?.signedUrl ?? null;
      }
      contracts.push({
        key: def.key,
        label: def.label,
        sourceUrl,
        signedUrl,
      });
    }
    return { contracts, error: null };
  } catch (err) {
    console.error("[getSalesRepContractUrls]", err);
    return { contracts: [], error: "Failed to load contract documents." };
  }
}

/* ─────────────────────────────────────────────────────────────────────────
 *  Upload a sales-rep contract attachment (e.g. I-9 List A/B/C document
 *  scans). Called from the sign modal before finalizing a signature so the
 *  file is in storage by the time `signSalesRepContract` fetches + merges it.
 * ───────────────────────────────────────────────────────────────────────── */

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_MIMES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);

export interface UploadAttachmentResult {
  success: boolean;
  path?: string;
  error?: string;
}

export async function uploadSalesRepContractAttachment(
  formData: FormData,
): Promise<UploadAttachmentResult> {
  try {
    const token = (formData.get("token") as string) ?? "";
    const contractKey = (formData.get("contractKey") as string) ?? "";
    const slot = (formData.get("slot") as string) ?? "";
    const file = formData.get("file") as File | null;

    if (!token || !contractKey || !slot || !file) {
      return { success: false, error: "Missing required upload fields." };
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return { success: false, error: "File exceeds 5 MB limit." };
    }
    if (!ALLOWED_ATTACHMENT_MIMES.has(file.type)) {
      return { success: false, error: "Unsupported file type. Use PDF, PNG, or JPG." };
    }

    const inviteToken = await validateInviteToken(token);
    if (!inviteToken) {
      return { success: false, error: "This invite link is no longer valid." };
    }
    if (inviteToken.role_type !== "sales_representative") {
      return { success: false, error: "Only sales-rep invites can upload attachments." };
    }

    const admin = createAdminClient();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    const path = `sales-rep-contract-uploads/${token}/${contractKey}/${Date.now()}-${slot}-${safeName}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error } = await admin.storage.from(BUCKET).upload(path, bytes, {
      contentType: file.type,
      upsert: false,
    });
    if (error) {
      console.error("[uploadSalesRepContractAttachment]", error.message);
      return { success: false, error: "Failed to upload attachment." };
    }
    return { success: true, path };
  } catch (err) {
    console.error("[uploadSalesRepContractAttachment] unexpected:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Upload failed.",
    };
  }
}

export interface SignSalesRepContractInput {
  token: string;
  contractKey: SalesRepContractKey;
  typedName: string;
  typedTitle?: string;
  signatureMethod: "type" | "draw" | "upload";
  signatureDataUrl: string;
  formData: Record<string, unknown>;
  /** Storage paths (inside BUCKET) of scanned document attachments to merge
   *  into the signed PDF. Populated by `uploadSalesRepContractAttachment`
   *  before this action is called. Currently only used by the I-9 flow. */
  attachmentPaths?: string[];
}

export interface SignSalesRepContractResult {
  success: boolean;
  signedUrl?: string;
  error?: string;
}

export async function signSalesRepContract(
  input: SignSalesRepContractInput,
): Promise<SignSalesRepContractResult> {
  try {
    const {
      token,
      contractKey,
      typedName,
      typedTitle,
      signatureMethod,
      signatureDataUrl,
      formData,
      attachmentPaths,
    } = input;

    if (!token || !typedName?.trim()) {
      return { success: false, error: "Name and signature are required." };
    }
    if (!["type", "draw", "upload"].includes(signatureMethod)) {
      return { success: false, error: "Invalid signature method." };
    }

    const def = getContractDef(contractKey);
    if (!def) {
      return { success: false, error: "Unknown contract type." };
    }

    const inviteToken = await validateInviteToken(token);
    if (!inviteToken) {
      return { success: false, error: "This invite link is no longer valid." };
    }
    if (inviteToken.role_type !== "sales_representative") {
      return { success: false, error: "Only sales-rep invites can sign these documents." };
    }

    const signatureBytes = decodeDataUrl(signatureDataUrl);
    if (!signatureBytes) {
      return { success: false, error: "Invalid signature image." };
    }
    if (signatureBytes.length > MAX_SIGNATURE_BYTES) {
      return { success: false, error: "Signature image is too large (max 2 MB)." };
    }

    const admin = createAdminClient();

    // Load source PDF from the local templates folder (not Supabase Storage —
    // see `lib/pdf/templates/index.ts` for the why).
    let sourceBytes: Uint8Array;
    try {
      if (!isKnownContractTemplate(def.templateFile)) {
        return { success: false, error: "Unknown contract template." };
      }
      sourceBytes = await loadContractTemplate(def.templateFile);
    } catch (err) {
      console.error("[signSalesRepContract] template load failed:", err);
      return { success: false, error: "Failed to load contract template." };
    }

    // Fetch any attachment bytes (I-9 uploads the rep's Section 2 document scans)
    let attachments: Array<{ bytes: Uint8Array; mime: string; filename: string }> | undefined;
    if (attachmentPaths && attachmentPaths.length > 0) {
      attachments = [];
      for (const p of attachmentPaths) {
        const { data: blob, error: dErr } = await admin.storage.from(BUCKET).download(p);
        if (dErr || !blob) {
          console.error("[signSalesRepContract] attachment download failed:", p, dErr?.message);
          continue;
        }
        attachments.push({
          bytes: new Uint8Array(await blob.arrayBuffer()),
          mime: blob.type || "application/octet-stream",
          filename: p.split("/").pop() ?? "attachment",
        });
      }
    }

    // Stamp
    const today = new Date();
    const stamped = await stampSalesRepContract({
      contract: def,
      sourcePdf: sourceBytes,
      formData,
      signaturePng: signatureBytes,
      signedDate: today,
      attachments,
    });

    // Upload signed copy
    const signedPath = salesRepContractSignedPath(token, contractKey);
    const { error: uploadErr } = await admin.storage
      .from(BUCKET)
      .upload(signedPath, stamped, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (uploadErr) {
      console.error("[signSalesRepContract] upload failed:", uploadErr.message);
      return { success: false, error: "Failed to save signed contract." };
    }

    // Audit row
    const h = await headers();
    const forwardedFor = h.get("x-forwarded-for") ?? "";
    const ipAddress = forwardedFor.split(",")[0]?.trim() || h.get("x-real-ip") || null;
    const userAgent = h.get("user-agent") || null;

    const { error: rowErr } = await admin
      .from("sales_rep_contract_signatures")
      .upsert(
        {
          invite_token: token,
          contract_type: contractKey,
          source_path: def.templateFile,
          signed_path: signedPath,
          typed_name: typedName.trim(),
          typed_title: typedTitle?.trim() || null,
          signature_method: signatureMethod,
          form_data: formData,
          signed_at: today.toISOString(),
          ip_address: ipAddress,
          user_agent: userAgent,
        },
        { onConflict: "invite_token,contract_type" },
      );
    if (rowErr) {
      console.error("[signSalesRepContract] row upsert failed:", JSON.stringify(rowErr));
      return { success: false, error: "Failed to record signature." };
    }

    const { data: urlData } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(signedPath, 3600);

    return { success: true, signedUrl: urlData?.signedUrl };
  } catch (err) {
    console.error("[signSalesRepContract] unexpected:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to sign contract.",
    };
  }
}

/* ── Email all signed sales-rep PDFs to internal recipients ── */

async function emailSignedSalesRepContractsToStaff({
  token,
  repName,
  repEmail,
  accountName,
}: {
  token: string;
  repName: string;
  repEmail: string;
  accountName: string | null;
}): Promise<void> {
  const admin = createAdminClient();

  const downloaded = await Promise.all(
    SALES_REP_CONTRACTS.map(async (def) => {
      const path = salesRepContractSignedPath(token, def.key);
      const { data, error } = await admin.storage.from(BUCKET).download(path);
      if (error || !data) {
        console.error(
          `[emailSignedSalesRepContractsToStaff] download failed for ${def.key}:`,
          error?.message,
        );
        return null;
      }
      const buf = Buffer.from(await data.arrayBuffer());
      return {
        filename: `${def.label.replace(/[\\/:*?"<>|]/g, "")} - ${repName}.pdf`,
        content: buf,
      };
    }),
  );

  const attachments = downloaded.filter((a) => a !== null) as Array<{
    filename: string;
    content: Buffer;
  }>;

  if (attachments.length === 0) {
    console.error(
      "[emailSignedSalesRepContractsToStaff] no signed PDFs available; skipping email",
    );
    return;
  }

  const { error: sendErr } = await sendSalesRepContractsSignedEmail({
    to: SIGNED_CONTRACTS_NOTIFY_TO,
    repName,
    repEmail,
    accountName,
    signedAt: new Date(),
    attachments,
  });
  if (sendErr) {
    console.error("[emailSignedSalesRepContractsToStaff] send error:", sendErr);
  }
}
