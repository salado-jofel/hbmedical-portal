"use client";

import { type ReactNode, useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { setSummary, setQuotas } from "../(redux)/rep-performance-slice";
import type { IRepPerformanceSummary, IQuota } from "@/utils/interfaces/quotas";

export default function Providers({
  children,
  summary,
  quotas,
}: {
  children: ReactNode;
  summary:  IRepPerformanceSummary | null;
  quotas:   IQuota[];
}) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setSummary(summary));
    dispatch(setQuotas(quotas));
  }, [dispatch, summary, quotas]);

  return <>{children}</>;
}
