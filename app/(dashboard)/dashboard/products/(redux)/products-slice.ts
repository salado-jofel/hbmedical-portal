import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { Product } from "@/utils/interfaces/products";
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
      state.items = state.items.map((item) =>
        item.id === action.payload.id ? action.payload : item,
      );
    },
    removeProductFromStore(state, action: PayloadAction<string>) {
      state.items = state.items.filter((item) => item.id !== action.payload);
    },
    setSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
    },
  },
});

export const {
  setProducts,
  addProductToStore,
  updateProductInStore,
  removeProductFromStore,
  setSearch,
} = productsSlice.actions;

export default productsSlice.reducer;
