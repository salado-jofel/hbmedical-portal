import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { initialState } from "./hospital-onboarding-state";
import { TrainingMaterial } from "@/app/(interfaces)/trainings";
import { HospitalOnboardingMaterial } from "@/app/(interfaces)/hospital-onboarding";

const hospitalOnboarding = createSlice({
  name: "Hospital Onboarding",
  initialState,
  reducers: {
    setHospitalOnboardingMaterials(
      state,
      action: PayloadAction<HospitalOnboardingMaterial[]>,
    ) {
      state.items = action.payload;
    },
  },
});

export const { setHospitalOnboardingMaterials } = hospitalOnboarding.actions;
export default hospitalOnboarding.reducer;
