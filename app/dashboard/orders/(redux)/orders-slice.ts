import type { DashboardOrder } from "@/lib/interfaces/orders";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { initialState } from "./orders-state";

const ordersSlice = createSlice({
  name: "orders",
  initialState,
  reducers: {
    setOrders(state, action: PayloadAction<DashboardOrder[]>) {
      state.items = action.payload;
    },
    addOrderToStore(state, action: PayloadAction<DashboardOrder>) {
      state.items.unshift(action.payload);
    },
    updateOrderInStore(state, action: PayloadAction<DashboardOrder>) {
      const index = state.items.findIndex((o) => o.id === action.payload.id);
      if (index !== -1) {
        state.items[index] = action.payload;
      }
    },
    removeOrderFromStore(state, action: PayloadAction<string>) {
      state.items = state.items.filter((o) => o.id !== action.payload);
    },
  },
});

export const {
  setOrders,
  addOrderToStore,
  updateOrderInStore,
  removeOrderFromStore,
} = ordersSlice.actions;

export default ordersSlice.reducer;
