"use client";

import { type ReactNode, useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import {
  setActiveValueReport,
  setTransferEntries,
  setGroupMealEntries,
  setSampleEntries,
} from "../../(redux)/transfers-of-value-slice";
import type {
  IValueReport,
  IValueTransferEntry,
  IValueGroupMealEntry,
  IValueSampleEntry,
} from "@/utils/interfaces/value-transfers";

export default function Providers({
  children,
  report,
  transferEntries,
  groupMealEntries,
  sampleEntries,
}: {
  children: ReactNode;
  report: IValueReport;
  transferEntries: IValueTransferEntry[];
  groupMealEntries: IValueGroupMealEntry[];
  sampleEntries: IValueSampleEntry[];
}) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setActiveValueReport(report));
    dispatch(setTransferEntries(transferEntries));
    dispatch(setGroupMealEntries(groupMealEntries));
    dispatch(setSampleEntries(sampleEntries));
  }, [dispatch, report, transferEntries, groupMealEntries, sampleEntries]);

  return <>{children}</>;
}
