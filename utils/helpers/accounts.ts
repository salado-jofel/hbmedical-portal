import type { IAccount, IAccountWithMetrics } from "@/utils/interfaces/accounts";

export function withZeroMetrics(
  account: IAccount,
  existing?: IAccountWithMetrics,
): IAccountWithMetrics {
  return {
    ...account,
    signed_count: existing?.signed_count ?? 0,
    delivered_count: existing?.delivered_count ?? 0,
    avg_day: existing?.avg_day ?? 0,
    avg_week: existing?.avg_week ?? 0,
    one_year_est: existing?.one_year_est ?? 0,
    onboarded_at: existing?.onboarded_at ?? account.created_at,
    invited_by_name:
      existing?.invited_by_name ??
      (account.assigned_rep_profile
        ? `${account.assigned_rep_profile.first_name} ${account.assigned_rep_profile.last_name}`.trim()
        : null),
    delivered_revenue: existing?.delivered_revenue ?? 0,
    pipeline_revenue: existing?.pipeline_revenue ?? 0,
    one_year_projected_revenue: existing?.one_year_projected_revenue ?? 0,
    tier: existing?.tier ?? "C",
  };
}
