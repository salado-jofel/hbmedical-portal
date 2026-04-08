"use client";

import { useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { setUser } from "../(redux)/dashboard-slice";

import type { UserData } from "@/utils/interfaces/users";

export default function Providers({
  children,
  userData,
}: {
  children: React.ReactNode;
  userData: UserData | null;
}) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!userData) return;

    dispatch(
      setUser({
        name:     userData.name ?? "",
        email:    userData.email ?? "",
        initials: userData.initials ?? "",
        role:     userData.role ?? null,
        isSubRep: userData.isSubRep ?? false,
        userId:   userData.userId ?? "",
      }),
    );
  }, [dispatch, userData]);

  return <>{children}</>;
}
