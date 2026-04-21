"use client";

import { useState } from "react";
import { useAppSelector } from "@/store/hooks";
import { ResourcesHeader } from "./ResourcesHeader";
import ResourcesContent from "./ResourcesContent";
import type {
  SignedContractRow,
  RepOfficeOption,
  SalesRepOption,
} from "../(services)/signed-contracts-actions";

export default function ResourcesView({
  signedContracts,
  repOffices,
  salesReps,
}: {
  signedContracts: SignedContractRow[];
  repOffices: RepOfficeOption[];
  salesReps: SalesRepOption[];
}) {
  const [activeTab, setActiveTab] = useState("All");

  const marketingCount = useAppSelector((s) => s.marketing.items.length);
  const contractsCount = useAppSelector((s) => s.contracts.items.length);
  const trainingsCount = useAppSelector((s) => s.trainings.items.length);
  const onboardingCount = useAppSelector((s) => s.hospitalOnboarding.items.length);
  const totalCount = marketingCount + contractsCount + trainingsCount + onboardingCount;

  return (
    <>
      <ResourcesHeader activeTab={activeTab} totalCount={totalCount} />
      <ResourcesContent
        activeTab={activeTab}
        onTabChange={setActiveTab}
        signedContracts={signedContracts}
        repOffices={repOffices}
        salesReps={salesReps}
      />
    </>
  );
}
