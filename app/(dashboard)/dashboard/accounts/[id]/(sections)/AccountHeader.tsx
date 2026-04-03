"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, Loader2, ShoppingCart, Users } from "lucide-react";
import toast from "react-hot-toast";
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
  const [error, setError] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedRep, setSelectedRep] = useState(account?.assigned_rep ?? "none");

  // Sync with Redux after Providers hydrates on first render (hard refresh)
  useEffect(() => {
    setSelectedRep(account?.assigned_rep ?? "none");
  }, [account?.assigned_rep]);

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

  async function handleRepChange(newRepId: string) {
    if (newRepId === selectedRep) return;
    const previous = selectedRep;
    setSelectedRep(newRepId);
    setIsAssigning(true);
    try {
      const repId = newRepId === "none" ? null : newRepId;
      const updated = await assignRep(accountId, repId);
      dispatch(updateAccountInStore(updated));
      toast.success("Sales rep updated.");
    } catch {
      setSelectedRep(previous);
      toast.error("Failed to update sales rep.");
    } finally {
      setIsAssigning(false);
    }
  }

  return (
    <div className="space-y-4 pb-5 border-b border-[#E2E8F0]">
      {/* ── Back link ── */}
      <Link
        href="/dashboard/accounts"
        className="inline-flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#15689E] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Accounts
      </Link>

      {/* ── Main header row ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        {/* Name + badge */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-[#15689E]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-[#0F172A] truncate">
              {account.name}
            </h1>
            <p className="text-sm text-[#64748B] mt-0.5 truncate">{account.contact}</p>
          </div>
          <AccountStatusBadge status={account.status} className="shrink-0" />
        </div>

        {/* Rep view — assigned rep as plain text */}
        {!isAdmin && account.assigned_rep_profile && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-[#94A3B8]">Assigned rep:</span>
            <span className="text-sm font-medium text-[#64748B]">
              {account.assigned_rep_profile.first_name}{" "}
              {account.assigned_rep_profile.last_name}
            </span>
          </div>
        )}

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
                  "h-9 w-36 text-sm border-[#E2E8F0] bg-white text-[#0F172A] rounded-lg",
                  statusPending && "opacity-60 pointer-events-none",
                )}
              >
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-sm">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedRep}
              onValueChange={handleRepChange}
              disabled={isAssigning}
            >
              <SelectTrigger
                className="h-9 w-44 text-sm border-[#E2E8F0] bg-white text-[#0F172A] rounded-lg"
                disabled={isAssigning}
              >
                {isAssigning ? (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Updating...
                  </span>
                ) : (
                  <SelectValue placeholder="Assign rep" />
                )}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-sm">
                  Unassigned
                </SelectItem>
                {salesReps.map((rep) => (
                  <SelectItem key={rep.id} value={rep.id} className="text-sm">
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
        <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <ShoppingCart className="w-4 h-4 text-[#15689E]" />
          <span className="text-sm font-semibold text-[#0F172A]">{account.orders_count}</span>
          <span className="text-xs text-[#94A3B8]">Orders</span>
        </div>
        <div className="flex items-center gap-2 bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <Users className="w-4 h-4 text-[#15689E]" />
          <span className="text-sm font-semibold text-[#0F172A]">{account.contacts_count}</span>
          <span className="text-xs text-[#94A3B8]">Contacts</span>
        </div>
        <div className="flex items-center gap-2 bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <span className="text-xs text-[#94A3B8]">Since</span>
          <span className="text-sm font-semibold text-[#0F172A]">
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
