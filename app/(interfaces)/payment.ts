export type PaymentProvider = "stripe" | "legacy_qb";

export type PaymentStatus =
  | "unpaid"
  | "pending"
  | "paid"
  | "failed"
  | "canceled"
  | "refunded";
