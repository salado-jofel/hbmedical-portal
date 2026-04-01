"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Building2, Search, User, ChevronRight } from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { fadeUp, staggerContainer } from "@/components/ui/animations";
import { AccountStatusBadge } from "./AccountStatusBadge";
import { EmptyState } from "@/app/(components)/EmptyState";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/utils/utils";
import type { IRepProfile } from "@/utils/interfaces/accounts";
import type { AccountStatus } from "@/utils/interfaces/accounts";

const STATUS_OPTIONS: { value: AccountStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "prospect", label: "Prospect" },
  { value: "inactive", label: "Inactive" },
];

interface AccountsTableProps {
  salesReps: IRepProfile[];
  isAdmin: boolean;
}

export function AccountsTable({ salesReps, isAdmin }: AccountsTableProps) {
  const router = useRouter();
  const accounts = useAppSelector((state) => state.accounts.items);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AccountStatus | "all">("all");
  const [repFilter, setRepFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    let result = accounts;

    if (search.trim()) {
      const term = search.trim().toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(term) ||
          a.city.toLowerCase().includes(term) ||
          a.state.toLowerCase().includes(term) ||
          a.contact.toLowerCase().includes(term),
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((a) => a.status === statusFilter);
    }

    if (isAdmin && repFilter !== "all") {
      result = result.filter((a) => a.assigned_rep === repFilter);
    }

    return result;
  }, [accounts, search, statusFilter, repFilter, isAdmin]);

  return (
    <div className="space-y-4">
      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            placeholder="Search accounts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as AccountStatus | "all")}
        >
          <SelectTrigger className="w-full sm:w-44 h-9 text-sm">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isAdmin && (
          <Select value={repFilter} onValueChange={setRepFilter}>
            <SelectTrigger className="w-full sm:w-52 h-9 text-sm">
              <SelectValue placeholder="All reps" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All reps</SelectItem>
              {salesReps.map((rep) => (
                <SelectItem key={rep.id} value={rep.id}>
                  {rep.first_name} {rep.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-10 h-10 stroke-1" />}
          message="No accounts found"
        />
      ) : (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[2fr_1fr_auto_auto] md:grid-cols-[2fr_1fr_1fr_auto_auto] lg:grid-cols-[2fr_1fr_1fr_1fr_auto_auto] bg-[#15689E] px-5 py-3">
            <span className="text-xs font-semibold text-white tracking-wide">Account</span>
            <span className="text-xs font-semibold text-white tracking-wide hidden sm:block">Status</span>
            <span className="text-xs font-semibold text-white tracking-wide hidden md:block">Assigned Rep</span>
            <span className="text-xs font-semibold text-white tracking-wide hidden lg:block">Location</span>
            <span className="text-xs font-semibold text-white tracking-wide text-right hidden sm:block">Contacts</span>
            <span className="text-xs font-semibold text-white tracking-wide text-right pl-4">Orders</span>
          </div>

          {/* Rows */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="divide-y divide-slate-50"
          >
            {filtered.map((account) => (
              <motion.div
                key={account.id}
                variants={fadeUp}
                onClick={() => router.push(`/dashboard/accounts/${account.id}`)}
                className={cn(
                  "grid grid-cols-[1fr_auto] sm:grid-cols-[2fr_1fr_auto_auto] md:grid-cols-[2fr_1fr_1fr_auto_auto] lg:grid-cols-[2fr_1fr_1fr_1fr_auto_auto] items-center px-5 py-3.5",
                  "hover:bg-slate-50 transition-colors cursor-pointer group",
                )}
              >
                {/* Name + location sub-text */}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-[#15689E] transition-colors">
                    {account.name}
                  </p>
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    {account.city}, {account.state} · {account.country}
                  </p>
                </div>

                {/* Status */}
                <div className="hidden sm:flex">
                  <AccountStatusBadge status={account.status} />
                </div>

                {/* Rep */}
                <div className="hidden md:flex items-center gap-1.5 min-w-0">
                  {account.assigned_rep_profile ? (
                    <>
                      <div className="w-6 h-6 rounded-full bg-[#15689E]/10 flex items-center justify-center shrink-0">
                        <User className="w-3 h-3 text-[#15689E]" />
                      </div>
                      <span className="text-xs text-slate-600 truncate">
                        {account.assigned_rep_profile.first_name}{" "}
                        {account.assigned_rep_profile.last_name}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-slate-300">Unassigned</span>
                  )}
                </div>

                {/* Location */}
                <div className="hidden lg:block min-w-0">
                  <span className="text-xs text-slate-500 truncate">
                    {account.city}, {account.state}
                  </span>
                </div>

                {/* Contacts count */}
                <div className="hidden sm:flex justify-end">
                  <span className="min-w-5 h-5 flex items-center justify-center rounded-full bg-slate-100 text-slate-600 text-xs font-bold px-1.5">
                    {account.contacts_count}
                  </span>
                </div>

                {/* Orders count + chevron */}
                <div className="flex items-center gap-3 justify-end pl-4">
                  <span className="min-w-5 h-5 flex items-center justify-center rounded-full bg-[#15689E] text-white text-xs font-bold px-1.5">
                    {account.orders_count}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#15689E] transition-colors shrink-0" />
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}

      <p className="text-xs text-slate-400 text-right">
        {filtered.length} of {accounts.length} account{accounts.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
