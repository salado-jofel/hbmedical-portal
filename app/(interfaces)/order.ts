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
  order_id: string;
  product_name?: string | null;
  facility_name?: string | null;
  created_by_email?: string | null;
  quantity?: number | null;
  amount?: number | null;

  status?: string | null;
  payment_status?: string | null;

  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_customer_id?: string | null;
  paid_at?: string | null;

  shipstation_sync_status?: string | null;
  shipstation_shipment_id?: string | null;
  shipstation_fulfillment_id?: string | null;
  tracking_number?: string | null;
  carrier_code?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
  shipstation_raw?: unknown;

  // if these exist in your project already, keep them too
  customer_name?: string | null;
  customer_phone?: string | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
  order_doc_number?: string | null;
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
