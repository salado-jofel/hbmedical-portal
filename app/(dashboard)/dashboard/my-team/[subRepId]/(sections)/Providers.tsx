"use client";

import { type ReactNode, useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { setSubRepDetail } from "../../(redux)/sub-rep-detail-slice";
import {
  setRates,
  setSummary,
} from "@/app/(dashboard)/dashboard/commissions/(redux)/commissions-slice";
import type { ISubRepDetail } from "@/utils/interfaces/my-team";
import type { ICommissionRate, ICommissionSummary } from "@/utils/interfaces/commissions";

export default function Providers({
  children,
  detail,
  rates,
  summary,
}: {
  children: ReactNode;
  detail: ISubRepDetail;
  rates: ICommissionRate[];
  summary: ICommissionSummary;
}) {
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(setSubRepDetail(detail));
    dispatch(setRates(rates));
    dispatch(setSummary(summary));
  }, [dispatch, detail, rates, summary]);
  return <>{children}</>;
}
