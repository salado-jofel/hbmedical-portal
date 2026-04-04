import type {
  OrderBoardStatus,
  OrderDeliveryStatus,
  OrderFulfillmentStatus,
  OrderInvoiceStatus,
  OrderPaymentStatus,
} from "../interfaces/orders";

type OrderStatus = "draft" | "pending_signature" | "manufacturer_review" | "additional_info_needed" | "approved" | "shipped" | "canceled";

export const ORDER_TABLE = "orders";
export const ORDER_ITEMS_TABLE = "order_items";
export const FACILITY_TABLE = "facilities";
export const PRODUCT_TABLE = "products";

export const ORDERS_PATH = "/dashboard/orders";

export const DEFAULT_SHIPPING_AMOUNT = 0;
export const DEFAULT_TAX_AMOUNT = 0;

export const DEFAULT_ORDER_STATUS: OrderStatus = "draft";
export const DEFAULT_PAYMENT_STATUS: OrderPaymentStatus = "pending";
export const DEFAULT_INVOICE_STATUS: OrderInvoiceStatus = "not_applicable";
export const DEFAULT_FULFILLMENT_STATUS: OrderFulfillmentStatus = "pending";
export const DEFAULT_DELIVERY_STATUS: OrderDeliveryStatus = "not_shipped";

export const BOARD_STATUS_NEW_ORDERS: OrderBoardStatus = "New Orders";
export const BOARD_STATUS_DELIVERED: OrderBoardStatus = "Delivered";

export const FACILITY_SELECT = `
  id,
  user_id,
  name,
  status,
  contact,
  phone,
  address_line_1,
  address_line_2,
  city,
  state,
  postal_code,
  country,
  stripe_customer_id,
  created_at,
  updated_at
`;

export const PRODUCT_SELECT = `
  id,
  sku,
  name,
  category,
  unit_price,
  is_active,
  sort_order,
  created_at,
  updated_at
`;

export const ORDER_BASE_SELECT = `
  id,
  order_number,
  facility_id,
  order_status,
  payment_method,
  payment_status,
  invoice_status,
  fulfillment_status,
  delivery_status,
  tracking_number,
  notes,
  placed_at,
  paid_at,
  delivered_at,
  created_at,
  updated_at
`;

export const ORDER_ITEMS_SELECT = `
  id,
  order_id,
  product_id,
  product_name,
  product_sku,
  unit_price,
  quantity,
  shipping_amount,
  tax_amount,
  subtotal,
  total_amount,
  created_at,
  updated_at
`;

export const PAYMENTS_SELECT = `
    id,
    order_id,
    provider,
    payment_type,
    status,
    amount,
    currency,
    stripe_checkout_session_id,
    stripe_payment_intent_id,
    stripe_charge_id,
    provider_payment_id,
    receipt_url,
    paid_at,
    created_at,
    updated_at
`;

export const INVOICES_SELECT = `
  id,
  order_id,
  invoice_number,
  provider,
  provider_invoice_id,
  status,
  amount_due,
  amount_paid,
  currency,
  due_at,
  issued_at,
  paid_at,
  hosted_invoice_url,
  created_at,
  updated_at
`;

export const ORDER_WITH_RELATIONS_SELECT = `
  ${ORDER_BASE_SELECT},
  facilities (${FACILITY_SELECT}),
  order_items (${ORDER_ITEMS_SELECT}),
  payments (${PAYMENTS_SELECT}),
  invoices (${INVOICES_SELECT})
`;
