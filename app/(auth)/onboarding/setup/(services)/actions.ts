"use server";

import { createClient } from "@/lib/supabase/server";
import { repSetupSchema } from "@/utils/validators/onboarding";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrThrow, getUserRole } from "@/lib/supabase/auth";
import { isSalesRep } from "@/utils/helpers/role";

export interface RepSetupState {
  error: string | null;
  success: boolean;
  fieldErrors?: {
    first_name?: string;
    last_name?: string;
  };
}

export async function completeRepSetup(
  _prev: RepSetupState | null,
  formData: FormData,
): Promise<RepSetupState> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const role = await getUserRole(supabase);

    if (!isSalesRep(role)) {
      return { error: "Unauthorized.", success: false };
    }

    const raw = {
      first_name: formData.get("first_name") as string,
      last_name: formData.get("last_name") as string,
      practice_name: (formData.get("practice_name") as string)?.trim(),
      phone: (formData.get("phone") as string)?.trim(),
      address_line_1: (formData.get("address_line_1") as string)?.trim(),
      city: (formData.get("city") as string)?.trim(),
      state: (formData.get("state") as string)?.trim(),
      postal_code: (formData.get("postal_code") as string)?.trim(),
    };

    const parsed = repSetupSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: RepSetupState["fieldErrors"] = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof NonNullable<RepSetupState["fieldErrors"]>;
        if (field === "first_name" || field === "last_name") {
          fieldErrors[field] = issue.message;
        }
      }
      if (Object.keys(fieldErrors).length > 0) {
        return { error: null, success: false, fieldErrors };
      }
      const msg = parsed.error.issues[0]?.message ?? "Invalid input.";
      return { error: msg, success: false };
    }

    const { first_name, last_name, practice_name, phone, address_line_1, city, state, postal_code } =
      parsed.data;

    const adminClient = createAdminClient();

    // Use the rep's real name (entered in this form) as the facility contact
    const contactName = `${first_name} ${last_name}`.trim();

    // Idempotency: if the rep already has a facility, skip INSERT and just mark setup complete.
    const { data: existingFacility } = await adminClient
      .from("facilities")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existingFacility) {
      // Create facility owned by this rep.
      // facility_type is always "rep_office" for sales representatives —
      // never taken from form input and never allowed to be "clinic".
      //
      // Company name + phone are OPTIONAL (some reps operate as individuals).
      // `facilities.name` is NOT NULL → fall back to "N/A" per client spec.
      const facilityName = (practice_name ?? "").trim() || "N/A";
      const facilityPhone = (phone ?? "").trim() ? phone : null;
      const { error: facilityError } = await adminClient
        .from("facilities")
        .insert({
          user_id: user.id,
          name: facilityName,
          contact: contactName,
          phone: facilityPhone,
          address_line_1,
          city,
          state,
          postal_code,
          country: "US",
          status: "active",
          facility_type: "rep_office",
        });

      if (facilityError) {
        console.error("[completeRepSetup] Facility error:", JSON.stringify(facilityError));
        return { error: "Failed to save practice information. Please try again.", success: false };
      }
    }

    // Update profile with the rep's real name and mark setup complete
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({
        first_name,
        last_name,
        has_completed_setup: true,
      })
      .eq("id", user.id);

    if (profileError) {
      console.error("[completeRepSetup] Profile update error:", JSON.stringify(profileError));
      return { error: "Failed to save your name. Please try again.", success: false };
    }

    // Update auth user metadata so the sidebar shows the real name immediately
    await adminClient.auth.admin.updateUserById(user.id, {
      user_metadata: { first_name, last_name },
    });

    // Best-effort: mark the sub-rep's tracking token as used.
    // inviteSubRep inserts a sales_representative token when it sends the invite,
    // but since the sub-rep signs up via Supabase Auth (not the /invite/:token flow),
    // consumeInviteToken is never called automatically. We do it here instead.
    try {
      const { data: pendingToken } = await adminClient
        .from("invite_tokens")
        .select("id")
        .eq("role_type", "sales_representative")
        .is("used_at", null)
        .is("used_by", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pendingToken?.id) {
        await adminClient
          .from("invite_tokens")
          .update({
            used_by: user.id,
            used_at: new Date().toISOString(),
          })
          .eq("id", pendingToken.id);
      }
    } catch (tokenErr) {
      // Non-fatal — tracking failure must never block setup completion
      console.error("[completeRepSetup] Token tracking error (non-fatal):", tokenErr);
    }

    return { success: true, error: null };
  } catch (err) {
    console.error("[completeRepSetup] Unexpected error:", err);
    return { error: "An unexpected error occurred.", success: false };
  }
}
