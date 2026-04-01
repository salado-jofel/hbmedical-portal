"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  validateInviteToken,
  consumeInviteToken,
} from "@/app/(dashboard)/dashboard/(services)/invite-tokens/actions";
import { addFacilityMember } from "@/app/(dashboard)/dashboard/(services)/facility-members/actions";
import { formatMessage } from "@/utils/helpers/signup";
import type { InviteTokenRole } from "@/utils/interfaces/invite-tokens";

export interface InviteSignUpState {
  error: string | null;
}

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
    const email = (formData.get("email") as string)?.trim().toLowerCase();
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

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
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

    // Hash and store PIN for clinical providers
    if (inviteToken.role_type === "clinical_provider") {
      const pin = (formData.get("pin") as string)?.trim();
      if (!pin || !/^\d{4,6}$/.test(pin)) {
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
        return { error: "A valid 4–6 digit PIN is required for clinical providers." };
      }
      const pinHash = await bcrypt.hash(pin, 10);
      const now = new Date().toISOString();
      const { error: credError } = await supabaseAdmin
        .from("provider_credentials")
        .insert({
          user_id: createdUserId,
          pin_hash: pinHash,
          baa_signed_at: now,
          terms_signed_at: now,
        });
      if (credError) {
        console.error("[inviteSignUp] provider_credentials error:", JSON.stringify(credError));
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
        return { error: credError.message ?? "Failed to save provider credentials." };
      }
    }

    // Determine facility ID to use
    let facilityIdToUse = inviteToken.facility_id;

    if (!facilityIdToUse) {
      // No facility linked to token — create a new facility from the office info in the form
      const officeName = (formData.get("office_name") as string)?.trim();
      const officePhone = toE164((formData.get("office_phone") as string) ?? "");
      const officeAddress = (formData.get("office_address") as string)?.trim();
      const officeCity = (formData.get("office_city") as string)?.trim();
      const officeState = (formData.get("office_state") as string)?.trim();
      const officePostalCode = (formData.get("office_postal_code") as string)?.trim();

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
        })
        .select("id")
        .single();

      if (facilityError) {
        console.error("[inviteSignUp] Facility creation error:", JSON.stringify(facilityError));
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
        return { error: friendlyDbError(facilityError, "Failed to create facility. Please check your information.") };
      }

      createdFacilityId = newFacility.id;
      facilityIdToUse = newFacility.id;
    }

    // Add to facility_members
    console.log("[inviteSignUp] addFacilityMember args:", {
      facilityId: facilityIdToUse,
      userId: createdUserId,
      roleType: inviteToken.role_type,
    });
    await addFacilityMember(facilityIdToUse, createdUserId, inviteToken.role_type);

    // Consume the token
    await consumeInviteToken(token, createdUserId);
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

  redirect("/verify-email");
}
