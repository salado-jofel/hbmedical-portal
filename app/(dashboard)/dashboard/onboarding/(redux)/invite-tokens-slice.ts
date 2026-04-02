import type { IInviteToken } from "@/utils/interfaces/invite-tokens";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { initialState } from "./invite-tokens-state";

const inviteTokensSlice = createSlice({
  name: "inviteTokens",
  initialState,
  reducers: {
    setInviteTokens(state, action: PayloadAction<IInviteToken[]>) {
      state.items = action.payload;
    },
    addInviteTokenToStore(state, action: PayloadAction<IInviteToken>) {
      state.items.unshift(action.payload);
    },
    removeInviteTokenFromStore(state, action: PayloadAction<string>) {
      state.items = state.items.filter((t) => t.id !== action.payload);
    },
  },
});

export const {
  setInviteTokens,
  addInviteTokenToStore,
  removeInviteTokenFromStore,
} = inviteTokensSlice.actions;

export default inviteTokensSlice.reducer;
