import type {
  DashboardOrder,
  FacilityRecord,
  OrderInvoiceStatus,
  OrderRow,
} from "@/utils/interfaces/orders";

export type CheckoutOrderRecord = Pick<
  OrderRow,
  | "id"
  | "order_number"
  | "facility_id"
  | "product_id"
  | "product_name"
  | "product_sku"
  | "quantity"
  | "unit_price"
  | "shipping_amount"
  | "tax_amount"
  | "total_amount"
  | "payment_method"
  | "payment_status"
  | "order_status"
>;

export type CheckoutFacilityRecord = Pick<
  FacilityRecord,
  | "id"
  | "user_id"
  | "name"
  | "contact"
  | "phone"
  | "address_line_1"
  | "address_line_2"
  | "city"
  | "state"
  | "postal_code"
  | "country"
  | "stripe_customer_id"
>;

export type CreateOrderCheckoutSessionResult = {
  url: string;
  sessionId: string;
};

export type Net30OrderRecord = Pick<
  OrderRow,
  | "id"
  | "order_number"
  | "facility_id"
  | "product_id"
  | "product_name"
  | "product_sku"
  | "quantity"
  | "total_amount"
  | "payment_method"
  | "payment_status"
  | "invoice_status"
  | "order_status"
  | "placed_at"
>;

export type LocalInvoiceRecord = {
  id: string;
  order_id: string;
  invoice_number: string;
  provider: string;
  provider_invoice_id: string | null;
  status: OrderInvoiceStatus;
  amount_due: number | string;
  amount_paid: number | string;
  currency: string;
  due_at: string | null;
  issued_at: string | null;
  paid_at: string | null;
  hosted_invoice_url: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateStripeNet30InvoiceResult = DashboardOrder;
