import type {
  DashboardOrder,
  FacilityRecord,
  OrderInvoiceStatus,
  OrderRow,
} from "@/utils/interfaces/orders";

export type OrderItemRecord = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  product_sku: string;
  unit_price: number;
  quantity: number;
  shipping_amount: number;
  tax_amount: number;
  subtotal: number;
  total_amount: number;
};

export type CheckoutOrderRecord = Pick<
  OrderRow,
  | "id"
  | "order_number"
  | "facility_id"
  | "payment_method"
  | "payment_status"
  | "order_status"
> & {
  order_items: OrderItemRecord[];
};

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
  url: string | null;
  sessionId: string;
};

export type Net30OrderRecord = Pick<
  OrderRow,
  | "id"
  | "order_number"
  | "facility_id"
  | "payment_method"
  | "payment_status"
  | "invoice_status"
  | "order_status"
  | "placed_at"
> & {
  order_items: OrderItemRecord[];
};

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
