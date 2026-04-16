export interface IQuota {
  id: string;
  repId: string;
  repName: string;
  setBy: string;
  setByName: string;
  period: string;
  targetAmount: number;
  notes: string | null;
  createdAt: string;
}

export interface IQuotaFormState {
  success: boolean;
  error: string | null;
  fieldErrors?: {
    rep_id?: string;
    period?: string;
    target_amount?: string;
  };
}

export interface IRepPerformance {
  repId: string;
  repName: string;
  period: string;
  quota: number | null;
  actualRevenue: number;
  attainmentPct: number | null;
  totalOrders: number;
  paidOrders: number;
  commissionEarned: number;
  avgOrderValue: number;
}

export interface IRepPerformanceSummary {
  currentPeriod: string;
  myPerformance: IRepPerformance | null;
  subRepPerformance: IRepPerformance[];
  monthlyRevenue: Array<{ period: string; revenue: number }>;
  pipelineRevenue: number;
  oneYearProjectedRevenue: number;
  tierCounts: { A: number; B: number; C: number };
}
