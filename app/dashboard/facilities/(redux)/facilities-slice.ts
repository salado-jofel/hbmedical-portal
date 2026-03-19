import { Facility } from "@/app/(interfaces)/facility";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { initialState } from "./facilities-state";

const facilitiesSlice = createSlice({
  name: "facilities",
  initialState,
  reducers: {
    setFacilities(state, action: PayloadAction<Facility[]>) {
      state.items = action.payload;
    },
    addFacilityToStore(state, action: PayloadAction<Facility>) {
      state.items.unshift(action.payload);
    },
    removeFacilityFromStore(state, action: PayloadAction<string>) {
      state.items = state.items.filter((f) => f.id !== action.payload);
    },
    setSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
    },
    setTypeFilter(state, action: PayloadAction<string>) {
      state.typeFilter = action.payload;
    },
  },
});

export const {
  setFacilities,
  addFacilityToStore,
  removeFacilityFromStore,
  setSearch,
  setTypeFilter,
} = facilitiesSlice.actions;

export default facilitiesSlice.reducer;
