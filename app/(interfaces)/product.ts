export interface Product {
  id?: string;
  created_at?: string;
  name: string;
  price: number;
  qb_item_id?: string | null; 
  qb_synced_at?: string | null;
}

export type InsertProductPayload = {
  name: string;
  price: number;
};

export type UpdateProductPayload = {
  name?: string;
  price?: number;
};
