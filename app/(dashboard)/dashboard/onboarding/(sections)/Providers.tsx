"use client";

import { type ReactNode, useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { setInviteTokens } from "@/app/(dashboard)/dashboard/onboarding/(redux)/invite-tokens-slice";
import type { IInviteToken } from "@/utils/interfaces/invite-tokens";

export default function Providers({
  children,
  tokens,
}: {
  children: ReactNode;
  tokens: IInviteToken[];
}) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setInviteTokens(tokens));
  }, [dispatch, tokens]);

  return <>{children}</>;
}
