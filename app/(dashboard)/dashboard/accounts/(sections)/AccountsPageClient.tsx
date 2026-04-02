"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Building2, Search, User, ChevronRight } from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { fadeUp, staggerContainer } from "@/components/ui/animations";
import { AccountStatusBadge } from "../(components)/AccountStatusBadge";
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

interface AccountsPageClientProps {
  salesReps: IRepProfile[];
  isAdmin: boolean;
}

export function AccountsPageClient({ salesReps, isAdmin }: AccountsPageClientProps) {
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
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 pb-5 mb-6 border-b border-[#E2E8F0]">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A]">Accounts</h1>
          <p className="text-sm text-[#64748B] mt-0.5">Manage your facilities and prospects</p>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8] pointer-events-none" />
          <Input
            placeholder="Search accounts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm border-[#E2E8F0] bg-white text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#15689E] focus:ring-2 focus:ring-[#15689E]/10 rounded-lg transition-colors"
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as AccountStatus | "all")}
        >
          <SelectTrigger className="w-full sm:w-44 h-9 text-sm border-[#E2E8F0] bg-white text-[#0F172A] rounded-lg">
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
            <SelectTrigger className="w-full sm:w-52 h-9 text-sm border-[#E2E8F0] bg-white text-[#0F172A] rounded-lg">
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
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          {/* Header */}
          <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[2fr_1fr_auto_auto] md:grid-cols-[2fr_1fr_1fr_auto_auto] lg:grid-cols-[2fr_1fr_1fr_1fr_auto_auto] bg-[#F8FAFC] border-b border-[#E2E8F0] px-4 py-3">
            <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Account</span>
            <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider hidden sm:block">Status</span>
            <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider hidden md:block">Assigned Rep</span>
            <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider hidden lg:block">Location</span>
            <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider text-right hidden sm:block">Contacts</span>
            <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider text-right pl-4">Orders</span>
          </div>

          {/* Rows */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {filtered.map((account) => (
              <motion.div
                key={account.id}
                variants={fadeUp}
                onClick={() => router.push(`/dashboard/accounts/${account.id}`)}
                className={cn(
                  "grid grid-cols-[1fr_auto] sm:grid-cols-[2fr_1fr_auto_auto] md:grid-cols-[2fr_1fr_1fr_auto_auto] lg:grid-cols-[2fr_1fr_1fr_1fr_auto_auto] items-center px-4 py-3.5",
                  "border-b border-[#F1F5F9] last:border-0 hover:bg-[#FAFBFC] transition-colors cursor-pointer group",
                )}
              >
                {/* Name + location sub-text */}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#0F172A] truncate group-hover:text-[#15689E] transition-colors">
                    {account.name}
                  </p>
                  <p className="text-xs text-[#94A3B8] truncate mt-0.5">
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
                      <div className="w-6 h-6 rounded-full bg-[#EFF6FF] flex items-center justify-center shrink-0">
                        <User className="w-3 h-3 text-[#15689E]" />
                      </div>
                      <span className="text-xs text-[#64748B] truncate">
                        {account.assigned_rep_profile.first_name}{" "}
                        {account.assigned_rep_profile.last_name}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-[#94A3B8]">Unassigned</span>
                  )}
                </div>

                {/* Location */}
                <div className="hidden lg:block min-w-0">
                  <span className="text-xs text-[#64748B] truncate">
                    {account.city}, {account.state}
                  </span>
                </div>

                {/* Contacts count */}
                <div className="hidden sm:flex justify-end">
                  <span className="min-w-5 h-5 flex items-center justify-center rounded-full bg-[#F1F5F9] text-[#64748B] text-xs font-semibold px-1.5">
                    {account.contacts_count}
                  </span>
                </div>

                {/* Orders count + chevron */}
                <div className="flex items-center gap-3 justify-end pl-4">
                  <span className="min-w-5 h-5 flex items-center justify-center rounded-full bg-[#EFF6FF] text-[#15689E] text-xs font-semibold px-1.5">
                    {account.orders_count}
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#15689E] transition-colors shrink-0" />
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}

      <p className="text-xs text-[#94A3B8] text-right">
        {filtered.length} of {accounts.length} account{accounts.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
