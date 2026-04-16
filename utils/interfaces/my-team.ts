export interface SubRep {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  role: string;
  accountCount: number;
  orderCount: number;
  revenue: number;
  commissionRate: number;
  overridePercent: number;
  commissionEarned: number;
}

export interface IRepTreeNode {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  status: string | null;
  accountCount: number;
  orderCount: number;
  commissionEarned: number;
  commissionRate: number;
  overridePercent: number;
  children: IRepTreeNode[];
}

export interface ICommissionHistoryRow {
  id: string;
  period: string;
  commission_amount: number;
  adjustment: number;
  final_amount: number;
  your_override_amount: number | null;
  status: string;
}

export interface ISubRepDetail {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  currentPeriod: string;
  actualRevenue: number;
  paidOrders: number;
  commissionEarned: number;
  avgOrderValue: number;
  pipelineRevenue: number;
  overrideEarnedThisPeriod: number | null;
  commissionRate: number;
  overridePercent: number;
  quota: number | null;
  attainmentPct: number | null;
  history: ICommissionHistoryRow[];
  accounts: unknown[];
}
