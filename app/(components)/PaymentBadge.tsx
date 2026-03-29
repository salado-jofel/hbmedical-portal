import {
  CheckCircle2,
  FileText,
  DollarSign,
  Clock3,
  CreditCard,
} from "lucide-react";

export function PaymentBadge({ status }: { status?: string | null }) {
  if (status === "paid") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Paid
      </span>
    );
  }

  if (status === "invoice_sent") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
        <FileText className="h-3.5 w-3.5" />
        Invoice Sent
      </span>
    );
  }

  if (status === "partially_paid") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
        <DollarSign className="h-3.5 w-3.5" />
        Partially Paid
      </span>
    );
  }

  if (status === "overdue") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
        <Clock3 className="h-3.5 w-3.5" />
        Overdue
      </span>
    );
  }

  if (status === "payment_failed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
        <CreditCard className="h-3.5 w-3.5" />
        Payment Failed
      </span>
    );
  }

  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
        <Clock3 className="h-3.5 w-3.5" />
        Pending
      </span>
    );
  }

  if (status === "canceled") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
        <Clock3 className="h-3.5 w-3.5" />
        Canceled
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
      <Clock3 className="h-3.5 w-3.5" />
      Unpaid
    </span>
  );
}
