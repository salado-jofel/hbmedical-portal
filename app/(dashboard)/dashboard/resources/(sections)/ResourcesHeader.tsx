"use client";

import { useAppSelector } from "@/store/hooks";
import { isAdmin as checkIsAdmin } from "@/utils/helpers/role";
import { PageHeader } from "@/app/(components)/PageHeader";
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
    <PageHeader
      title="Resources"
      subtitle={`${totalCount} resource${totalCount !== 1 ? "s" : ""} across all categories`}
      action={isAdmin ? <ResourcesUploadButton activeTab={activeTab} /> : undefined}
    />
  );
}
