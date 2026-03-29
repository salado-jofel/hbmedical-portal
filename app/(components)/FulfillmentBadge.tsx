import { BadgeCheck, Truck } from "lucide-react";

export function FulfillmentBadge({
  label,
  delivered,
}: {
  label: string;
  delivered: boolean;
}) {
  if (delivered) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
        <BadgeCheck className="h-3.5 w-3.5" />
        Delivered
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
      <Truck className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
