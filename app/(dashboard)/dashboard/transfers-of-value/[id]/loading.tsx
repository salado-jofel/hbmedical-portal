export default function Loading() {
  return (
    <div className="p-4 md:p-8 mx-auto space-y-6 animate-pulse">
      <div className="h-6 w-24 bg-[#E8EFF5] rounded" />
      <div className="h-10 w-72 bg-[#E8EFF5] rounded" />
      <div className="h-10 w-full bg-[#E8EFF5] rounded" />
      <div className="h-64 bg-[#E8EFF5] rounded-lg" />
    </div>
  );
}
