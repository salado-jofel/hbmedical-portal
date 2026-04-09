import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { IRepPerformanceSummary, IQuota } from "@/utils/interfaces/quotas";
import { initialState } from "./rep-performance-state";

const repPerformanceSlice = createSlice({
  name: "repPerformance",
  initialState,
  reducers: {
    setSummary(state, action: PayloadAction<IRepPerformanceSummary | null>) {
      state.summary = action.payload;
    },
    setQuotas(state, action: PayloadAction<IQuota[]>) {
      state.quotas = action.payload;
    },
    addQuotaToStore(state, action: PayloadAction<IQuota>) {
      const index = state.quotas.findIndex(
        (q) => q.repId === action.payload.repId && q.period === action.payload.period,
      );
      if (index !== -1) {
        state.quotas[index] = action.payload;
      } else {
        state.quotas.unshift(action.payload);
      }
    },
    updateQuotaInStore(state, action: PayloadAction<IQuota>) {
      const index = state.quotas.findIndex((q) => q.id === action.payload.id);
      if (index !== -1) state.quotas[index] = action.payload;
    },
  },
});

export const { setSummary, setQuotas, addQuotaToStore, updateQuotaInStore } =
  repPerformanceSlice.actions;

export default repPerformanceSlice.reducer;
