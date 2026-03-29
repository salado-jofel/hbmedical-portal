import { HospitalOnboardingMaterial } from "@/utils/interfaces/hospital-onboarding";
import { UserData } from "../../(services)/actions";

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
