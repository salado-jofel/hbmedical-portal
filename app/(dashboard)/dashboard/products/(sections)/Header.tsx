"use client";

import { useAppSelector } from "@/store/hooks";
import { DashboardHeader } from "@/app/(components)/DashboardHeader";

export default function Header() {
  const total = useAppSelector((state) => state.products.items.length);
  return (
    <DashboardHeader
      title="Products"
      description={`${total} product${total !== 1 ? "s" : ""} across all facilities`}
    />
  );
}
