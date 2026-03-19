import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { initialState } from "./marketing-state";
import type { MarketingMaterial } from "@/app/(interfaces)/marketing";

const marketingSlice = createSlice({
  name: "marketing",
  initialState,
  reducers: {
    setMarketingMaterials(state, action: PayloadAction<MarketingMaterial[]>) {
      state.items = action.payload;
    },
  },
});

export const { setMarketingMaterials } = marketingSlice.actions;
export default marketingSlice.reducer;
