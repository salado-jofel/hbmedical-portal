"use client";

import { useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { setContractMaterials } from "../(redux)/contracts-slice";
import { ContractMaterial } from "@/app/(interfaces)/contracts";

export default function Providers({
  children,
  contracts,
}: {
  children: React.ReactNode;
  contracts: ContractMaterial[];
}) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setContractMaterials(contracts));
  }, [contracts, dispatch]);

  return <>{children}</>;
}
