export function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-shadow">
      <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-[#15689E]" />
      </div>
      <p className="text-2xl font-bold text-[#0F172A]">{value}</p>
      <p className="text-xs text-[#94A3B8] uppercase tracking-wide mt-1">{label}</p>
    </div>
  );
}
