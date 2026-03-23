import type { PaymentProvider, PaymentStatus } from "./payment";

export type OrderStatus = "Processing" | "Shipped" | "Delivered" | "Cancelled";

export interface Order {
  id: string;
  created_at: string;
  order_id: string;
  facility_id: string;
  product_id: string;

  amount: number;
  quantity: number;

  // DB/UI order lifecycle
  status: OrderStatus;

  facility_name: string | null;
  product_name: string | null;

  payment_mode: "pay_now" | "net_30" | null;
  payment_provider: PaymentProvider | null;
  payment_status: PaymentStatus;
  receipt_email: string | null;

  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_invoice_id: string | null;
  stripe_invoice_number: string | null;
  stripe_invoice_status: string | null;
  stripe_invoice_hosted_url: string | null;
  stripe_checkout_url: string | null;
  stripe_customer_id: string | null;
  stripe_receipt_url: string | null;

  paid_at: string | null;
  invoice_due_date: string | null;
  invoice_sent_at: string | null;
  invoice_paid_at: string | null;

  // exposed to UI in dollars
  invoice_amount_due: number | null;
  invoice_amount_remaining: number | null;
  invoice_overdue_at: string | null;

  tracking_number: string | null;
  carrier_code: string | null;
  shipstation_order_id: string | null;
  shipstation_shipment_id: string | null;
  shipstation_status: string | null;
  shipstation_sync_status: string | null;
  shipstation_label_url: string | null;
  shipped_at: string | null;
}
