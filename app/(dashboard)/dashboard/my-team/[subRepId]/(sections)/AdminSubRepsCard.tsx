"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { formatAmount } from "@/utils/helpers/formatter";
import { cn } from "@/utils/utils";

interface AdminSubRepsCardProps {
  subReps: Array<{
    id: string;
    first_name: string;
    last_name: string;
    status: string;
    commissionEarned: number;
  }>;
}

const STATUS_PILL: Record<string, string> = {
  active:   "bg-emerald-50 text-emerald-600",
  inactive: "bg-[var(--border)] text-[var(--text2)]",
  pending:  "bg-amber-50 text-amber-600",
};

function initials(a: string, b: string): string {
  return `${a?.[0] ?? ""}${b?.[0] ?? ""}`.toUpperCase() || "?";
}

export default function AdminSubRepsCard({ subReps }: AdminSubRepsCardProps) {
  // No sub-reps → render nothing. Keeps the detail page clean for simple reps.
  if (subReps.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-[var(--navy)]">Sub-Reps</h2>
        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--border)] text-[var(--text2)] font-medium">
          {subReps.length}
        </span>
      </div>

      <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
        <ul className="divide-y divide-[var(--border)]">
          {subReps.map((rep) => {
            const name = `${rep.first_name} ${rep.last_name}`.trim() || "Unnamed rep";
            const pillCls = STATUS_PILL[rep.status] ?? STATUS_PILL.inactive;
            return (
              <li key={rep.id}>
                <Link
                  href={`/dashboard/my-team/${rep.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg)] transition-colors"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-50 text-[11px] font-semibold text-orange-600">
                    {initials(rep.first_name, rep.last_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--navy)] truncate">{name}</p>
                    <p className="text-xs text-[var(--text3)]">
                      {formatAmount(rep.commissionEarned)} earned this month
                    </p>
                  </div>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", pillCls)}>
                    {rep.status}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
