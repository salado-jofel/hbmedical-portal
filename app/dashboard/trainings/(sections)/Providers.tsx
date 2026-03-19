"use client";

import { useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { setTrainingMaterials } from "../(redux)/trainings-slice";
import { TrainingMaterial } from "@/app/(interfaces)/trainings";

export default function Providers({
  children,
  trainings,
}: {
  children: React.ReactNode;
  trainings: TrainingMaterial[];
}) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setTrainingMaterials(trainings));
  }, [trainings, dispatch]);

  return <>{children}</>;
}
