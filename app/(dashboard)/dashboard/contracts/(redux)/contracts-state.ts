import { ContractMaterial } from "@/utils/interfaces/contracts";

export interface ContractsState {
  items: ContractMaterial[];
  selectedIds: string[];
  isSelecting: boolean;
}

export const initialState: ContractsState = {
  items: [],
  selectedIds: [],
  isSelecting: false,
};
