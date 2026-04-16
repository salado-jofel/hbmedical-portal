import type { AccountTier } from "@/utils/interfaces/accounts";

export interface TierInput {
  id: string;
  delivered_revenue: number;
}

export function assignTiers<T extends TierInput>(accounts: T[]): Array<T & { tier: AccountTier }> {
  if (accounts.length === 0) return [];

  const hasRevenue = accounts.filter((a) => (a.delivered_revenue ?? 0) > 0);
  const zeroRevenue = accounts.filter((a) => (a.delivered_revenue ?? 0) <= 0);

  const sorted = [...hasRevenue].sort(
    (a, b) => (b.delivered_revenue ?? 0) - (a.delivered_revenue ?? 0),
  );

  const aCount = Math.ceil(sorted.length * 0.20);
  const bCount = Math.ceil(sorted.length * 0.30);

  const tierById = new Map<string, AccountTier>();
  sorted.forEach((a, i) => {
    if (i < aCount) tierById.set(a.id, "A");
    else if (i < aCount + bCount) tierById.set(a.id, "B");
    else tierById.set(a.id, "C");
  });
  for (const a of zeroRevenue) tierById.set(a.id, "C");

  return accounts.map((a) => ({ ...a, tier: tierById.get(a.id) ?? "C" }));
}
