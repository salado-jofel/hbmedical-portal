"use client";

import { useMemo, useState } from "react";
import { useAppSelector } from "@/store/hooks";
import {
  INTAKE_STATUS_LABELS,
  type IntakeStatus,
} from "@/utils/interfaces/intake";
import type { IExternalApprover } from "@/utils/interfaces/standalone-ivrs";
import { Inbox, Phone } from "lucide-react";
import { cn } from "@/utils/utils";
import { IntakeDetailModal } from "./IntakeDetailModal";

interface IntakeListProps {
  facilities: Array<{ id: string; name: string }>;
  approvers: IExternalApprover[];
}

const STATUS_STYLES: Record<IntakeStatus, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  converted_ivr: "bg-green-50 text-green-700 border-green-200",
  converted_order: "bg-blue-50 text-blue-700 border-blue-200",
  dismissed: "bg-gray-100 text-gray-600 border-gray-200",
};

type Tab = "pending" | "done";

/**
 * Two-tab table of intake documents. Pending on the left (default) so
 * staff always land on their work; Done on the right for audit /
 * troubleshooting. Row click opens the detail modal for triage.
 */
export function IntakeList({ facilities, approvers }: IntakeListProps) {
  const items = useAppSelector((s) => s.intake.items);
  const [tab, setTab] = useState<Tab>("pending");
  const [openId, setOpenId] = useState<string | null>(null);

  const [pending, done] = useMemo(() => {
    const p = items.filter((i) => i.status === "pending");
    const d = items.filter((i) => i.status !== "pending");
    return [p, d];
  }, [items]);

  const rows = tab === "pending" ? pending : done;

  return (
    <div className="mt-4">
      <div className="flex items-center gap-1 border-b border-[var(--border)]">
        <TabButton
          active={tab === "pending"}
          onClick={() => setTab("pending")}
          label={`Pending (${pending.length})`}
        />
        <TabButton
          active={tab === "done"}
          onClick={() => setTab("done")}
          label={`Done (${done.length})`}
        />
      </div>

      {rows.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-[var(--border)] px-6 py-12 text-center bg-white">
          <Inbox className="w-8 h-8 mx-auto mb-3 text-[var(--text3)]" />
          <p className="text-[14px] font-medium text-[var(--text2)]">
            {tab === "pending"
              ? "No pending faxes"
              : "No processed faxes yet"}
          </p>
          <p className="text-[12px] text-[var(--text3)] mt-1 max-w-md mx-auto">
            {tab === "pending"
              ? "New inbound faxes will appear here for triage."
              : "Processed and dismissed faxes live here for audit."}
          </p>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-[var(--border)] bg-white overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-[var(--bg)] text-[10px] font-semibold uppercase tracking-wide text-[var(--text3)]">
              <tr>
                <th className="text-left px-4 py-2.5">From</th>
                <th className="text-left px-4 py-2.5">File</th>
                <th className="text-left px-4 py-2.5">Pages</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((i) => (
                <tr
                  key={i.id}
                  onClick={() => setOpenId(i.id)}
                  className="hover:bg-[var(--bg)] cursor-pointer transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5 text-[13px]">
                      <Phone className="w-3.5 h-3.5 text-[var(--text3)] shrink-0" />
                      {i.fromNumber ?? "Unknown"}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 max-w-xs truncate">
                    {i.fileName ?? "fax.pdf"}
                  </td>
                  <td className="px-4 py-2.5">{i.pageCount ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border",
                        STATUS_STYLES[i.status],
                      )}
                    >
                      {INTAKE_STATUS_LABELS[i.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[11px] text-[var(--text3)]">
                    {new Date(i.receivedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <IntakeDetailModal
        intakeId={openId}
        onClose={() => setOpenId(null)}
        facilities={facilities}
        approvers={approvers}
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-4 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors",
        active
          ? "border-[var(--navy)] text-[var(--navy)]"
          : "border-transparent text-[var(--text3)] hover:text-[var(--text)]",
      )}
    >
      {label}
    </button>
  );
}
