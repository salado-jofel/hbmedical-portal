import type {
  IValueReport,
  IValueTransferEntry,
  IValueGroupMealEntry,
  IValueSampleEntry,
} from "@/utils/interfaces/value-transfers";

export interface TransfersOfValueState {
  reports: IValueReport[];

  /** Loaded only when the detail page is open. */
  activeReport: IValueReport | null;
  transferEntries: IValueTransferEntry[];
  groupMealEntries: IValueGroupMealEntry[];
  sampleEntries: IValueSampleEntry[];
}

export const initialState: TransfersOfValueState = {
  reports: [],
  activeReport: null,
  transferEntries: [],
  groupMealEntries: [],
  sampleEntries: [],
};
