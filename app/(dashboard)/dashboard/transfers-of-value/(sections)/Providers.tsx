"use client";

import { type ReactNode, useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { setValueReports } from "../(redux)/transfers-of-value-slice";
import type { IValueReport } from "@/utils/interfaces/value-transfers";

export default function Providers({
  children,
  reports,
}: {
  children: ReactNode;
  reports: IValueReport[];
}) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setValueReports(reports));
  }, [dispatch, reports]);

  return <>{children}</>;
}
