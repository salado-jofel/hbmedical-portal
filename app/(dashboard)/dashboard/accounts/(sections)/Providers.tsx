"use client";

import { type ReactNode, useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { setAccounts } from "@/app/(dashboard)/dashboard/accounts/(redux)/accounts-slice";
import type { IAccountWithMetrics } from "@/utils/interfaces/accounts";

export default function Providers({
  children,
  accounts,
}: {
  children: ReactNode;
  accounts: IAccountWithMetrics[];
}) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setAccounts(accounts));
  }, [dispatch, accounts]);

  return <>{children}</>;
}
