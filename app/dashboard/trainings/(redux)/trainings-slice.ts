import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { initialState } from "./trainings-state";
import { TrainingMaterial } from "@/app/(interfaces)/trainings";



const trainingsSlice = createSlice({
  name: "trainings",
  initialState,
  reducers: {
    setTrainingMaterials(state, action: PayloadAction<TrainingMaterial[]>) {
      state.items = action.payload;
    },
  },
});

export const { setTrainingMaterials } = trainingsSlice.actions;
export default trainingsSlice.reducer;
