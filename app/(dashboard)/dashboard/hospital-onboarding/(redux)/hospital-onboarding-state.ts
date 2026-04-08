import { HospitalOnboardingMaterial } from "@/utils/interfaces/hospital-onboarding";
import type { UserData } from "@/utils/interfaces/users";

export interface HospitalOnboardingState {
  items: HospitalOnboardingMaterial[];
  selectedIds: string[];
  isSelecting: boolean;
}

export const initialState: HospitalOnboardingState = {
  items: [],
  selectedIds: [],
  isSelecting: false,
};
