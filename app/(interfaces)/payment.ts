export type PaymentProvider = "stripe" | "legacy_qb";

export type PaymentMode = "pay_now" | "net_30";

/**
 * These are the payment statuses that match the current DB constraint on orders.payment_status.
 */
export type PersistedPaymentStatus =
  | "unpaid"
  | "invoice_sent"
  | "paid"
  | "overdue"
  | "payment_failed";

/**
 * Transitional legacy statuses still referenced by older UI/webhook code.
 * We keep them here temporarily so the app can be migrated in stages without
 * breaking TypeScript immediately. New writes should use PersistedPaymentStatus only.
 */
export type LegacyPaymentStatus =
  | "pending"
  | "failed"
  | "canceled"
  | "refunded";

export type PaymentStatus = PersistedPaymentStatus | LegacyPaymentStatus | null;
