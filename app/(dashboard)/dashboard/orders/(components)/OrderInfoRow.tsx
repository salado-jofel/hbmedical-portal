import type { ElementType } from "react";

export function OrderInfoRow({
  icon: Icon,
  text,
  primary = false,
}: {
  icon: ElementType;
  text: string;
  primary?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
          primary ? "bg-[#EFF6FF]" : "bg-[#F1F5F9]"
        }`}
      >
        <Icon
          className={`w-3.5 h-3.5 ${
            primary ? "text-[#15689E]" : "text-[#94A3B8]"
          }`}
        />
      </div>

      <span
        className={`truncate ${
          primary
            ? "text-sm font-medium text-[#0F172A]"
            : "text-xs text-[#64748B]"
        }`}
      >
        {text}
      </span>
    </div>
  );
}
