"use server";

import { createClient } from "@/lib/supabase/server";
import type { RepWithFacility } from "@/utils/interfaces/onboarding";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrThrow, getUserRole, requireAdminOrThrow } from "@/lib/supabase/auth";
import { isSalesRep, isClinicalProvider } from "@/utils/helpers/role";
import type { UserRole } from "@/utils/helpers/role";
import {
  mapInviteToken,
  mapInviteTokens,
  type IInviteToken,
  type RawInviteTokenRecord,
} from "@/utils/interfaces/invite-tokens";
import { INVITE_TOKENS_TABLE, INVITE_TOKEN_SELECT } from "./_onboarding-shared";

/* -------------------------------------------------------------------------- */
/* getSalesRepsWithFacilities                                                  */
/* -------------------------------------------------------------------------- */

export async function getSalesRepsWithFacilities(): Promise<RepWithFacility[]> {
  const supabase = await createClient();
  await requireAdminOrThrow(supabase);

  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("profiles")
    .select(`
      id,
      first_name,
      last_name,
      facility:facilities!facilities_user_id_fkey(id, name)
    `)
    .eq("role", "sales_representative")
    .eq("status", "active")
    .order("first_name", { ascending: true });

  if (error) {
    console.error("[getSalesRepsWithFacilities] Error:", JSON.stringify(error));
    throw new Error(error.message ?? "Failed to fetch reps.");
  }

  return (data ?? [])
    .map((p: any) => {
      const fac = Array.isArray(p.facility) ? p.facility[0] : p.facility;
      return fac?.id
        ? {
            id: p.id as string,
            name: `${p.first_name} ${p.last_name}`,
            facilityId: fac.id as string,
            facilityName: fac.name as string,
          }
        : null;
    })
    .filter((r): r is RepWithFacility => r !== null);
}

/* -------------------------------------------------------------------------- */
/* getMyInviteTokens                                                           */
/* -------------------------------------------------------------------------- */

export async function getMyInviteTokens(): Promise<IInviteToken[]> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const role = await getUserRole(supabase);

  let query = supabase
    .from(INVITE_TOKENS_TABLE)
    .select(INVITE_TOKEN_SELECT)
    .order("created_at", { ascending: false });

  // Sales reps and clinical providers see only their own tokens; admins see all
  if (isSalesRep(role as UserRole) || isClinicalProvider(role as UserRole)) {
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
/* validateInviteToken — public (no auth required)                            */
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
