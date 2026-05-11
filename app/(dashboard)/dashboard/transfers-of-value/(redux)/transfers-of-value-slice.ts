import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  IValueReport,
  IValueTransferEntry,
  IValueGroupMealEntry,
  IValueSampleEntry,
} from "@/utils/interfaces/value-transfers";
import { initialState } from "./transfers-of-value-state";

const slice = createSlice({
  name: "transfersOfValue",
  initialState,
  reducers: {
    setValueReports(state, action: PayloadAction<IValueReport[]>) {
      state.reports = action.payload;
    },
    addValueReportToStore(state, action: PayloadAction<IValueReport>) {
      state.reports.unshift(action.payload);
    },
    updateValueReportInStore(state, action: PayloadAction<IValueReport>) {
      const idx = state.reports.findIndex((r) => r.id === action.payload.id);
      if (idx !== -1) state.reports[idx] = action.payload;
      if (state.activeReport?.id === action.payload.id) {
        state.activeReport = action.payload;
      }
    },
    removeValueReportFromStore(state, action: PayloadAction<string>) {
      state.reports = state.reports.filter((r) => r.id !== action.payload);
      if (state.activeReport?.id === action.payload) {
        state.activeReport = null;
      }
    },

    setActiveValueReport(state, action: PayloadAction<IValueReport | null>) {
      state.activeReport = action.payload;
    },

    setTransferEntries(state, action: PayloadAction<IValueTransferEntry[]>) {
      state.transferEntries = action.payload;
    },
    addTransferEntryToStore(state, action: PayloadAction<IValueTransferEntry>) {
      state.transferEntries.unshift(action.payload);
    },
    updateTransferEntryInStore(state, action: PayloadAction<IValueTransferEntry>) {
      const idx = state.transferEntries.findIndex((e) => e.id === action.payload.id);
      if (idx !== -1) state.transferEntries[idx] = action.payload;
    },
    removeTransferEntryFromStore(state, action: PayloadAction<string>) {
      state.transferEntries = state.transferEntries.filter((e) => e.id !== action.payload);
    },

    setGroupMealEntries(state, action: PayloadAction<IValueGroupMealEntry[]>) {
      state.groupMealEntries = action.payload;
    },
    addGroupMealEntryToStore(state, action: PayloadAction<IValueGroupMealEntry>) {
      state.groupMealEntries.unshift(action.payload);
    },
    updateGroupMealEntryInStore(state, action: PayloadAction<IValueGroupMealEntry>) {
      const idx = state.groupMealEntries.findIndex((e) => e.id === action.payload.id);
      if (idx !== -1) state.groupMealEntries[idx] = action.payload;
    },
    removeGroupMealEntryFromStore(state, action: PayloadAction<string>) {
      state.groupMealEntries = state.groupMealEntries.filter((e) => e.id !== action.payload);
    },

    setSampleEntries(state, action: PayloadAction<IValueSampleEntry[]>) {
      state.sampleEntries = action.payload;
    },
    addSampleEntryToStore(state, action: PayloadAction<IValueSampleEntry>) {
      state.sampleEntries.unshift(action.payload);
    },
    updateSampleEntryInStore(state, action: PayloadAction<IValueSampleEntry>) {
      const idx = state.sampleEntries.findIndex((e) => e.id === action.payload.id);
      if (idx !== -1) state.sampleEntries[idx] = action.payload;
    },
    removeSampleEntryFromStore(state, action: PayloadAction<string>) {
      state.sampleEntries = state.sampleEntries.filter((e) => e.id !== action.payload);
    },
  },
});

export const {
  setValueReports,
  addValueReportToStore,
  updateValueReportInStore,
  removeValueReportFromStore,
  setActiveValueReport,
  setTransferEntries,
  addTransferEntryToStore,
  updateTransferEntryInStore,
  removeTransferEntryFromStore,
  setGroupMealEntries,
  addGroupMealEntryToStore,
  updateGroupMealEntryInStore,
  removeGroupMealEntryFromStore,
  setSampleEntries,
  addSampleEntryToStore,
  updateSampleEntryInStore,
  removeSampleEntryFromStore,
} = slice.actions;

export default slice.reducer;
