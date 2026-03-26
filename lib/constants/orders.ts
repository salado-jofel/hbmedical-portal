import type {
  OrderBoardStatus,
  OrderDeliveryStatus,
  OrderFulfillmentStatus,
  OrderInvoiceStatus,
  OrderPaymentStatus,
  OrderStatus,
} from "../interfaces/orders";

export const ORDER_TABLE = "orders";
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
  product_id,
  product_name,
  product_sku,
  quantity,
  unit_price,
  shipping_amount,
  tax_amount,
  subtotal,
  total_amount,
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

export const ORDER_WITH_RELATIONS_SELECT = `
  ${ORDER_BASE_SELECT},
  facilities (${FACILITY_SELECT}),
  products (${PRODUCT_SELECT})
`;
