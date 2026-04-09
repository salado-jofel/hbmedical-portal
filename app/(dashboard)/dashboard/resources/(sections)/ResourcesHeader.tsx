"use client";

import { useAppSelector } from "@/store/hooks";
import { isAdmin as checkIsAdmin } from "@/utils/helpers/role";
import { SectionHeader } from "@/app/(components)/SectionHeader";
import { ResourcesUploadButton } from "../(components)/ResourcesUploadButton";

export function ResourcesHeader({
  activeTab,
  totalCount,
}: {
  activeTab: string;
  totalCount: number;
}) {
  const isAdmin = checkIsAdmin(useAppSelector((state) => state.dashboard.role));

  return (
    <SectionHeader
      title="Resources"
      subtitle={`${totalCount} resource${totalCount !== 1 ? "s" : ""} across all categories`}
      action={isAdmin ? <ResourcesUploadButton activeTab={activeTab} /> : undefined}
    />
  );
}
