import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ICommissionRate, ICommission, IPayout, ICommissionSummary } from "@/utils/interfaces/commissions";
import { initialState } from "./commissions-state";

const commissionsSlice = createSlice({
  name: "commissions",
  initialState,
  reducers: {
    setRates(state, action: PayloadAction<ICommissionRate[]>) {
      state.rates = action.payload;
    },
    setCommissions(state, action: PayloadAction<ICommission[]>) {
      state.commissions = action.payload;
    },
    setPayouts(state, action: PayloadAction<IPayout[]>) {
      state.payouts = action.payload;
    },
    setSummary(state, action: PayloadAction<ICommissionSummary | null>) {
      state.summary = action.payload;
    },
    addRateToStore(state, action: PayloadAction<ICommissionRate>) {
      state.rates.unshift(action.payload);
    },
    updateCommissionInStore(state, action: PayloadAction<ICommission>) {
      const index = state.commissions.findIndex((c) => c.id === action.payload.id);
      if (index !== -1) state.commissions[index] = action.payload;
    },
    updatePayoutInStore(state, action: PayloadAction<IPayout>) {
      const index = state.payouts.findIndex((p) => p.id === action.payload.id);
      if (index !== -1) state.payouts[index] = action.payload;
    },
  },
});

export const {
  setRates,
  setCommissions,
  setPayouts,
  setSummary,
  addRateToStore,
  updateCommissionInStore,
  updatePayoutInStore,
} = commissionsSlice.actions;

export default commissionsSlice.reducer;
