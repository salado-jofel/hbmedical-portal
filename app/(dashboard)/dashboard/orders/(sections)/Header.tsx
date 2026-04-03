import { CreateOrderModal } from "../(components)/CreateOrderModal";

export default function Header() {
  return (
    <div className="pb-5 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-[#0F172A]">Orders</h1>
        <p className="text-sm text-[#64748B] mt-1">Track and manage your orders</p>
      </div>
      <div className="shrink-0">
        <CreateOrderModal />
      </div>
    </div>
  );
}
