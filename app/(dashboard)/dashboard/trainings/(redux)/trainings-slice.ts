import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { initialState } from "./trainings-state";
import { TrainingMaterial } from "@/utils/interfaces/trainings";

const trainingsSlice = createSlice({
  name: "trainings",
  initialState,
  reducers: {
    setTrainingMaterials(state, action: PayloadAction<TrainingMaterial[]>) {
      state.items = action.payload;
      state.selectedIds = [];
      state.isSelecting = false;
    },
    toggleSelectTrainingItem(state, action: PayloadAction<string>) {
      const id = action.payload;
      const idx = state.selectedIds.indexOf(id);
      if (idx === -1) {
        state.selectedIds.push(id);
      } else {
        state.selectedIds.splice(idx, 1);
      }
    },
    selectAllTrainingItems(state) {
      state.selectedIds = state.items.map((item) => item.id);
    },
    clearTrainingSelection(state) {
      state.selectedIds = [];
    },
    setTrainingSelecting(state, action: PayloadAction<boolean>) {
      state.isSelecting = action.payload;
      if (!action.payload) state.selectedIds = [];
    },
  },
});

export const {
  setTrainingMaterials,
  toggleSelectTrainingItem,
  selectAllTrainingItems,
  clearTrainingSelection,
  setTrainingSelecting,
} = trainingsSlice.actions;
export default trainingsSlice.reducer;
