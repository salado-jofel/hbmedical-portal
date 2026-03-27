import { Product } from "@/utils/interfaces/products";

export interface ProductsState {
  items: Product[];
  search: string;
}

export const initialState: ProductsState = {
  items: [],
  search: "",
};
