"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrThrow, getUserRole } from "@/lib/supabase/auth";
import { evaluateMfaGate } from "@/lib/supabase/mfa-gate";
import { isClinicalProvider } from "@/utils/helpers/role";

type SetPinResult = { success: true } | { success: false; error: string };

/**
 * First-time PIN creation for providers onboarded from paper contracts.
 * Only works while `pin_hash` is NULL — changing an existing PIN goes
 * through Settings → Credentials (`verifyAndChangePin`), which enforces the
 * current-PIN check and cooldown.
 */
export async function setInitialPin(pin: string, confirmPin: string): Promise<SetPinResult> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const role = await getUserRole(supabase);
    if (!isClinicalProvider(role)) return { success: false, error: "Only clinical providers set a signing PIN." };

    const mfa = await evaluateMfaGate(role);
    if (mfa.kind !== "ok") return { success: false, error: "Finish phone verification first." };

    if (!/^\d{4}$/.test(pin)) return { success: false, error: "PIN must be exactly 4 digits." };
    if (pin !== confirmPin) return { success: false, error: "PINs do not match." };

    const admin = createAdminClient();
    const { data: creds } = await admin
      .from("provider_credentials")
      .select("id, pin_hash")
      .eq("user_id", user.id)
      .maybeSingle();
    if (creds?.pin_hash) return { success: false, error: "A PIN is already set. Change it from Settings." };

    const { data: hash, error: hashErr } = await admin.rpc("hash_pin", { input_pin: pin });
    if (hashErr || !hash) return { success: false, error: "Failed to secure your PIN. Please try again." };

    const now = new Date().toISOString();
    const { error } = creds
      ? await admin
          .from("provider_credentials")
          .update({ pin_hash: hash as string, updated_at: now })
          .eq("id", creds.id)
      : await admin
          .from("provider_credentials")
          .insert({ user_id: user.id, pin_hash: hash as string });
    if (error) {
      console.error("[setInitialPin] write error:", JSON.stringify(error));
      return { success: false, error: "Failed to save your PIN. Please try again." };
    }
    return { success: true };
  } catch (err) {
    console.error("[setInitialPin] threw:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}
