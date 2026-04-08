import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { initialState } from "./hospital-onboarding-state";
import { HospitalOnboardingMaterial } from "@/utils/interfaces/hospital-onboarding";
import type { UserData } from "@/utils/interfaces/users";

const hospitalOnboarding = createSlice({
  name: "Hospital Onboarding",
  initialState,
  reducers: {
    setHospitalOnboardingMaterials(
      state,
      action: PayloadAction<HospitalOnboardingMaterial[]>,
    ) {
      state.items = action.payload;
      state.selectedIds = [];
      state.isSelecting = false;
    },
    toggleSelectHospitalOnboardingItem(state, action: PayloadAction<string>) {
      const id = action.payload;
      const idx = state.selectedIds.indexOf(id);
      if (idx === -1) {
        state.selectedIds.push(id);
      } else {
        state.selectedIds.splice(idx, 1);
      }
    },
    selectAllHospitalOnboardingItems(state) {
      state.selectedIds = state.items.map((item) => item.id);
    },
    clearHospitalOnboardingSelection(state) {
      state.selectedIds = [];
    },
    setHospitalOnboardingSelecting(state, action: PayloadAction<boolean>) {
      state.isSelecting = action.payload;
      if (!action.payload) state.selectedIds = [];
    },
  },
});

export const {
  setHospitalOnboardingMaterials,
  toggleSelectHospitalOnboardingItem,
  selectAllHospitalOnboardingItems,
  clearHospitalOnboardingSelection,
  setHospitalOnboardingSelecting,
} = hospitalOnboarding.actions;
export default hospitalOnboarding.reducer;
