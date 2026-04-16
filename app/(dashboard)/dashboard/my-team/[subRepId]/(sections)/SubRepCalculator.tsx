"use client";

import { useAppSelector } from "@/store/hooks";
import CommissionCalculator from "@/app/(dashboard)/dashboard/commissions/(sections)/CommissionCalculator";

export default function SubRepCalculator() {
  const detail = useAppSelector((s) => s.subRepDetail.detail);
  if (!detail) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-[var(--navy)]">Commission Calculator</h2>
      <CommissionCalculator lockedRepId={detail.id} />
    </section>
  );
}
