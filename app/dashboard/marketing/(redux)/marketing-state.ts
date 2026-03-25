import type { MarketingMaterial } from "@/lib/interfaces/marketing";

export interface MarketingState {
  items: MarketingMaterial[];
}

export const initialState: MarketingState = {
  items: [],
};
