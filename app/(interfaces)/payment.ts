export type PaymentProvider = "stripe" | "legacy_qb";

export type PaymentMode = "pay_now" | "net_30";

/**
 * Canonical payment statuses that match the current orders.payment_status values
 * used by the Stripe + Net30 flow.
 */
export type PersistedPaymentStatus =
  | "paid"
  | "unpaid"
  | "invoice_sent"
  | "overdue"
  | "payment_failed";

/**
 * Shared UI/app payment status type.
 * Null is allowed for transitional or unset records.
 */
export type PaymentStatus = PersistedPaymentStatus | null;
