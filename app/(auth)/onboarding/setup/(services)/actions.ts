"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrThrow, getUserRole } from "@/lib/supabase/auth";
import { isSalesRep } from "@/utils/helpers/role";

export interface RepSetupState {
  error: string | null;
  success: boolean;
}

const repSetupSchema = z.object({
  practice_name: z.string().min(1, "Practice name is required."),
  phone: z.string().min(1, "Phone number is required."),
  address_line_1: z.string().min(1, "Address is required."),
  city: z.string().min(1, "City is required."),
  state: z.string().min(2, "State is required."),
  postal_code: z.string().min(1, "ZIP code is required."),
});

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
      practice_name: (formData.get("practice_name") as string)?.trim(),
      phone: (formData.get("phone") as string)?.trim(),
      address_line_1: (formData.get("address_line_1") as string)?.trim(),
      city: (formData.get("city") as string)?.trim(),
      state: (formData.get("state") as string)?.trim(),
      postal_code: (formData.get("postal_code") as string)?.trim(),
    };

    const parsed = repSetupSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? "Invalid input.";
      return { error: msg, success: false };
    }

    const { practice_name, phone, address_line_1, city, state, postal_code } =
      parsed.data;

    const adminClient = createAdminClient();

    // Get rep's name for facility contact field
    const { data: profile } = await adminClient
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .single();

    const contactName = profile
      ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim()
      : "";

    // Create facility owned by this rep
    const { error: facilityError } = await adminClient
      .from("facilities")
      .insert({
        user_id: user.id,
        name: practice_name,
        contact: contactName,
        phone,
        address_line_1,
        city,
        state,
        postal_code,
        country: "US",
        status: "active",
      });

    if (facilityError) {
      console.error("[completeRepSetup] Facility error:", JSON.stringify(facilityError));
      return { error: "Failed to save practice information. Please try again.", success: false };
    }

    // Mark setup as complete
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({ has_completed_setup: true })
      .eq("id", user.id);

    if (profileError) {
      console.error("[completeRepSetup] Profile update error:", JSON.stringify(profileError));
      return { error: "Setup saved but profile update failed. Please contact support.", success: false };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error("[completeRepSetup] Unexpected error:", err);
    return { error: "An unexpected error occurred.", success: false };
  }
}
