import { CreateOrderModal } from "./CreateOrderModal";
import type { Net30CreditStatus } from "@/lib/billing/net30";

type HeaderProps = {
  creditStatus: Net30CreditStatus;
};

export default function Header({ creditStatus }: HeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-slate-800 md:text-2xl">
          Orders Management
        </h1>
        <p className="text-sm text-slate-500">Track and manage your orders</p>
      </div>

      <div className="shrink-0">
        <CreateOrderModal
          disabled={creditStatus.blocked}
          disabledReason={creditStatus.reason}
        />
      </div>
    </div>
  );
}
