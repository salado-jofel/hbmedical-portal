import { ContractMaterial } from "@/utils/interfaces/contracts";

export interface ContractsState {
  items: ContractMaterial[];
}

export const initialState: ContractsState = {
  items: [],
};
