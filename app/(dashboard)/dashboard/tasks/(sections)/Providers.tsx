"use client";

import { type ReactNode, useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { setTasks } from "@/app/(dashboard)/dashboard/(redux)/tasks-slice";
import type { ITask } from "@/utils/interfaces/tasks";

export default function Providers({
  children,
  tasks,
}: {
  children: ReactNode;
  tasks: ITask[];
}) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setTasks(tasks));
  }, [dispatch, tasks]);

  return <>{children}</>;
}
