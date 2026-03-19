"use client";

import { useAppSelector } from "@/store/hooks";
import { MaterialCard } from "@/app/(components)/MaterialCard";
import { getSignedDownloadUrl } from "../(services)/actions";
import { MaterialsGrid } from "@/app/(components)/MaterialGrid";

export default function ContractCards() {
  const items = useAppSelector((state) => state.contracts.items);

  return (
    <MaterialsGrid
      isEmpty={items.length === 0}
      emptyMessage="No contracts available"
      emptyDescription="Contracts will appear here once added"
    >
      {items.map((card) => (
        <MaterialCard
          key={card.id}
          title={card.title}
          description={card.description}
          tag={card.tag}
          fileUrl={card.file_url}
          onDownload={getSignedDownloadUrl}
        />
      ))}
    </MaterialsGrid>
  );
}
