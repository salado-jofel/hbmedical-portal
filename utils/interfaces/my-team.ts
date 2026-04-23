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
  ordersInPeriod: number;
  deliveredInPeriod: number;
  commissionInPeriod: number;
}

export interface IRepListRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  status: string | null;
  isDirect: boolean;
  accountCount: number;
  ordersInPeriod: number;
  deliveredInPeriod: number;
  commissionInPeriod: number;
  commissionRate: number;
  overridePercent: number;
}

export interface IMyTeamKpis {
  totalReps: number;
  repsDirect: number;
  repsIndirect: number;
  totalAccounts: number;
  accountsDirect: number;
  accountsViaTeam: number;
  totalOrders: number;
  ordersDelivered: number;
  deliveredRevenue: number;
  deliveredOrdersConfirmed: number;
  activeReps: number;
  activeRepsTotalDenominator: number;
}

export interface ICommissionHistoryRow {
  id: string;
  period: string;
  order_id: string | null;
  order_number: string | null;
  commission_amount: number;
  adjustment: number;
  final_amount: number;
  your_override_amount: number | null;
  status: string;
  created_at: string;
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
