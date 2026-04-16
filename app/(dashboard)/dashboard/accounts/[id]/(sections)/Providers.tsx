"use client";

import { type ReactNode, useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { setAccounts } from "@/app/(dashboard)/dashboard/accounts/(redux)/accounts-slice";
import { setContacts } from "@/app/(dashboard)/dashboard/(redux)/contacts-slice";
import { setActivities } from "@/app/(dashboard)/dashboard/(redux)/activities-slice";
import type { IAccount } from "@/utils/interfaces/accounts";
import type { IContact } from "@/utils/interfaces/contacts";
import type { IActivity } from "@/utils/interfaces/activities";
import { withZeroMetrics } from "@/utils/helpers/accounts";

export default function Providers({
  children,
  account,
  contacts,
  activities,
}: {
  children: ReactNode;
  account: IAccount;
  contacts: IContact[];
  activities: IActivity[];
}) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setAccounts([withZeroMetrics(account)]));
    dispatch(setContacts(contacts));
    dispatch(setActivities(activities));
  }, [dispatch, account, contacts, activities]);

  return <>{children}</>;
}
