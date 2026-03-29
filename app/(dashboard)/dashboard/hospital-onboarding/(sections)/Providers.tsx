"use client";

import { useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import type { HospitalOnboardingMaterial } from "@/utils/interfaces/hospital-onboarding";
import { setHospitalOnboardingMaterials } from "../(redux)/hospital-onboarding-slice";

export default function Providers({
  children,
  hospitalOnboardings,
}: {
  children: React.ReactNode;
  hospitalOnboardings: HospitalOnboardingMaterial[];
}) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setHospitalOnboardingMaterials(hospitalOnboardings));
  }, [hospitalOnboardings, dispatch]);

  return <>{children}</>;
}
