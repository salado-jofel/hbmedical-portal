import { ContractMaterial } from "@/app/(interfaces)/contracts";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { initialState } from "./contracts-state";



const contractsSlice = createSlice({
  name: "contracts",
  initialState,
  reducers: {
    setContractMaterials(state, action: PayloadAction<ContractMaterial[]>) {
      state.items = action.payload;
    },
  },
});

export const { setContractMaterials } = contractsSlice.actions;
export default contractsSlice.reducer;
