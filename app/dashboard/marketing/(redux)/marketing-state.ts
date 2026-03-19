import type { MarketingMaterial } from "@/app/(interfaces)/marketing";

export interface MarketingState {
  items: MarketingMaterial[];
}

export const initialState: MarketingState = {
  items: [],
};
