"use client";

import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { staggerContainer, fadeUp } from "@/components/ui/animations";
import { EmptyState } from "@/app/(components)/EmptyState";
import { ReportRow } from "../(components)/ReportRow";

export function ReportsList({ showRepName }: { showRepName: boolean }) {
  const reports = useAppSelector((s) => s.transfersOfValue.reports);

  if (reports.length === 0) {
    return (
      <EmptyState
        icon={<ShieldCheck className="w-10 h-10 stroke-1" />}
        message="No reports yet"
        description="Start a new monthly report to begin logging transfers of value."
      />
    );
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-2"
    >
      {reports.map((r) => (
        <motion.div key={r.id} variants={fadeUp}>
          <ReportRow report={r} showRepName={showRepName} />
        </motion.div>
      ))}
    </motion.div>
  );
}
