"use client";

import { useAppDispatch } from "@/store/hooks";
import { type ReactNode, useEffect } from "react";
import { setIvrs } from "../(redux)/ivrs-slice";
import type { IStandaloneIvr } from "@/utils/interfaces/standalone-ivrs";

export function IvrsProviders({
  children,
  ivrs,
}: {
  children: ReactNode;
  ivrs: IStandaloneIvr[];
}) {
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(setIvrs(ivrs));
  }, [dispatch, ivrs]);
  return <>{children}</>;
}
