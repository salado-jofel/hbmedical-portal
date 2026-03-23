export type PaymentProvider = "stripe" | "legacy_qb";

export type PaymentStatus =
  | "unpaid"
  | "invoice_sent"
  | "paid"
  | "overdue"
  | "payment_failed"
  | null;
