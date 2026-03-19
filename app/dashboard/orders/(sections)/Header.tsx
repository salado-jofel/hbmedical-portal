import { CreateOrderModal } from "./CreateOrderModal";

export default function Header() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-xl md:text-2xl font-bold text-slate-800">
          Orders Management
        </h1>
        <p className="text-slate-500 text-sm">Track and manage your orders</p>
      </div>
      {/* Button sits inline on sm+, below title on mobile */}
      <div className="shrink-0">
        <CreateOrderModal />
      </div>
    </div>
  );
}
