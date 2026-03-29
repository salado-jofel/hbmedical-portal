import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { initialState } from "./marketing-state";
import type { MarketingMaterial } from "@/utils/interfaces/marketing";

const marketingSlice = createSlice({
  name: "marketing",
  initialState,
  reducers: {
    setMarketingMaterials(state, action: PayloadAction<MarketingMaterial[]>) {
      state.items = action.payload;
      state.selectedIds = [];
      state.isSelecting = false;
    },
    toggleSelectMarketingItem(state, action: PayloadAction<string>) {
      const id = action.payload;
      const idx = state.selectedIds.indexOf(id);
      if (idx === -1) {
        state.selectedIds.push(id);
      } else {
        state.selectedIds.splice(idx, 1);
      }
    },
    selectAllMarketingItems(state) {
      state.selectedIds = state.items.map((item) => item.id);
    },
    clearMarketingSelection(state) {
      state.selectedIds = [];
    },
    setMarketingSelecting(state, action: PayloadAction<boolean>) {
      state.isSelecting = action.payload;
      if (!action.payload) state.selectedIds = [];
    },
  },
});

export const {
  setMarketingMaterials,
  toggleSelectMarketingItem,
  selectAllMarketingItems,
  clearMarketingSelection,
  setMarketingSelecting,
} = marketingSlice.actions;
export default marketingSlice.reducer;
