"use server";

import { redirect } from "next/navigation";
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

export async function getContractSignedUrls(): Promise<{
  baaUrl: string | null;
  productServicesUrl: string | null;
  error: string | null;
}> {
  try {
    const adminClient = createAdminClient();
    const BUCKET = "hbmedical-bucket-private";
    const EXPIRES_IN = 3600; // 1 hour

    const [baaResult, psResult] = await Promise.all([
      adminClient.storage
        .from(BUCKET)
        .createSignedUrl("provider-contracts/Business Associates Agreement.pdf", EXPIRES_IN),
      adminClient.storage
        .from(BUCKET)
        .createSignedUrl("provider-contracts/Product and Services.pdf", EXPIRES_IN),
    ]);

    if (baaResult.error || psResult.error) {
      console.error("[getContractSignedUrls]", baaResult.error, psResult.error);
      return { baaUrl: null, productServicesUrl: null, error: "Failed to load contract documents." };
    }

    return {
      baaUrl: baaResult.data.signedUrl,
      productServicesUrl: psResult.data.signedUrl,
      error: null,
    };
  } catch (err) {
    console.error("[getContractSignedUrls] Unexpected:", err);
    return { baaUrl: null, productServicesUrl: null, error: "Failed to load contract documents." };
  }
}
