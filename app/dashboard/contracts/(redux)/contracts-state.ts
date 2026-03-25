import { ContractMaterial } from "@/lib/interfaces/contracts";

export interface ContractsState {
  items: ContractMaterial[];
}

export const initialState: ContractsState = {
  items: [],
};
