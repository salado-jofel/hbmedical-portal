"use client";

import { type ReactNode, useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { setUsers } from "@/app/(dashboard)/dashboard/users/(redux)/users-slice";
import type { IUser } from "@/utils/interfaces/users";

export default function Providers({
  children,
  users,
}: {
  children: ReactNode;
  users: IUser[];
}) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setUsers(users));
  }, [dispatch, users]);

  return <>{children}</>;
}
