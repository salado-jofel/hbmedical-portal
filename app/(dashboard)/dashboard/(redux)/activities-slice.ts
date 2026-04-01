import type { IActivity } from "@/utils/interfaces/activities";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { initialState } from "./activities-state";

const activitiesSlice = createSlice({
  name: "activities",
  initialState,
  reducers: {
    setActivities(state, action: PayloadAction<IActivity[]>) {
      state.items = action.payload;
    },
    addActivityToStore(state, action: PayloadAction<IActivity>) {
      state.items.unshift(action.payload);
    },
    updateActivityInStore(state, action: PayloadAction<IActivity>) {
      const index = state.items.findIndex((a) => a.id === action.payload.id);
      if (index !== -1) {
        state.items[index] = action.payload;
      }
    },
    removeActivityFromStore(state, action: PayloadAction<string>) {
      state.items = state.items.filter((a) => a.id !== action.payload);
    },
  },
});

export const {
  setActivities,
  addActivityToStore,
  updateActivityInStore,
  removeActivityFromStore,
} = activitiesSlice.actions;

export default activitiesSlice.reducer;
