import { HospitalOnboardingMaterial } from "@/app/(interfaces)/hospital-onboarding";

export interface HospitalOnboardingState {
  items: HospitalOnboardingMaterial[];
}

export const initialState: HospitalOnboardingState = {
  items: [],
};
