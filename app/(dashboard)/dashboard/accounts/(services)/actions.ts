"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentUserOrThrow,
  getUserRole,
  requireAdminOrThrow,
} from "@/lib/supabase/auth";
import { isAdmin as checkIsAdmin, isSalesRep, isSupport } from "@/utils/helpers/role";
import {
  ACCOUNTS_PATH,
  ACCOUNTS_TABLE,
  ACCOUNT_SELECT,
  PROFILES_TABLE,
  SALES_REP_SELECT,
} from "@/utils/constants/accounts";
import {
  mapAccount,
  mapAccounts,
  type IAccount,
  type IAccountFilters,
  type RawAccountRecord,
  accountStatusSchema,
  type AccountStatus,
} from "@/utils/interfaces/accounts";
import type { IRepProfile } from "@/utils/interfaces/accounts";

/* -------------------------------------------------------------------------- */
/* getAccounts                                                                */
/* -------------------------------------------------------------------------- */

export async function getAccounts(
  filters?: Partial<IAccountFilters>,
): Promise<IAccount[]> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const role = await getUserRole(supabase);

  if (!checkIsAdmin(role) && !isSalesRep(role) && !isSupport(role)) {
    throw new Error("Unauthorized");
  }

  let query = supabase
    .from(ACCOUNTS_TABLE)
    .select(ACCOUNT_SELECT)
    .eq("facility_type", "clinic")   // Accounts = clinic clients only; rep_office facilities must never appear
    .order("name", { ascending: true });

  // Status filter
  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  // Rep filter (admin only)
  if (checkIsAdmin(role) && filters?.rep_id && filters.rep_id !== "all") {
    query = query.eq("assigned_rep", filters.rep_id);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[getAccounts] Error:", JSON.stringify(error));
    throw new Error(error.message || "Failed to fetch accounts.");
  }

  let accounts = mapAccounts((data ?? []) as unknown as RawAccountRecord[]);

  // Client-side search filter
  if (filters?.search?.trim()) {
    const term = filters.search.trim().toLowerCase();
    accounts = accounts.filter(
      (a) =>
        a.name.toLowerCase().includes(term) ||
        a.city.toLowerCase().includes(term) ||
        a.state.toLowerCase().includes(term) ||
        a.contact.toLowerCase().includes(term),
    );
  }

  return accounts;
}

/* -------------------------------------------------------------------------- */
/* getAccountById                                                             */
/* -------------------------------------------------------------------------- */

export async function getAccountById(id: string): Promise<IAccount | null> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const role = await getUserRole(supabase);

  if (!checkIsAdmin(role) && !isSalesRep(role) && !isSupport(role)) {
    throw new Error("Unauthorized");
  }

  let query = supabase
    .from(ACCOUNTS_TABLE)
    .select(ACCOUNT_SELECT)
    .eq("id", id)
    .eq("facility_type", "clinic");  // Guard: prevents opening a rep_office via direct URL

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("[getAccountById] Error:", JSON.stringify(error));
    throw new Error(error.message || "Failed to fetch account.");
  }

  if (!data) return null;

  return mapAccount(data as unknown as RawAccountRecord);
}

/* -------------------------------------------------------------------------- */
/* getSalesReps                                                               */
/* -------------------------------------------------------------------------- */

export async function getSalesReps(): Promise<IRepProfile[]> {
  const supabase = await createClient();
  await getCurrentUserOrThrow(supabase);

  const { data, error } = await supabase
    .from(PROFILES_TABLE)
    .select(SALES_REP_SELECT)
    .eq("role", "sales_representative")
    .order("first_name", { ascending: true });

  if (error) {
    console.error("[getSalesReps] Error:", JSON.stringify(error));
    throw new Error(error.message || "Failed to fetch sales reps.");
  }

  return (data ?? []) as IRepProfile[];
}

/* -------------------------------------------------------------------------- */
/* updateAccountStatus (admin only)                                          */
/* -------------------------------------------------------------------------- */

export async function updateAccountStatus(
  accountId: string,
  status: AccountStatus,
): Promise<IAccount> {
  const supabase = await createClient();
  await requireAdminOrThrow(supabase);

  const parsed = accountStatusSchema.parse(status);

  const { error } = await supabase
    .from(ACCOUNTS_TABLE)
    .update({ status: parsed })
    .eq("id", accountId);

  if (error) {
    console.error("[updateAccountStatus] Error:", JSON.stringify(error));
    throw new Error(error.message || "Failed to update account status.");
  }

  revalidatePath(ACCOUNTS_PATH);
  revalidatePath(`${ACCOUNTS_PATH}/${accountId}`);

  const updated = await getAccountById(accountId);
  if (!updated) throw new Error("Account not found after update.");
  return updated;
}

/* -------------------------------------------------------------------------- */
/* assignRep (admin only)                                                    */
/* -------------------------------------------------------------------------- */

export async function assignRep(
  accountId: string,
  repId: string | null,
): Promise<IAccount> {
  const supabase = await createClient();
  await requireAdminOrThrow(supabase);

  const { error } = await supabase
    .from(ACCOUNTS_TABLE)
    .update({ assigned_rep: repId })
    .eq("id", accountId);

  if (error) {
    console.error("[assignRep] Error:", JSON.stringify(error));
    throw new Error(error.message || "Failed to assign rep.");
  }

  revalidatePath(ACCOUNTS_PATH);
  revalidatePath(`${ACCOUNTS_PATH}/${accountId}`);

  const updated = await getAccountById(accountId);
  if (!updated) throw new Error("Account not found after update.");
  return updated;
}
