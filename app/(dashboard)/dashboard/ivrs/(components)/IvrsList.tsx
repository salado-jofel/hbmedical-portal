"use client";

import { useMemo, useState } from "react";
import { useAppSelector } from "@/store/hooks";
import {
  STANDALONE_IVR_STATUS_LABELS,
  type StandaloneIvrStatus,
} from "@/utils/interfaces/standalone-ivrs";
import type { IExternalApprover } from "@/utils/interfaces/standalone-ivrs";
import { cn } from "@/utils/utils";
import { FileText, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { IvrDetailModal } from "./IvrDetailModal";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-200",
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  approved: "bg-green-50 text-green-700 border-green-200",
  denied: "bg-red-50 text-red-700 border-red-200",
  converted: "bg-purple-50 text-purple-700 border-purple-200",
};

interface IvrsListProps {
  facilities: Array<{ id: string; name: string }>;
  approvers: IExternalApprover[];
}

export function IvrsList({ facilities, approvers }: IvrsListProps) {
  const ivrs = useAppSelector((s) => s.ivrs.items);
  const [openIvrId, setOpenIvrId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StandaloneIvrStatus | "all">(
    "all",
  );
  const [approverFilter, setApproverFilter] = useState<string>("all");

  const filteredIvrs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ivrs.filter((i) => {
      if (statusFilter !== "all" && i.status !== statusFilter) return false;
      if (approverFilter !== "all" && i.assignedApproverId !== approverFilter)
        return false;
      if (!q) return true;
      return (
        i.patientName.toLowerCase().includes(q) ||
        i.physicianName.toLowerCase().includes(q) ||
        i.productSummary.toLowerCase().includes(q) ||
        (i.facilityName ?? "").toLowerCase().includes(q) ||
        (i.approver?.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [ivrs, search, statusFilter, approverFilter]);

  const hasAnyFilters =
    !!search.trim() || statusFilter !== "all" || approverFilter !== "all";

  if (ivrs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] px-6 py-16 text-center bg-white mt-4">
        <FileText className="w-8 h-8 mx-auto mb-3 text-[var(--text3)]" />
        <p className="text-[14px] font-medium text-[var(--text2)]">
          No IVRs yet
        </p>
        <p className="text-[12px] text-[var(--text3)] mt-1 max-w-md mx-auto">
          Upload IVRs to dispatch them to external approvers. Approved IVRs
          can be converted into orders by clinic staff.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Filters row */}
      <div className="mt-4 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text3)]" />
          <Input
            type="text"
            placeholder="Search by patient, physician, product, facility, approver…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as StandaloneIvrStatus | "all")
          }
          className="h-9 px-3 border border-[#e5e7eb] rounded-md bg-white text-[13px]"
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent for Approval</option>
          <option value="approved">Approved</option>
          <option value="denied">Denied</option>
          <option value="converted">Converted to Order</option>
        </select>
        <select
          value={approverFilter}
          onChange={(e) => setApproverFilter(e.target.value)}
          className="h-9 px-3 border border-[#e5e7eb] rounded-md bg-white text-[13px]"
        >
          <option value="all">All approvers</option>
          {approvers.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {filteredIvrs.length === 0 && hasAnyFilters ? (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--border)] px-6 py-10 text-center bg-white">
          <p className="text-[13px] text-[var(--text2)]">
            No IVRs match the current filters.
          </p>
        </div>
      ) : (
      <div className="mt-4 rounded-xl border border-[var(--border)] bg-white overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-[var(--bg)] text-[10px] font-semibold uppercase tracking-wide text-[var(--text3)]">
            <tr>
              <th className="text-left px-4 py-2.5">Patient</th>
              <th className="text-left px-4 py-2.5">Physician</th>
              <th className="text-left px-4 py-2.5">Facility</th>
              <th className="text-left px-4 py-2.5">Products</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-left px-4 py-2.5">Approver</th>
              <th className="text-left px-4 py-2.5">Uploaded</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {filteredIvrs.map((i) => (
              <tr
                key={i.id}
                onClick={() => setOpenIvrId(i.id)}
                className="hover:bg-[var(--bg)] cursor-pointer transition-colors"
              >
                <td className="px-4 py-2.5">
                  <div className="font-medium">{i.patientName}</div>
                  <div className="text-[11px] text-[var(--text3)]">
                    DOB {i.patientDob}
                  </div>
                </td>
                <td className="px-4 py-2.5">{i.physicianName}</td>
                <td className="px-4 py-2.5">{i.facilityName ?? "—"}</td>
                <td className="px-4 py-2.5 max-w-xs truncate">
                  {i.productSummary}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border",
                      STATUS_STYLES[i.status] ??
                        "bg-gray-100 text-gray-700 border-gray-200",
                    )}
                  >
                    {STANDALONE_IVR_STATUS_LABELS[i.status]}
                  </span>
                </td>
                <td className="px-4 py-2.5">{i.approver?.name ?? "—"}</td>
                <td className="px-4 py-2.5 text-[11px] text-[var(--text3)]">
                  {new Date(i.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      <IvrDetailModal
        ivrId={openIvrId}
        onClose={() => setOpenIvrId(null)}
        facilities={facilities}
        approvers={approvers}
      />
    </>
  );
}
