import Link from "next/link";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function QuickLogBanner() {
  return (
    <div className="mb-5 flex items-center gap-4 rounded-[var(--r)] border-[1.5px] border-[var(--teal-mid)] bg-[var(--teal-lt)] px-5 py-[1.1rem]">
      <Zap className="h-5 w-5 shrink-0 text-[var(--teal)]" strokeWidth={2} />
      <div className="flex-1">
        <p className="text-[14px] font-semibold text-[var(--teal)]">
          Log a sale or activity to boost your numbers
        </p>
        <p className="mt-0.5 text-[12px] text-[var(--teal)] opacity-70">
          Commissions auto-calculate when orders are paid
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="border-[var(--teal-mid)] bg-transparent text-[var(--teal)] hover:bg-[var(--teal)]/10 text-[12px]"
        >
          <Link href="/dashboard/accounts">View Accounts</Link>
        </Button>
        <Button
          asChild
          size="sm"
          className="bg-[var(--teal)] text-white hover:bg-[var(--teal)]/80 text-[12px]"
        >
          <Link href="/dashboard/orders">View Orders</Link>
        </Button>
      </div>
    </div>
  );
}
