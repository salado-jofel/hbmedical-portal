import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { IExternalApprover } from "@/utils/interfaces/standalone-ivrs";
import { initialState } from "./approvers-state";

const approversSlice = createSlice({
  name: "approvers",
  initialState,
  reducers: {
    setApprovers(state, action: PayloadAction<IExternalApprover[]>) {
      state.items = action.payload;
    },
    addApproverToStore(state, action: PayloadAction<IExternalApprover>) {
      state.items.unshift(action.payload);
    },
    updateApproverInStore(state, action: PayloadAction<IExternalApprover>) {
      state.items = state.items.map((item) =>
        item.id === action.payload.id ? action.payload : item,
      );
    },
    setSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
    },
  },
});

export const {
  setApprovers,
  addApproverToStore,
  updateApproverInStore,
  setSearch,
} = approversSlice.actions;

export default approversSlice.reducer;
