import type { Product } from "@/app/(interfaces)/product";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { initialState } from "./products-state";

const productsSlice = createSlice({
  name: "products",
  initialState,
  reducers: {
    setProducts(state, action: PayloadAction<Product[]>) {
      state.items = action.payload;
    },
    addProductToStore(state, action: PayloadAction<Product>) {
      state.items.unshift(action.payload);
    },
    updateProductInStore(state, action: PayloadAction<Product>) {
      const index = state.items.findIndex((p) => p.id === action.payload.id);
      if (index !== -1) {
        state.items[index] = action.payload;
      }
    },
    removeProductFromStore(state, action: PayloadAction<string>) {
      state.items = state.items.filter((p) => p.id !== action.payload);
    },
    setSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
    },
    setFacilityFilter(state, action: PayloadAction<string>) {
      state.facilityFilter = action.payload;
    },
  },
});

export const {
  setProducts,
  addProductToStore,
  updateProductInStore,
  removeProductFromStore,
  setSearch,
  setFacilityFilter,
} = productsSlice.actions;

export default productsSlice.reducer;
