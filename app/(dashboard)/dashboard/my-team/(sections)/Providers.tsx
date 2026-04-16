"use client";

import { type ReactNode, useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { setRows, setKpis } from "../(redux)/my-team-slice";
import type { IRepListRow, IMyTeamKpis } from "@/utils/interfaces/my-team";

export default function Providers({
  children,
  rows,
  kpis,
}: {
  children: ReactNode;
  rows: IRepListRow[];
  kpis: IMyTeamKpis;
}) {
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(setRows(rows));
    dispatch(setKpis(kpis));
  }, [dispatch, rows, kpis]);
  return <>{children}</>;
}
