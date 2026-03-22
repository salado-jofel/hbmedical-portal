import { PaymentProvider, PaymentStatus } from "./payment";

export type OrderStatus =
  | "Draft"
  | "Submitted"
  | "Processing"
  | "Approved"
  | "Shipped"
  | "Delivered";

export interface Order {
  id: string;
  created_at: string;
  order_id: string;
  facility_id: string;
  product_id: string;
  amount: number;
  quantity: number;
  status:
    | "Processing"
    | "Paid"
    | "Shipped"
    | "Delivered"
    | "Cancelled"
    | string;

  facility_name?: string | null;
  product_name?: string | null;
  created_by_email?: string | null;

  payment_provider?: "stripe" | "legacy_qb" | null;
  payment_status?:
    | "unpaid"
    | "pending"
    | "paid"
    | "failed"
    | "canceled"
    | "refunded"
    | null;

  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_invoice_id?: string | null;
  stripe_checkout_url?: string | null;
  stripe_customer_id?: string | null;
  paid_at?: string | null;

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
];
