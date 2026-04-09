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
      <span className="inline-flex items-center gap-1 rounded-full bg-[#EFF6FF] px-2 py-0.5 text-xs font-medium text-[var(--navy)]">
        <BadgeCheck className="h-3.5 w-3.5" />
        Delivered
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--border)] px-2 py-0.5 text-xs font-medium text-[var(--text2)]">
      <Truck className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
