"use client";

import { useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { setMarketingMaterials } from "../../marketing/(redux)/marketing-slice";
import { setContractMaterials } from "../../contracts/(redux)/contracts-slice";
import { setTrainingMaterials } from "../../trainings/(redux)/trainings-slice";
import { setHospitalOnboardingMaterials } from "../../hospital-onboarding/(redux)/hospital-onboarding-slice";
import type { MarketingMaterial } from "@/utils/interfaces/marketing";
import type { ContractMaterial } from "@/utils/interfaces/contracts";
import type { TrainingMaterial } from "@/utils/interfaces/trainings";
import type { HospitalOnboardingMaterial } from "@/utils/interfaces/hospital-onboarding";

export default function Providers({
  marketing,
  contracts,
  trainings,
  hospitalOnboarding,
  children,
}: {
  marketing: MarketingMaterial[];
  contracts: ContractMaterial[];
  trainings: TrainingMaterial[];
  hospitalOnboarding: HospitalOnboardingMaterial[];
  children: React.ReactNode;
}) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setMarketingMaterials(marketing));
    dispatch(setContractMaterials(contracts));
    dispatch(setTrainingMaterials(trainings));
    dispatch(setHospitalOnboardingMaterials(hospitalOnboarding));
  }, [dispatch, marketing, contracts, trainings, hospitalOnboarding]);

  return <>{children}</>;
}
