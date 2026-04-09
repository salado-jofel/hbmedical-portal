import type { ICommissionRate, ICommission, IPayout, ICommissionSummary } from "@/utils/interfaces/commissions";

export interface CommissionsState {
  rates:       ICommissionRate[];
  commissions: ICommission[];
  payouts:     IPayout[];
  summary:     ICommissionSummary | null;
}

export const initialState: CommissionsState = {
  rates:       [],
  commissions: [],
  payouts:     [],
  summary:     null,
};
