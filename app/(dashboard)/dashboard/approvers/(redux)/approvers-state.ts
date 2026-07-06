import type { IExternalApprover } from "@/utils/interfaces/standalone-ivrs";

export interface ApproversState {
  items: IExternalApprover[];
  search: string;
}

export const initialState: ApproversState = {
  items: [],
  search: "",
};
