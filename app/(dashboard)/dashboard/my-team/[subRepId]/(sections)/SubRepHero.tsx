"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { formatAmount } from "@/utils/helpers/formatter";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function periodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return `${MONTH_NAMES[(month ?? 1) - 1]} ${year}`;
}

function statusInfo(pct: number | null): { label: string; dotCls: string; textCls: string } {
  if (pct === null)  return { label: "No quota set",  dotCls: "bg-[var(--border2)]", textCls: "text-[var(--text3)]" };
  if (pct >= 100)    return { label: "Quota met!",    dotCls: "bg-emerald-500",       textCls: "text-emerald-600"    };
  if (pct >= 75)     return { label: "Almost there",  dotCls: "bg-[var(--teal)]",     textCls: "text-[var(--teal)]"  };
  if (pct >= 25)     return { label: "On track",      dotCls: "bg-[var(--gold)]",     textCls: "text-[var(--gold)]"  };
  return               { label: "Behind pace",  dotCls: "bg-red-500",           textCls: "text-red-500"        };
}

export default function SubRepHero() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const detail = useAppSelector((s) => s.subRepDetail.detail);
  if (!detail) return null;

  const pct = detail.attainmentPct;
  const capped = Math.min(pct ?? 0, 100);
  const { label, dotCls, textCls } = statusInfo(pct);
  const initials =
    (detail.first_name?.[0] ?? "") + (detail.last_name?.[0] ?? "");

  return (
    <div className="space-y-3">
      <Link
        href="/dashboard/my-team"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text2)] hover:text-[var(--navy)]"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to My Team
      </Link>

      <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center justify-between px-6 py-5" style={{ background: "var(--navy)" }}>
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[18px] font-semibold text-white"
              style={{ background: "rgba(255,255,255,0.2)" }}
            >
              {mounted ? (initials || "?") : "?"}
            </div>
            <div>
              <p className="text-[18px] font-semibold leading-tight text-white">
                {detail.first_name} {detail.last_name}
              </p>
              <p className="mt-0.5 text-[12px]" style={{ color: "#7fb3cc" }}>
                Sub-Representative · {detail.commissionRate}% Commission Rate
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[32px] font-bold leading-none text-white">
              {pct !== null ? `${pct.toFixed(1)}%` : "—"}
            </p>
            <p className="mt-1 text-[12px]" style={{ color: "#7fb3cc" }}>
              of {periodLabel(detail.currentPeriod)} goal
            </p>
          </div>
        </div>

        <div className="px-6 py-5">
          {detail.quota == null ? (
            <p className="text-[13px] text-[var(--text3)]">No quota set for this period.</p>
          ) : (
            <>
              <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--border2)]">
                <div
                  className="h-full rounded-full bg-[var(--teal-mid)] transition-[width] duration-500"
                  style={{ width: `${capped}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[12px] text-[var(--text3)]">
                  {formatAmount(detail.actualRevenue)} of {formatAmount(detail.quota)}
                </span>
                <span className="text-[13px] font-bold text-[var(--navy)]">{pct?.toFixed(1)}%</span>
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${dotCls}`} />
                <span className={`text-[12px] font-medium ${textCls}`}>{label}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
