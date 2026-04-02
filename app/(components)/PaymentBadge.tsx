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
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Paid
      </span>
    );
  }

  if (status === "invoice_sent") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        <FileText className="h-3.5 w-3.5" />
        Invoice Sent
      </span>
    );
  }

  if (status === "partially_paid") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        <DollarSign className="h-3.5 w-3.5" />
        Partially Paid
      </span>
    );
  }

  if (status === "overdue") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
        <Clock3 className="h-3.5 w-3.5" />
        Overdue
      </span>
    );
  }

  if (status === "payment_failed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
        <CreditCard className="h-3.5 w-3.5" />
        Payment Failed
      </span>
    );
  }

  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        <Clock3 className="h-3.5 w-3.5" />
        Pending
      </span>
    );
  }

  if (status === "canceled") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#F1F5F9] px-2 py-0.5 text-xs font-medium text-[#64748B]">
        <Clock3 className="h-3.5 w-3.5" />
        Canceled
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#F1F5F9] px-2 py-0.5 text-xs font-medium text-[#64748B]">
      <Clock3 className="h-3.5 w-3.5" />
      Unpaid
    </span>
  );
}
