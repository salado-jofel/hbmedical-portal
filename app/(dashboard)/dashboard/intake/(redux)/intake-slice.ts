import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { IIntakeDocument } from "@/utils/interfaces/intake";
import { initialState } from "./intake-state";

const intakeSlice = createSlice({
  name: "intake",
  initialState,
  reducers: {
    setIntake(state, action: PayloadAction<IIntakeDocument[]>) {
      state.items = action.payload;
    },
    addIntakeToStore(state, action: PayloadAction<IIntakeDocument>) {
      state.items.unshift(action.payload);
    },
    updateIntakeInStore(state, action: PayloadAction<IIntakeDocument>) {
      state.items = state.items.map((item) =>
        item.id === action.payload.id ? action.payload : item,
      );
    },
    removeIntakeFromStore(state, action: PayloadAction<string>) {
      state.items = state.items.filter((item) => item.id !== action.payload);
    },
    setIntakeSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
    },
  },
});

export const {
  setIntake,
  addIntakeToStore,
  updateIntakeInStore,
  removeIntakeFromStore,
  setIntakeSearch,
} = intakeSlice.actions;

export default intakeSlice.reducer;
