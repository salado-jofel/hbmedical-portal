import { ContractMaterial } from "@/app/(interfaces)/contracts";

export interface ContractsState {
  items: ContractMaterial[];
}

export const initialState: ContractsState = {
  items: [],
};


