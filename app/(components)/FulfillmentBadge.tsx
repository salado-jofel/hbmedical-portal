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
      <span className="inline-flex items-center gap-1 rounded-full bg-[#EFF6FF] px-2 py-0.5 text-xs font-medium text-[#15689E]">
        <BadgeCheck className="h-3.5 w-3.5" />
        Delivered
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#F1F5F9] px-2 py-0.5 text-xs font-medium text-[#64748B]">
      <Truck className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
