export const COMMISSION_RATES_TABLE = "commission_rates";
export const COMMISSION_TABLE = "commissions";
export const PAYOUTS_TABLE = "payouts";

export const COMMISSIONS_PATH = "/dashboard/commissions";

export const COMMISSION_STATUSES = ["pending", "approved", "paid", "void"] as const;
export const PAYOUT_STATUSES = ["draft", "approved", "paid"] as const;

/* Pages that render commission figures and therefore must be revalidated
 * together after any commission write. The sub-rep detail page is a dynamic
 * route, so it is revalidated by its route pattern rather than per id. */
export const MY_TEAM_PATH = "/dashboard/my-team";
export const MY_TEAM_REP_PATH = "/dashboard/my-team/[subRepId]";
export const REP_PERFORMANCE_PATH = "/dashboard/rep-performance";

/** Notification type for a payment that produced no commission. */
export const COMMISSION_GAP_NOTIFICATION = "commission_not_created";
