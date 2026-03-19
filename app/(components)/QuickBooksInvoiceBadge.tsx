"use client";

import { FileText, CheckCircle2, XCircle, DollarSign } from "lucide-react";

interface Props {
  orderId: string;
  orderDocNumber: string;
  qbInvoiceId?: string | null;
  qbInvoiceStatus?: string | null;
  facilityQbCustomerId?: string | null;
  productQbItemId?: string | null;
}

export default function QuickBooksInvoiceBadge({
  qbInvoiceId,
  qbInvoiceStatus,
  facilityQbCustomerId,
  productQbItemId,
}: Props) {
  // ── Invoice exists — show status badge ──────────────────────────
  if (qbInvoiceId) {
    if (qbInvoiceStatus === "paid") {
      return (
        <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
          <DollarSign className="w-3 h-3" />
          Paid
        </span>
      );
    }

    if (qbInvoiceStatus === "void") {
      return (
        <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full font-medium">
          <XCircle className="w-3 h-3" />
          Voided
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
        <FileText className="w-3 h-3" />
        Invoice #{qbInvoiceId}
      </span>
    );
  }

  // ── No invoice yet ───────────────────────────────────────────────
  const canSync = facilityQbCustomerId && productQbItemId;

  if (!canSync) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-300">
        <XCircle className="w-3.5 h-3.5" />
        QB not ready
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-amber-500 font-medium">
      <CheckCircle2 className="w-3.5 h-3.5" />
      Pending sync
    </span>
  );
}
