export interface Product {
  id?: string;
  created_at?: string;
  name: string;
  price: number;
}

export type InsertProductPayload = {
  name: string;
  price: number;
};

export type UpdateProductPayload = {
  name?: string;
  price?: number;
};
