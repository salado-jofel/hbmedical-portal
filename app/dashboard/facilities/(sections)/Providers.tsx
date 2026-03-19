"use client";

import { Facility } from "@/app/(interfaces)/facility";
import { useAppDispatch } from "@/store/hooks";
import { ReactNode, useEffect } from "react";
import { setFacilities } from "../(redux)/facilities-slice";

export default function Providers({
  children,
  facilities,
}: {
  children: ReactNode;
  facilities: Facility[];
}) {
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(setFacilities(facilities));
  }, [facilities]);
  return <>{children}</>;
}
