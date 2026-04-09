import type { IRepPerformanceSummary, IQuota } from "@/utils/interfaces/quotas";

export interface RepPerformanceState {
  summary: IRepPerformanceSummary | null;
  quotas: IQuota[];
}

export const initialState: RepPerformanceState = {
  summary: null,
  quotas: [],
};
