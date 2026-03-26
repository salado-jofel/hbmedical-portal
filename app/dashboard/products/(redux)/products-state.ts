import { Product } from "@/lib/interfaces/products";

export interface ProductsState {
  items: Product[];
  search: string;
}

export const initialState: ProductsState = {
  items: [],
  search: "",
};
