import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { MaterialType } from "../(services)/actions";
import { initialState } from "./material-state";

const materialsSlice = createSlice({
  name: "materials",
  initialState,
  reducers: {
    setActiveTab(state, action: PayloadAction<MaterialType>) {
      state.activeTab = action.payload;
    },
    openUploadModal(state) {
      state.isUploadModalOpen = true;
    },
    closeUploadModal(state) {
      state.isUploadModalOpen = false;
    },
  },
});

export const { setActiveTab, openUploadModal, closeUploadModal } =
  materialsSlice.actions;
export default materialsSlice.reducer;
