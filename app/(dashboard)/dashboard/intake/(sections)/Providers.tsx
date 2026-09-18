"use client";

import { useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { setIntake } from "../(redux)/intake-slice";
import type { IIntakeDocument } from "@/utils/interfaces/intake";

interface Props {
  intake: IIntakeDocument[];
  children: React.ReactNode;
}

export function IntakeProviders({ intake, children }: Props) {
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(setIntake(intake));
  }, [dispatch, intake]);
  return <>{children}</>;
}
