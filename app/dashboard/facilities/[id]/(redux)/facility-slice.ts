import type {
  Facility,
  UpdateFacilityPayload,
} from "@/app/(interfaces)/facility";
import type { Product } from "@/app/(interfaces)/product";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { initialState } from "./facility-state";

const facilitySlice = createSlice({
  name: "facility",
  initialState,
  reducers: {
    // ── Facility ────────────────────────────────────────────────────────
    setFacility(state, action: PayloadAction<Facility>) {
      state.item = action.payload;
    },
    updateFacilityInStore(state, action: PayloadAction<UpdateFacilityPayload>) {
      if (state.item) {
        state.item = { ...state.item, ...action.payload };
      }
    },
    clearFacility(state) {
      state.item = null;
      state.products = [];
    },

   

  
  },
});

export const {
  setFacility,
  updateFacilityInStore,
  clearFacility,
} = facilitySlice.actions;

export default facilitySlice.reducer;
