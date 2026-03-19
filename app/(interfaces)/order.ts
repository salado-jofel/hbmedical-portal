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
  status: OrderStatus;
  created_by?: string;
  facility_name?: string;
  product_name?: string;
  created_by_email?: string;
  qb_invoice_id?: string | null;
  qb_invoice_status?: string | null;
  qb_synced_at?: string | null;
  facility_qb_customer_id?: string | null; 
  product_qb_item_id?: string | null; 
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
