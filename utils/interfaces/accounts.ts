import { z } from "zod";

/* -------------------------------------------------------------------------- */
/* Enums / literal types                                                      */
/* -------------------------------------------------------------------------- */

export const accountStatusSchema = z.enum(["active", "inactive", "prospect"]);
export type AccountStatus = z.infer<typeof accountStatusSchema>;

/* -------------------------------------------------------------------------- */
/* Rep profile (joined from profiles via assigned_rep FK)                     */
/* -------------------------------------------------------------------------- */

export interface IRepProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

/* -------------------------------------------------------------------------- */
/* Core account interface (facilities table + CRM fields)                     */
/* -------------------------------------------------------------------------- */

export interface IAccount {
  id: string;
  user_id: string | null;
  name: string;
  status: AccountStatus;
  contact: string;
  phone: string;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  stripe_customer_id: string | null;
  // CRM fields
  assigned_rep: string | null;
  assigned_rep_profile: IRepProfile | null;
  orders_count: number;
  contacts_count: number;
  created_at: string;
  updated_at: string;
}

/* -------------------------------------------------------------------------- */
/* Filter shape                                                               */
/* -------------------------------------------------------------------------- */

export interface IAccountFilters {
  search: string;
  status: AccountStatus | "all";
  rep_id: string | "all";
}

/* -------------------------------------------------------------------------- */
/* Period type for sales metrics filter                                       */
/* -------------------------------------------------------------------------- */

export type AccountPeriod = "this_month" | "last_3_months" | "all_time";

export type AccountTier = "A" | "B" | "C";

/* -------------------------------------------------------------------------- */
/* Account with per-account sales metrics (rep/admin enriched view)           */
/* -------------------------------------------------------------------------- */

export interface IAccountWithMetrics extends IAccount {
  signed_count: number;
  delivered_count: number;
  avg_day: number;
  avg_week: number;
  one_year_est: number;           // projected order count (avg_week × 52)
  onboarded_at: string;           // same as created_at, explicit alias
  invited_by_name: string | null; // assigned rep's full name
  delivered_revenue: number;
  pipeline_revenue: number;
  one_year_projected_revenue: number; // delivered_revenue / periodWeeks × 52
  tier: AccountTier;
}

/* -------------------------------------------------------------------------- */
/* Raw Supabase response before mapping                                       */
/* -------------------------------------------------------------------------- */

export type RawAccountRecord = {
  id: string;
  user_id: string | null;
  name: string;
  status: string;
  contact: string;
  phone: string;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  stripe_customer_id: string | null;
  assigned_rep: string | null;
  created_at: string;
  updated_at: string;
  assigned_rep_profile: IRepProfile | null;
  orders: { count: number }[];
  contacts: { count: number }[];
};

/* -------------------------------------------------------------------------- */
/* Mapping helper                                                             */
/* -------------------------------------------------------------------------- */

export function mapAccount(raw: RawAccountRecord): IAccount {
  return {
    id: raw.id,
    user_id: raw.user_id,
    name: raw.name,
    status: accountStatusSchema.catch("inactive").parse(raw.status),
    contact: raw.contact,
    phone: raw.phone,
    address_line_1: raw.address_line_1,
    address_line_2: raw.address_line_2,
    city: raw.city,
    state: raw.state,
    postal_code: raw.postal_code,
    country: raw.country,
    stripe_customer_id: raw.stripe_customer_id,
    assigned_rep: raw.assigned_rep,
    assigned_rep_profile: raw.assigned_rep_profile ?? null,
    orders_count: raw.orders?.[0]?.count ?? 0,
    contacts_count: raw.contacts?.[0]?.count ?? 0,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

export function mapAccounts(rows: RawAccountRecord[]): IAccount[] {
  return rows.map(mapAccount);
}
