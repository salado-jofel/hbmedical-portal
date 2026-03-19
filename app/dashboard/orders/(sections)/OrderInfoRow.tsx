// Pure presentational — no hooks, no "use client" needed,
// but kept for consistency with the rest of the (sections) folder.

export function OrderInfoRow({
  icon: Icon,
  text,
  primary = false,
}: {
  icon: React.ElementType;
  text: string;
  primary?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
          primary ? "bg-[#2db0b0]/10" : "bg-slate-100"
        }`}
      >
        <Icon
          className={`w-3.5 h-3.5 ${
            primary ? "text-[#2db0b0]" : "text-slate-400"
          }`}
        />
      </div>
      <span
        className={`truncate ${
          primary
            ? "text-sm font-medium text-slate-700"
            : "text-xs text-slate-500"
        }`}
      >
        {text}
      </span>
    </div>
  );
}
