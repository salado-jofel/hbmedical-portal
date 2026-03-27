"use client";

import { useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { setUser } from "./(redux)/dashboard-slice";

type UserData = {
  name: string;
  email: string;
  initials: string;
  role: "sales_representative" | "doctor" | null;
};

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
        name: userData.name ?? "",
        email: userData.email ?? "",
        initials: userData.initials ?? "",
        role: userData.role ?? null,
      }),
    );
  }, [dispatch, userData]);

  return <>{children}</>;
}
