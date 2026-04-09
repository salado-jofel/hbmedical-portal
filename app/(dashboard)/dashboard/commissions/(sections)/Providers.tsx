"use client";

import { type ReactNode, useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { setRates, setCommissions, setPayouts, setSummary } from "../(redux)/commissions-slice";
import type { ICommissionRate, ICommission, IPayout, ICommissionSummary } from "@/utils/interfaces/commissions";

export default function Providers({
  children,
  rates,
  commissions,
  payouts,
  summary,
}: {
  children:    ReactNode;
  rates:       ICommissionRate[];
  commissions: ICommission[];
  payouts:     IPayout[];
  summary:     ICommissionSummary | null;
}) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setRates(rates));
    dispatch(setCommissions(commissions));
    dispatch(setPayouts(payouts));
    dispatch(setSummary(summary));
  }, [dispatch, rates, commissions, payouts, summary]);

  return <>{children}</>;
}
