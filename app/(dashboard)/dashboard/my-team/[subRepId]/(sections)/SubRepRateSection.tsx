"use client";

import { useAppSelector } from "@/store/hooks";
import RateManagement from "@/app/(dashboard)/dashboard/commissions/(sections)/RateManagement";

export default function SubRepRateSection() {
  const detail = useAppSelector((s) => s.subRepDetail.detail);
  if (!detail) return null;

  const repName = `${detail.first_name ?? ""} ${detail.last_name ?? ""}`.trim() || "Sub-rep";

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-[var(--navy)]">Commission Rate</h2>
      <RateManagement reps={[{ id: detail.id, name: repName }]} />
    </section>
  );
}
