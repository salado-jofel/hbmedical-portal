"use client";

import { useState } from "react";
import { useAppSelector } from "@/store/hooks";
import { motion } from "framer-motion";
import { staggerContainer, fadeUp } from "@/components/ui/animations";
import { EmptyState } from "@/app/(components)/EmptyState";
import { TableToolbar } from "@/app/(components)/TableToolbar";
import {
  Users,
  Mail,
  Phone,
  Building2,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/utils/utils";
import type { SubRep } from "../(redux)/my-team-slice";

const STATUS_CONFIG = {
  active:   { label: "Active",   className: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  pending:  { label: "Pending",  className: "bg-amber-50 text-amber-700",     dot: "bg-amber-400"   },
  inactive: { label: "Inactive", className: "bg-[#F1F5F9] text-[#64748B]",   dot: "bg-[#94A3B8]"   },
};

export function TeamView() {
  const subReps = useAppSelector((s) => s.myTeam.items);
  const [search, setSearch] = useState("");

  const filtered = subReps.filter((rep) =>
    `${rep.first_name ?? ""} ${rep.last_name ?? ""} ${rep.email ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  if (subReps.length === 0) {
    return (
      <EmptyState
        icon={<Users className="w-10 h-10 stroke-1" />}
        message="No sub-representatives yet"
        description="Invite sub-reps from the Onboarding page to grow your team"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Sub-Reps"
          value={subReps.length}
          icon={<Users className="w-4 h-4" />}
        />
        <StatCard
          label="Active"
          value={subReps.filter((r) => r.status === "active").length}
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <StatCard
          label="Total Accounts"
          value={subReps.reduce((s, r) => s + r.accountCount, 0)}
          icon={<Building2 className="w-4 h-4" />}
        />
        <StatCard
          label="Total Orders"
          value={subReps.reduce((s, r) => s + r.orderCount, 0)}
          icon={<ShoppingCart className="w-4 h-4" />}
        />
      </div>

      {/* Search */}
      <TableToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search sub-reps..."
      />

      {/* Sub-rep cards */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
      >
        {filtered.map((rep) => (
          <motion.div key={rep.id} variants={fadeUp}>
            <SubRepCard rep={rep} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

function SubRepCard({ rep }: { rep: SubRep }) {
  const statusConfig =
    STATUS_CONFIG[rep.status as keyof typeof STATUS_CONFIG] ??
    STATUS_CONFIG.pending;

  return (
    <div className="bg-white border border-[var(--border)] rounded-xl p-5 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[var(--navy)] text-white flex items-center justify-center text-sm font-medium shrink-0">
            {rep.first_name?.[0]}
            {rep.last_name?.[0]}
          </div>
          <div>
            <p className="font-semibold text-[var(--navy)]">
              {rep.first_name} {rep.last_name}
            </p>
            <p className="text-xs text-[#94a3b8]">Sub-Representative</p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0",
            statusConfig.className,
          )}
        >
          <span className={cn("w-1.5 h-1.5 rounded-full", statusConfig.dot)} />
          {statusConfig.label}
        </span>
      </div>

      {/* Contact info */}
      <div className="space-y-1.5 mb-4 text-xs text-[#64748b]">
        <div className="flex items-center gap-2">
          <Mail className="w-3 h-3 shrink-0" />
          <span className="truncate">{rep.email}</span>
        </div>
        {rep.phone && (
          <div className="flex items-center gap-2">
            <Phone className="w-3 h-3 shrink-0" />
            <span>{rep.phone}</span>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[var(--border)]">
        <div className="text-center">
          <p className="text-base font-semibold text-[var(--navy)]">
            {rep.accountCount}
          </p>
          <p className="text-[10px] text-[#94a3b8]">Accounts</p>
        </div>
        <div className="text-center">
          <p className="text-base font-semibold text-[var(--navy)]">
            {rep.orderCount}
          </p>
          <p className="text-[10px] text-[#94a3b8]">Orders</p>
        </div>
        <div className="text-center">
          <p className="text-base font-semibold text-[#0d7a6b]">
            {rep.commissionRate}%
          </p>
          <p className="text-[10px] text-[#94a3b8]">Rate</p>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-center gap-2 text-[#94a3b8] mb-1">
        {icon}
        <span className="text-[11px] uppercase tracking-wide font-medium">
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold text-[var(--navy)]">{value}</p>
    </div>
  );
}
