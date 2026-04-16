import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { initialState } from "./accounts-state";
import type { IAccountWithMetrics } from "@/utils/interfaces/accounts";

const accountsSlice = createSlice({
  name: "accounts",
  initialState,
  reducers: {
    setAccounts(state, action: PayloadAction<IAccountWithMetrics[]>) {
      state.items = action.payload;
    },
    addAccountToStore(state, action: PayloadAction<IAccountWithMetrics>) {
      state.items.unshift(action.payload);
    },
    updateAccountInStore(state, action: PayloadAction<IAccountWithMetrics>) {
      const index = state.items.findIndex((a) => a.id === action.payload.id);
      if (index !== -1) {
        state.items[index] = action.payload;
      }
    },
    removeAccountFromStore(state, action: PayloadAction<string>) {
      state.items = state.items.filter((a) => a.id !== action.payload);
    },
  },
});

export const {
  setAccounts,
  addAccountToStore,
  updateAccountInStore,
  removeAccountFromStore,
} = accountsSlice.actions;

export default accountsSlice.reducer;
