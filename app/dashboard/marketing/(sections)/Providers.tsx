"use client";

import { useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { setMarketingMaterials } from "../(redux)/marketing-slice";
import type { MarketingMaterial } from "@/app/(interfaces)/marketing";

export default function Providers({
  materials,
  children,
}: {
  materials: MarketingMaterial[];
  children: React.ReactNode;
}) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setMarketingMaterials(materials));
  }, [dispatch, materials]);

  return <>{children}</>;
}
