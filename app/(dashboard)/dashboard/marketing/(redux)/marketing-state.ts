import type { MarketingMaterial } from "@/utils/interfaces/marketing";

export interface MarketingState {
  items: MarketingMaterial[];
  selectedIds: string[];
  isSelecting: boolean;
}

export const initialState: MarketingState = {
  items: [],
  selectedIds: [],
  isSelecting: false,
};
