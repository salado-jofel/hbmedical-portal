import type { Facility } from "@/app/(interfaces)/facility";
import type { Product } from "@/app/(interfaces)/product";

export interface FacilityState {
  item: Facility | null;
  products: Product[];
}

export const initialState: FacilityState = {
  item: null,
  products: [],
};
