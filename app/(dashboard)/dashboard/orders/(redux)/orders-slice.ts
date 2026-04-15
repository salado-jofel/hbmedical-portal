import type { DashboardOrder } from "@/utils/interfaces/orders";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { initialState } from "./orders-state";

const ordersSlice = createSlice({
  name: "orders",
  initialState,
  reducers: {
    setOrders(state, action: PayloadAction<DashboardOrder[]>) {
      const currentById = new Map(state.items.map((o) => [o.id, o]));
      state.items = action.payload.map((incoming) => {
        const current = currentById.get(incoming.id);
        if (!current) return incoming;
        // One-way guard: stale RSC payloads (from revalidatePath) must never flip
        // ai_extracted back to false once it's been set to true in the store.
        return {
          ...incoming,
          ai_extracted: current.ai_extracted || incoming.ai_extracted,
          ai_extracted_at: current.ai_extracted_at ?? incoming.ai_extracted_at,
        };
      });
    },
    addOrderToStore(state, action: PayloadAction<DashboardOrder>) {
      state.items.unshift(action.payload);
    },
    updateOrderInStore(state, action: PayloadAction<DashboardOrder>) {
      const index = state.items.findIndex((o) => o.id === action.payload.id);
      if (index !== -1) {
        const current = state.items[index];
        // One-way guard: ai_extracted is never allowed to go from true → false
        // (a stale getOrderById after STEP 10 patient_id update can return ai_extracted=false
        // before STEP 12 writes ai_extracted=true, corrupting the modal state)
        state.items[index] = {
          ...action.payload,
          ai_extracted: current.ai_extracted || action.payload.ai_extracted,
          ai_extracted_at: current.ai_extracted_at ?? action.payload.ai_extracted_at,
        };
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
