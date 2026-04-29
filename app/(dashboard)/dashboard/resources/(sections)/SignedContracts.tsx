"use client";

import { useMemo, useState } from "react";
import { FileCheck, FileText, ExternalLink } from "lucide-react";
import { EmptyState } from "@/app/(components)/EmptyState";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SALES_REP_CONTRACTS } from "@/lib/pdf/sales-rep-contracts";
import type {
  SignedContractRow,
  RepOfficeOption,
  SalesRepOption,
  ContractKind,
} from "../(services)/signed-contracts-actions";

/** Provider onboarding catalog. Kept here (in a client component) so the
 *  surrounding "use server" file in (services)/ doesn't have to export a
 *  non-async constant — Next.js disallows that for server-action modules. */
const PROVIDER_CONTRACTS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "baa", label: "Business Associate Agreement" },
  { key: "product_services", label: "Product & Services Agreement" },
];

const TYPE_BADGE_LABEL: Record<ContractKind, string> = {
  rep: "Sales Rep",
  provider: "Provider",
};

function TypeBadge({ kind }: { kind: ContractKind }) {
  const isProvider = kind === "provider";
  return (
    <span
      className={
        "shrink-0 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded " +
        (isProvider
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
          : "bg-blue-50 text-blue-700 border border-blue-200")
      }
    >
      {TYPE_BADGE_LABEL[kind]}
    </span>
  );
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function ContractCard({
  row,
  showTypeBadge = false,
}: {
  row: SignedContractRow;
  showTypeBadge?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-4 flex items-start gap-3 transition-colors hover:border-[var(--navy)]/30">
      <div className="shrink-0 w-10 h-10 rounded-lg bg-[var(--navy)]/5 text-[var(--navy)] flex items-center justify-center">
        <FileCheck className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-[var(--text1)] truncate">
            {row.label}
          </p>
          {showTypeBadge && <TypeBadge kind={row.kind} />}
        </div>
        <p className="mt-0.5 text-xs text-[var(--text3)]">
          Signed {fmtDate(row.signedAt)} by {row.typedName}
        </p>
      </div>
      {row.signedUrl ? (
        <a
          href={row.signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-[var(--navy)] hover:underline"
        >
          View <ExternalLink className="w-3 h-3" />
        </a>
      ) : (
        <span className="shrink-0 text-xs text-[var(--text3)]">Unavailable</span>
      )}
    </div>
  );
}

function MissingContractCard({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg)] p-4 flex items-start gap-3">
      <div className="shrink-0 w-10 h-10 rounded-lg bg-slate-100 text-[var(--text3)] flex items-center justify-center">
        <FileText className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--text3)] truncate">{label}</p>
        <p className="mt-0.5 text-xs text-[var(--text3)]">Not signed</p>
      </div>
    </div>
  );
}

export function MySignedContractsView({
  rows,
  kind,
}: {
  rows: SignedContractRow[];
  /** Drives which catalog of "expected" contracts to render placeholders for.
   *  Sales reps see the full SALES_REP_CONTRACTS list (Code of Conduct, COI,
   *  HepB consent, etc.); providers see just the BAA + Product & Services
   *  pair captured at invite signup. */
  kind: ContractKind;
}) {
  const byType = new Map(rows.map((r) => [r.contractType, r]));
  const catalog = kind === "provider" ? PROVIDER_CONTRACTS : SALES_REP_CONTRACTS;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {catalog.map((def) => {
        const row = byType.get(def.key);
        return row ? (
          <ContractCard key={def.key} row={row} />
        ) : (
          <MissingContractCard key={def.key} label={def.label} />
        );
      })}
    </div>
  );
}

export function AdminSignedContractsView({
  rows,
  repOffices,
  salesReps,
}: {
  rows: SignedContractRow[];
  repOffices: RepOfficeOption[];
  salesReps: SalesRepOption[];
}) {
  const [facilityFilter, setFacilityFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (facilityFilter !== "all" && r.facilityId !== facilityFilter) return false;
      if (userFilter !== "all" && r.userId !== userFilter) return false;
      return true;
    });
  }, [rows, facilityFilter, userFilter]);

  // Group by user for readability
  const groupedByRep = useMemo(() => {
    const map = new Map<string, SignedContractRow[]>();
    for (const r of filtered) {
      const key = r.userId ?? "unknown";
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([userId, docs]) => ({
      userId,
      userName: docs[0]?.userName ?? docs[0]?.userEmail ?? "Unknown rep",
      userEmail: docs[0]?.userEmail ?? "",
      facilityName: docs[0]?.facilityName ?? "",
      docs: [...docs].sort((a, b) =>
        a.contractType.localeCompare(b.contractType),
      ),
    }));
  }, [filtered]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--text3)] uppercase tracking-wider">
            Account
          </span>
          <Select value={facilityFilter} onValueChange={setFacilityFilter}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="All accounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {repOffices.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--text3)] uppercase tracking-wider">
            Sales rep
          </span>
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="All reps" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All reps</SelectItem>
              {salesReps.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(facilityFilter !== "all" || userFilter !== "all") && (
          <button
            type="button"
            onClick={() => {
              setFacilityFilter("all");
              setUserFilter("all");
            }}
            className="text-xs text-[var(--text3)] hover:text-[var(--navy)] underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {groupedByRep.length === 0 ? (
        <EmptyState
          className="py-16"
          icon={
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--border)]">
              <FileText className="h-8 w-8 text-[var(--text3)]" />
            </div>
          }
          message="No signed contracts match the selected filters"
          description="Clear the filters to see all rep signatures"
        />
      ) : (
        <div className="space-y-6">
          {groupedByRep.map((group) => (
            <div key={group.userId} className="space-y-3">
              <div className="flex items-baseline gap-2">
                <h3 className="text-sm font-semibold text-[var(--text1)]">
                  {group.userName}
                </h3>
                {group.facilityName && (
                  <span className="text-xs text-[var(--text3)]">
                    — {group.facilityName}
                  </span>
                )}
                {group.userEmail && (
                  <span className="text-xs text-[var(--text3)]">
                    ({group.userEmail})
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {group.docs.map((row) => (
                  <ContractCard key={row.id} row={row} showTypeBadge />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
