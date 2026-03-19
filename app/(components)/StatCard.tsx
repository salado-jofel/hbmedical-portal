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
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-start justify-between shadow-sm">
      <div>
        <p className="text-xs text-slate-400 font-medium mb-2">{label}</p>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
      </div>
      <div className="p-2.5 bg-teal-50 rounded-lg">
        <Icon className="w-5 h-5 text-[#2db0b0]" />
      </div>
    </div>
  );
}
