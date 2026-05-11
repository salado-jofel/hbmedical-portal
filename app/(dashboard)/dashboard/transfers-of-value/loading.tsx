export default function Loading() {
  return (
    <div className="p-4 md:p-8 mx-auto space-y-6 animate-pulse">
      <div className="h-8 w-64 bg-[#E8EFF5] rounded" />
      <div className="h-9 w-44 bg-[#E8EFF5] rounded self-end" />
      <div className="space-y-2">
        <div className="h-16 bg-[#E8EFF5] rounded-lg" />
        <div className="h-16 bg-[#E8EFF5] rounded-lg" />
        <div className="h-16 bg-[#E8EFF5] rounded-lg" />
      </div>
    </div>
  );
}
