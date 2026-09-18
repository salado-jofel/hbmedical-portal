"use client";

import { useAppDispatch } from "@/store/hooks";
import { type ReactNode, useEffect } from "react";
import { setApprovers } from "../(redux)/approvers-slice";
import type { IExternalApprover } from "@/utils/interfaces/standalone-ivrs";

export function ApproversProviders({
  children,
  approvers,
}: {
  children: ReactNode;
  approvers: IExternalApprover[];
}) {
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(setApprovers(approvers));
  }, [dispatch, approvers]);
  return <>{children}</>;
}
