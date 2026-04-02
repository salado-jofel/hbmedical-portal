import type { IAccount } from "@/utils/interfaces/accounts";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { initialState } from "./accounts-state";

const accountsSlice = createSlice({
  name: "accounts",
  initialState,
  reducers: {
    setAccounts(state, action: PayloadAction<IAccount[]>) {
      state.items = action.payload;
    },
    addAccountToStore(state, action: PayloadAction<IAccount>) {
      state.items.unshift(action.payload);
    },
    updateAccountInStore(state, action: PayloadAction<IAccount>) {
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
