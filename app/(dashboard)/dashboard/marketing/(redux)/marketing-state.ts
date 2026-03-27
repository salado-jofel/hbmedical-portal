import type { MarketingMaterial } from "@/utils/interfaces/marketing";

export interface MarketingState {
  items: MarketingMaterial[];
}

export const initialState: MarketingState = {
  items: [],
};
