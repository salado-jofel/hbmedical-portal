import type { Product } from "@/app/(interfaces)/product";

export interface ProductsState {
  items: Product[];
  search: string;
  facilityFilter: string;
}

export const initialState: ProductsState = {
  items: [],
  search: "",
  facilityFilter: "All Facilities",
};
