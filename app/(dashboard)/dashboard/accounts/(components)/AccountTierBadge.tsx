import { cn } from "@/utils/utils";
import type { AccountTier } from "@/utils/interfaces/accounts";

const TIER_STYLES: Record<AccountTier, string> = {
  A: "bg-[var(--green-lt)] text-[var(--green)]",
  B: "bg-[var(--gold-lt)]  text-[var(--gold)]",
  C: "bg-[#f1f5f9]         text-[var(--text3)]",
};

export function AccountTierBadge({
  tier,
  className,
}: {
  tier: AccountTier;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold",
        TIER_STYLES[tier],
        className,
      )}
      aria-label={`Tier ${tier}`}
    >
      {tier}
    </span>
  );
}
