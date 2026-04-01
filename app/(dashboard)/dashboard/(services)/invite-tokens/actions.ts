"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrThrow, getUserRole } from "@/lib/supabase/auth";
import {
  generateInviteTokenSchema,
  mapInviteToken,
  mapInviteTokens,
  type IInviteToken,
  type IInviteTokenFormState,
  type RawInviteTokenRecord,
} from "@/utils/interfaces/invite-tokens";

const INVITE_TOKENS_TABLE = "invite_tokens";
const INVITE_TOKEN_SELECT = `
  *,
  created_by_profile:profiles!invite_tokens_created_by_fkey (
    id,
    first_name,
    last_name,
    email
  ),
  used_by_profile:profiles!invite_tokens_used_by_fkey (
    id,
    first_name,
    last_name,
    email
  ),
  facility:facilities!invite_tokens_facility_id_fkey (
    id,
    name
  )
`;

/* -------------------------------------------------------------------------- */
/* generateInviteToken                                                        */
/* -------------------------------------------------------------------------- */

export async function generateInviteToken(
  _prevState: IInviteTokenFormState | null,
  formData: FormData,
): Promise<IInviteTokenFormState> {
  console.log("[generateInviteToken] called, formData:", Object.fromEntries(formData));
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const role = await getUserRole(supabase);

    if (role !== "sales_representative" && role !== "admin") {
      return { error: "Unauthorized.", success: false };
    }

    // Normalise "none" sentinel → null so UUID validation doesn't reject it
    const rawFacilityId = formData.get("facility_id") as string | null;
    const facilityId =
      !rawFacilityId || rawFacilityId.trim() === "" || rawFacilityId.trim() === "none"
        ? null
        : rawFacilityId.trim();

    const raw = {
      facility_id: facilityId,
      role_type: formData.get("role_type") as string,
      expires_in_days: formData.get("expires_in_days") ?? "30",
    };

    const parsed = generateInviteTokenSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error?.errors?.[0]?.message ?? "Invalid input.";
      return { error: msg, success: false };
    }

    const expiresAt = new Date(
      Date.now() + parsed.data.expires_in_days * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: inserted, error } = await supabase
      .from(INVITE_TOKENS_TABLE)
      .insert({
        created_by: user.id,
        facility_id: parsed.data.facility_id ?? null,
        role_type: parsed.data.role_type,
        expires_at: expiresAt,
      })
      .select("token")
      .single();

    if (error) {
      console.error("[generateInviteToken] Error:", JSON.stringify(error));
      return { error: error.message ?? error.code ?? "Failed to generate invite token.", success: false };
    }

    revalidatePath("/dashboard/onboarding");
    return { error: null, success: true, token: inserted.token };
  } catch (err) {
    console.error("[generateInviteToken] Unexpected error:", err);
    return { error: "An unexpected error occurred.", success: false };
  }
}

/* -------------------------------------------------------------------------- */
/* getMyInviteTokens                                                          */
/* -------------------------------------------------------------------------- */

export async function getMyInviteTokens(): Promise<IInviteToken[]> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const role = await getUserRole(supabase);

  let query = supabase
    .from(INVITE_TOKENS_TABLE)
    .select(INVITE_TOKEN_SELECT)
    .order("created_at", { ascending: false });

  // Sales reps see only their own tokens; admins see all
  if (role === "sales_representative") {
    query = query.eq("created_by", user.id);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[getMyInviteTokens] Error:", JSON.stringify(error));
    throw new Error(error.message ?? error.code ?? "Failed to fetch invite tokens.");
  }

  return mapInviteTokens((data ?? []) as unknown as RawInviteTokenRecord[]);
}

/* -------------------------------------------------------------------------- */
/* validateInviteToken — public (no auth required)                           */
/* -------------------------------------------------------------------------- */

export async function validateInviteToken(
  token: string,
): Promise<IInviteToken | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from(INVITE_TOKENS_TABLE)
    .select(INVITE_TOKEN_SELECT)
    .eq("token", token)
    .is("used_at", null)
    .single();

  if (error || !data) {
    return null;
  }

  const record = data as unknown as RawInviteTokenRecord;

  // Check expiry
  if (record.expires_at && new Date(record.expires_at) < new Date()) {
    return null;
  }

  return mapInviteToken(record);
}

/* -------------------------------------------------------------------------- */
/* consumeInviteToken — called after successful invite signup                 */
/* -------------------------------------------------------------------------- */

export async function consumeInviteToken(
  token: string,
  usedBy: string,
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from(INVITE_TOKENS_TABLE)
    .update({
      used_by: usedBy,
      used_at: new Date().toISOString(),
    })
    .eq("token", token)
    .is("used_at", null);

  if (error) {
    console.error("[consumeInviteToken] Error:", JSON.stringify(error));
    throw new Error(error.message ?? error.code ?? "Failed to consume invite token.");
  }
}

/* -------------------------------------------------------------------------- */
/* deleteInviteToken                                                          */
/* -------------------------------------------------------------------------- */

export async function deleteInviteToken(tokenId: string): Promise<void> {
  const supabase = await createClient();
  await getCurrentUserOrThrow(supabase);

  const { error } = await supabase
    .from(INVITE_TOKENS_TABLE)
    .delete()
    .eq("id", tokenId);

  if (error) {
    console.error("[deleteInviteToken] Error:", JSON.stringify(error));
    throw new Error(error.message ?? error.code ?? "Failed to delete invite token.");
  }

  revalidatePath("/dashboard/onboarding");
}
