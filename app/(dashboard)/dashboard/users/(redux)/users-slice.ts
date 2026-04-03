import type { IUser } from "@/utils/interfaces/users";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { initialState } from "./users-state";

const usersSlice = createSlice({
  name: "users",
  initialState,
  reducers: {
    setUsers(state, action: PayloadAction<IUser[]>) {
      state.items = action.payload;
    },
    addUserToStore(state, action: PayloadAction<IUser>) {
      state.items.unshift(action.payload);
    },
    updateUserInStore(state, action: PayloadAction<IUser>) {
      const index = state.items.findIndex((u) => u.id === action.payload.id);
      if (index !== -1) {
        state.items[index] = action.payload;
      }
    },
    removeUserFromStore(state, action: PayloadAction<string>) {
      state.items = state.items.filter((u) => u.id !== action.payload);
    },
  },
});

export const {
  setUsers,
  addUserToStore,
  updateUserInStore,
  removeUserFromStore,
} = usersSlice.actions;

export default usersSlice.reducer;
