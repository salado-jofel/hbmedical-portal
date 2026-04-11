"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";

export function FormDeficiencyBanner({
  aiExtracted,
  deficiencyCount,
}: {
  aiExtracted: boolean;
  deficiencyCount: number;
}) {
  if (!aiExtracted) return null;

  if (deficiencyCount > 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 mb-4">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>
          AI extracted this form —{" "}
          <strong>
            {deficiencyCount} field{deficiencyCount !== 1 ? "s" : ""}
          </strong>{" "}
          still need{deficiencyCount === 1 ? "s" : ""} to be filled in manually.
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 mb-4">
      <CheckCircle2 className="w-4 h-4 shrink-0" />
      <span>All required fields complete — ready for signing.</span>
    </div>
  );
}
