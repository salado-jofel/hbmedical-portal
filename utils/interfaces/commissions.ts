export interface ICommissionRate {
  id:              string;
  repId:           string;
  repName:         string;
  setBy:           string;
  setByName:       string;
  ratePercent:     number;
  overridePercent: number;
  effectiveFrom:   string;
  effectiveTo:     string | null;
  createdAt:       string;
}

export interface ICommission {
  id:               string;
  orderId:          string;
  orderNumber:      string;
  repId:            string;
  repName:          string;
  type:             "direct" | "override";
  orderAmount:      number;
  ratePercent:      number;
  commissionAmount: number;
  adjustment:       number;
  finalAmount:      number | null;
  status:           "pending" | "approved" | "paid" | "void";
  payoutPeriod:     string | null;
  paidAt:           string | null;
  notes:            string | null;
  createdAt:        string;
}

export interface IPayout {
  id:          string;
  repId:       string;
  repName:     string;
  period:      string;
  totalAmount: number;
  status:      "draft" | "approved" | "paid";
  paidAt:      string | null;
  paidBy:      string | null;
  notes:       string | null;
  createdAt:   string;
}

export interface ICommissionRateFormState {
  success: boolean;
  error:   string | null;
  fieldErrors?: Partial<Record<"rep_id" | "rate_percent" | "override_percent", string>>;
}

export interface ICommissionSummary {
  totalEarned:   number;
  totalPending:  number;  // pending admin approval
  totalApproved: number;  // approved, awaiting next payout
  totalPaid:     number;
  currentRate:   number | null;
}
