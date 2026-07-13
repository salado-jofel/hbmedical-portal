import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { IStandaloneIvr } from "@/utils/interfaces/standalone-ivrs";
import { initialState } from "./ivrs-state";

const ivrsSlice = createSlice({
  name: "ivrs",
  initialState,
  reducers: {
    setIvrs(state, action: PayloadAction<IStandaloneIvr[]>) {
      state.items = action.payload;
    },
    addIvrToStore(state, action: PayloadAction<IStandaloneIvr>) {
      state.items.unshift(action.payload);
    },
    updateIvrInStore(state, action: PayloadAction<IStandaloneIvr>) {
      state.items = state.items.map((item) =>
        item.id === action.payload.id ? action.payload : item,
      );
    },
    removeIvrFromStore(state, action: PayloadAction<string>) {
      state.items = state.items.filter((item) => item.id !== action.payload);
    },
    setSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
    },
  },
});

export const {
  setIvrs,
  addIvrToStore,
  updateIvrInStore,
  removeIvrFromStore,
  setSearch,
} = ivrsSlice.actions;

export default ivrsSlice.reducer;
