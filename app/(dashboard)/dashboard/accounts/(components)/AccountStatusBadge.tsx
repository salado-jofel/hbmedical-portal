import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/utils";
import type { AccountStatus } from "@/utils/interfaces/accounts";

const accountStatusBadgeVariants = cva(
  "inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 rounded-full border border-transparent px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      status: {
        active: "bg-emerald-50 text-emerald-700 border-emerald-200",
        prospect: "bg-blue-50 text-[#15689E] border-blue-200",
        inactive: "bg-zinc-100 text-zinc-500 border-zinc-200",
      },
    },
    defaultVariants: {
      status: "inactive",
    },
  },
);

const STATUS_LABELS: Record<AccountStatus, string> = {
  active: "Active",
  prospect: "Prospect",
  inactive: "Inactive",
};

const STATUS_DOTS: Record<AccountStatus, string> = {
  active: "bg-emerald-500",
  prospect: "bg-[#15689E]",
  inactive: "bg-zinc-400",
};

interface AccountStatusBadgeProps
  extends VariantProps<typeof accountStatusBadgeVariants> {
  status: AccountStatus;
  className?: string;
}

export function AccountStatusBadge({ status, className }: AccountStatusBadgeProps) {
  return (
    <span className={cn(accountStatusBadgeVariants({ status }), className)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_DOTS[status])} />
      {STATUS_LABELS[status]}
    </span>
  );
}
