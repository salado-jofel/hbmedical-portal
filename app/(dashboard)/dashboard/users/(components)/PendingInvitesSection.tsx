"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, RefreshCw, Trash2, Mail } from "lucide-react";
import toast from "react-hot-toast";
import {
  getStaffPendingInvites,
  type IStaffPendingInvite,
} from "../(services)/actions";
import { resendInviteEmail } from "@/app/(dashboard)/dashboard/onboarding/(services)/invite-actions";
import { deleteInviteToken } from "@/app/(dashboard)/dashboard/(services)/invite-tokens/actions";
import { ROLE_LABELS } from "@/utils/helpers/role";
import ConfirmModal from "@/app/(components)/ConfirmModal";

/**
 * Pending admin/support invites table for the Users page.
 *
 * Shows un-used, non-expired invite_tokens whose role_type is admin or
 * support_staff (the two roles that flow through CreateUserModal). Reps and
 * clinics still see their tokens on /dashboard/onboarding — those audiences
 * are separate.
 *
 * Refreshes:
 *  - On mount
 *  - After a successful resend
 *  - After a successful delete
 *  - Whenever the parent calls the imperative `refresh` ref (passed via
 *    `refreshKey` prop bumps)
 */
interface Props {
  /** Bump this to force a refresh from the parent (e.g., after CreateUser). */
  refreshKey?: number;
}

export function PendingInvitesSection({ refreshKey = 0 }: Props) {
  const [invites, setInvites] = useState<IStaffPendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  // ID of invite the admin clicked Delete on — drives the ConfirmModal.
  // Null = modal closed. Confirming triggers the actual delete.
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function load() {
    setLoading(true);
    try {
      const rows = await getStaffPendingInvites();
      setInvites(rows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  async function handleResend(id: string) {
    setActingId(id);
    try {
      const result = await resendInviteEmail(id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to resend invite.");
        return;
      }
      toast.success("Invite email resent.");
    } catch {
      toast.error("Failed to resend invite.");
    } finally {
      setActingId(null);
    }
  }

  async function handleDelete(id: string) {
    setActingId(id);
    startTransition(async () => {
      try {
        await deleteInviteToken(id);
        toast.success("Invite deleted.");
        // Optimistic update + reload from server
        setInvites((prev) => prev.filter((i) => i.id !== id));
        load();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete.");
      } finally {
        setActingId(null);
        setDeleteConfirmId(null);
      }
    });
  }

  // Hide the section entirely when there's nothing pending — saves visual
  // clutter on the Users page when admin invites aren't in flight.
  if (loading && invites.length === 0) return null;
  if (!loading && invites.length === 0) return null;

  return (
    <>
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Mail className="w-4 h-4 text-[var(--text3)]" />
        <h2 className="text-sm font-semibold text-[var(--navy)]">
          Pending Invites ({invites.length})
        </h2>
      </div>

      <div className="bg-white rounded-xl border border-[var(--border)] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="bg-[var(--bg)] border-b border-[var(--border)]">
              <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-[var(--text3)]">
                Invited
              </th>
              <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-[var(--text3)]">
                Role
              </th>
              <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-[var(--text3)] hidden md:table-cell">
                Expires
              </th>
              <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-[var(--text3)] hidden lg:table-cell">
                Created By
              </th>
              <th className="px-4 py-3 w-[140px]" />
            </tr>
          </thead>
          <tbody>
            {invites.map((inv) => {
              const fullName = [inv.first_name, inv.last_name]
                .filter(Boolean)
                .join(" ");
              const expiresIn = inv.expires_at
                ? formatExpiry(inv.expires_at)
                : "—";
              return (
                <tr
                  key={inv.id}
                  className="border-b border-[var(--border)] last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-[var(--text1)]">
                        {fullName || "—"}
                      </span>
                      <span className="text-xs text-[var(--text3)]">
                        {inv.email}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--text2)]">
                    {ROLE_LABELS[inv.role_type] ?? inv.role_type}
                  </td>
                  <td className="px-4 py-3 text-[var(--text2)] hidden md:table-cell">
                    {expiresIn}
                  </td>
                  <td className="px-4 py-3 text-[var(--text2)] hidden lg:table-cell">
                    {inv.created_by_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleResend(inv.id)}
                        disabled={actingId === inv.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[var(--text2)] hover:text-[var(--navy)] hover:bg-[var(--bg)] rounded-md transition-colors disabled:opacity-40"
                        title="Resend invite email"
                      >
                        {actingId === inv.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        Resend
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(inv.id)}
                        disabled={actingId === inv.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-40"
                        title="Delete invite"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>

    <ConfirmModal
      open={deleteConfirmId !== null}
      onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}
      title="Delete invite?"
      description="The invite link will stop working immediately. The recipient will see an 'Invite already used or expired' message if they try to use it."
      confirmLabel="Delete invite"
      isLoading={actingId !== null && actingId === deleteConfirmId}
      onConfirm={() => { if (deleteConfirmId) handleDelete(deleteConfirmId); }}
    />
    </>
  );
}

/** Format an ISO expiry into a human "in N days" / "in N hours" string. */
function formatExpiry(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `in ${hours} h`;
  const days = Math.round(hours / 24);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}
