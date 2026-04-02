"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, ShoppingCart, Users } from "lucide-react";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { updateAccountInStore } from "@/app/(dashboard)/dashboard/accounts/(redux)/accounts-slice";
import { updateAccountStatus, assignRep } from "@/app/(dashboard)/dashboard/accounts/(services)/actions";
import { AccountStatusBadge } from "../../(components)/AccountStatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/utils/utils";
import type { IRepProfile, AccountStatus } from "@/utils/interfaces/accounts";

const STATUS_OPTIONS: { value: AccountStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "prospect", label: "Prospect" },
  { value: "inactive", label: "Inactive" },
];

interface AccountHeaderProps {
  accountId: string;
  isAdmin: boolean;
  salesReps: IRepProfile[];
}

export function AccountHeader({ accountId, isAdmin, salesReps }: AccountHeaderProps) {
  const dispatch = useAppDispatch();
  const account = useAppSelector((s) =>
    s.accounts.items.find((a) => a.id === accountId),
  );

  const [statusPending, startStatusTransition] = useTransition();
  const [repPending, startRepTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!account) return null;

  function handleStatusChange(value: string) {
    setError(null);
    startStatusTransition(async () => {
      try {
        const updated = await updateAccountStatus(accountId, value as AccountStatus);
        dispatch(updateAccountInStore(updated));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update status.");
      }
    });
  }

  function handleRepChange(value: string) {
    setError(null);
    startRepTransition(async () => {
      try {
        const repId = value === "none" ? null : value;
        const updated = await assignRep(accountId, repId);
        dispatch(updateAccountInStore(updated));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to assign rep.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* ── Back link ── */}
      <Link
        href="/dashboard/accounts"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#15689E] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Accounts
      </Link>

      {/* ── Main header row ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        {/* Name + badge */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#15689E]/10 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-[#15689E]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-slate-800 truncate">
              {account.name}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5 truncate">{account.contact}</p>
          </div>
          <AccountStatusBadge status={account.status} className="shrink-0" />
        </div>

        {/* Admin controls */}
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Select
              value={account.status}
              onValueChange={handleStatusChange}
              disabled={statusPending}
            >
              <SelectTrigger
                className={cn(
                  "h-8 w-36 text-xs",
                  statusPending && "opacity-60 pointer-events-none",
                )}
              >
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={account.assigned_rep ?? "none"}
              onValueChange={handleRepChange}
              disabled={repPending}
            >
              <SelectTrigger
                className={cn(
                  "h-8 w-44 text-xs",
                  repPending && "opacity-60 pointer-events-none",
                )}
              >
                <SelectValue placeholder="Assign rep" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-xs">
                  Unassigned
                </SelectItem>
                {salesReps.map((rep) => (
                  <SelectItem key={rep.id} value={rep.id} className="text-xs">
                    {rep.first_name} {rep.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* ── Error ── */}
      {error && (
        <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
          <ShoppingCart className="w-4 h-4 text-[#15689E]" />
          <span className="text-sm font-semibold text-slate-700">{account.orders_count}</span>
          <span className="text-xs text-slate-400">Orders</span>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
          <Users className="w-4 h-4 text-[#15689E]" />
          <span className="text-sm font-semibold text-slate-700">{account.contacts_count}</span>
          <span className="text-xs text-slate-400">Contacts</span>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
          <span className="text-xs text-slate-400">Since</span>
          <span className="text-sm font-semibold text-slate-700">
            {new Date(account.created_at).toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
