"use client";

import type { Facility } from "@/app/(interfaces)/facility";
import { useAppDispatch } from "@/store/hooks";
import { type ReactNode, useEffect } from "react";
import { setFacility } from "../(redux)/facility-slice";

export default function Providers({
  children,
  facility,
}: {
  children: ReactNode;
  facility: Facility;
}) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setFacility(facility));
  }, [dispatch, facility, ]);

  return <>{children}</>;
}
