import type { IIntakeDocument } from "@/utils/interfaces/intake";

export interface IntakeState {
  items: IIntakeDocument[];
  search: string;
}

export const initialState: IntakeState = {
  items: [],
  search: "",
};
