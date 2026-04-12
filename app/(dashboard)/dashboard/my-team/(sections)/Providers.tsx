"use client";

import { type ReactNode, useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { setMyTeam } from "../(redux)/my-team-slice";
import type { SubRep } from "../(redux)/my-team-slice";

export default function Providers({
  children,
  subReps,
}: {
  children: ReactNode;
  subReps: SubRep[];
}) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setMyTeam(subReps));
  }, [dispatch, subReps]);

  return <>{children}</>;
}
