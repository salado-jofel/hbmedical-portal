import type { PaymentMode, PaymentProvider, PaymentStatus } from "./payment";

export type OrderStatus =
  | "Draft"
  | "Submitted"
  | "Processing"
  | "Approved"
  | "Shipped"
  | "Delivered"
  | "Cancelled";

export interface Order {
  id: string;
  created_at: string;
  order_id: string;
  facility_id: string;
  product_id: string;

  amount: number;
  quantity: number;
  status: OrderStatus | string;

  facility_name?: string | null;
  product_name?: string | null;
  created_by_email?: string | null;

  payment_mode?: PaymentMode | null;
  payment_provider?: PaymentProvider | null;
  payment_status?: PaymentStatus;

  receipt_email?: string | null;

  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_invoice_id?: string | null;
  stripe_invoice_number?: string | null;
  stripe_invoice_status?: string | null;
  stripe_invoice_hosted_url?: string | null;
  stripe_checkout_url?: string | null;
  stripe_customer_id?: string | null;
  stripe_receipt_url?: string | null;

  paid_at?: string | null;
  invoice_due_date?: string | null;
  invoice_sent_at?: string | null;
  invoice_paid_at?: string | null;
  invoice_amount_due?: number | null; // UI-facing dollars
  invoice_amount_remaining?: number | null; // UI-facing dollars
  invoice_overdue_at?: string | null;

  tracking_number?: string | null;
  carrier_code?: string | null;
  shipstation_sync_status?: string | null;
  shipstation_order_id?: string | null;
  shipstation_shipment_id?: string | null;
  shipstation_status?: string | null;
  shipstation_label_url?: string | null;
  shipped_at?: string | null;
}

export type InsertOrderPayload = Omit<
  Order,
  "id" | "created_at" | "facility_name" | "product_name" | "created_by_email"
>;

export type UpdateOrderPayload = Partial<InsertOrderPayload>;

export const ORDER_STATUSES: OrderStatus[] = [
  "Draft",
  "Submitted",
  "Processing",
  "Approved",
  "Shipped",
  "Delivered",
  "Cancelled",
];
