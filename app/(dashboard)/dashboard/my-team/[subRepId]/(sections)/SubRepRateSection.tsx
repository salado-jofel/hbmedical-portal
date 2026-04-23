"use client";

import { useAppSelector } from "@/store/hooks";
import RateManagement from "@/app/(dashboard)/dashboard/commissions/(sections)/RateManagement";

interface SubRepRateSectionProps {
  hideOverride?: boolean;
}

export default function SubRepRateSection({ hideOverride = false }: SubRepRateSectionProps) {
  const detail = useAppSelector((s) => s.subRepDetail.detail);
  if (!detail) return null;

  const repName = `${detail.first_name ?? ""} ${detail.last_name ?? ""}`.trim() || "Sub-rep";

  return (
    <RateManagement
      reps={[{ id: detail.id, name: repName }]}
      lockedRepId={detail.id}
      hideOverride={hideOverride}
    />
  );
}
