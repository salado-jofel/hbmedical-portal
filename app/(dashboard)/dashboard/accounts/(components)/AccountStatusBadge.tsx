import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/utils";
import type { AccountStatus } from "@/utils/interfaces/accounts";

const accountStatusBadgeVariants = cva(
  "inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      status: {
        active: "bg-[var(--green-lt)] text-[var(--green)]",
        prospect: "bg-[var(--gold-lt)] text-[var(--gold)]",
        inactive: "bg-[var(--border)] text-[var(--text2)]",
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
  active: "bg-[var(--green)]",
  prospect: "bg-[var(--gold)]",
  inactive: "bg-[var(--text3)]",
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
