import { PaymentProvider, PaymentStatus } from "./payment";

export type OrderStatus =
  | "Draft"
  | "Submitted"
  | "Processing"
  | "Approved"
  | "Shipped"
  | "Delivered";

export interface Order {
  id?: string;
  created_at?: string;
  order_id: string;
  facility_id: string;
  product_id: string;
  amount: number;
  quantity: number;
  status: OrderStatus;
  created_by?: string;
  facility_name?: string;
  product_name?: string;
  created_by_email?: string;

  payment_provider?: PaymentProvider;
  payment_status?: PaymentStatus;
  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_invoice_id?: string | null;
  stripe_checkout_url?: string | null;
  stripe_customer_id?: string | null;
  paid_at?: string | null;
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
