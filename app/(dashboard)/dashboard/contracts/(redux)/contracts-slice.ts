import { ContractMaterial } from "@/utils/interfaces/contracts";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { initialState } from "./contracts-state";

const contractsSlice = createSlice({
  name: "contracts",
  initialState,
  reducers: {
    setContractMaterials(state, action: PayloadAction<ContractMaterial[]>) {
      state.items = action.payload;
      state.selectedIds = [];
      state.isSelecting = false;
    },
    toggleSelectContractItem(state, action: PayloadAction<string>) {
      const id = action.payload;
      const idx = state.selectedIds.indexOf(id);
      if (idx === -1) {
        state.selectedIds.push(id);
      } else {
        state.selectedIds.splice(idx, 1);
      }
    },
    selectAllContractItems(state) {
      state.selectedIds = state.items.map((item) => item.id);
    },
    clearContractSelection(state) {
      state.selectedIds = [];
    },
    setContractSelecting(state, action: PayloadAction<boolean>) {
      state.isSelecting = action.payload;
      if (!action.payload) state.selectedIds = [];
    },
  },
});

export const {
  setContractMaterials,
  toggleSelectContractItem,
  selectAllContractItems,
  clearContractSelection,
  setContractSelecting,
} = contractsSlice.actions;
export default contractsSlice.reducer;
