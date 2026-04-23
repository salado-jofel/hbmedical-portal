"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { InviteTokenCard } from "../(components)/InviteTokenCard";
import { resendInviteEmail } from "../(services)/invite-actions";
import type { IInviteToken } from "@/utils/interfaces/invite-tokens";

interface InviteTokensSectionProps {
  tokens: IInviteToken[];
  isAdmin: boolean;
  isDeletingToken: boolean;
  deleteTokenId: string | null;
  onDeleteClick: (tokenId: string) => void;
}

export function InviteTokensSection({
  tokens,
  isAdmin,
  isDeletingToken,
  deleteTokenId,
  onDeleteClick,
}: InviteTokensSectionProps) {
  const [resendingTokenId, setResendingTokenId] = useState<string | null>(null);
  // Tokens are populated into Redux via a useEffect after mount, so the SSR
  // tree always sees an empty list while the client tree sees rows. That
  // shifts useId() order inside Radix-driven children and trips a hydration
  // mismatch (aria-controls). Defer rendering until after mount so SSR emits
  // nothing for this section and the client owns the whole subtree.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  async function handleResendInviteToken(tokenId: string) {
    setResendingTokenId(tokenId);
    try {
      const result = await resendInviteEmail(tokenId);
      if (!result.success) {
        toast.error(result.error ?? "Failed to resend invite.");
        return;
      }
      toast.success("Invite email resent.");
    } catch {
      toast.error("Failed to resend invite.");
    } finally {
      setResendingTokenId(null);
    }
  }

  // Admin view only shows actionable tokens (Active or Expired). Used tokens
  // describe completed signups — those users are now manageable from the Users
  // page, so leaving them here would just bloat the table over time.
  // Rep view (cards below) is unchanged — reps don't create many invites and
  // benefit from seeing the history.
  const visibleTokens = isAdmin
    ? tokens.filter((t) => !t.used_at)
    : tokens;

  if (visibleTokens.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-[var(--navy)]">
        {isAdmin
          ? `Pending invite links (${visibleTokens.length})`
          : `Your invite links (${visibleTokens.length})`}
      </h2>
      {isAdmin ? (
        <div className="bg-white rounded-xl border border-[var(--border)] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-[var(--bg)] border-b border-[var(--border)]">
                <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-[var(--text3)]">
                  Invited
                </th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-[var(--text3)] hidden lg:table-cell">
                  Created By
                </th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-[var(--text3)] hidden sm:table-cell">
                  Role Type
                </th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-[var(--text3)] hidden md:table-cell">
                  Expires
                </th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-[var(--text3)] text-right">
                  Status
                </th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-[var(--text3)] text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody suppressHydrationWarning>
              {visibleTokens.map((token) => {
                // Used tokens are filtered out for admin view above, so we
                // only need to distinguish Active vs Expired here.
                const isExpired = token.expires_at
                  ? new Date(token.expires_at) < new Date()
                  : false;
                const statusLabel = isExpired ? "Expired" : "Active";
                const statusStyle = isExpired
                  ? "bg-red-50 text-red-600"
                  : "bg-emerald-50 text-emerald-700";
                const dotStyle = isExpired ? "bg-red-400" : "bg-emerald-500";
                const roleColors: Record<string, string> = {
                  clinical_provider: "bg-teal-50 text-teal-700",
                  clinical_staff: "bg-[var(--border)] text-[var(--text2)]",
                  sales_representative: "bg-orange-50 text-orange-600",
                  support_staff: "bg-purple-50 text-purple-700",
                };
                const roleLabels: Record<string, string> = {
                  clinical_provider: "Clinical Provider",
                  clinical_staff: "Clinical Staff",
                  sales_representative: "Sales Rep",
                  support_staff: "Support Staff",
                };
                const createdBy = token.created_by_profile
                  ? `${token.created_by_profile.first_name} ${token.created_by_profile.last_name}`
                  : "Unknown";
                return (
                  <tr
                    key={token.id}
                    className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg)] transition-colors"
                  >
                    <td className="px-4 py-3.5">
                      {token.invited_email ? (
                        <span className="text-sm text-[var(--navy)] font-medium">
                          {token.invited_email}
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--text3)] italic">
                          Open invite (no specific email)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      <span className="text-sm text-[var(--text2)]">
                        {createdBy}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 hidden sm:table-cell">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[token.role_type] ?? "bg-[var(--border)] text-[var(--text2)]"}`}
                      >
                        {roleLabels[token.role_type] ?? token.role_type}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <span className="text-xs text-[var(--text2)]">
                        {token.expires_at
                          ? new Date(token.expires_at).toLocaleDateString()
                          : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${dotStyle}`}
                        />
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Resend only makes sense on Active tokens (the email
                            link still works). Expired tokens just get Delete. */}
                        {!isExpired && (
                          <button
                            type="button"
                            onClick={() => handleResendInviteToken(token.id)}
                            disabled={resendingTokenId === token.id}
                            title="Resend invite email"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--text2)] hover:bg-[var(--bg)] hover:text-[var(--navy)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {resendingTokenId === token.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onDeleteClick(token.id)}
                          disabled={isDeletingToken && deleteTokenId === token.id}
                          title="Delete invite link"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--text2)] hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isDeletingToken && deleteTokenId === token.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-2" suppressHydrationWarning>
          {tokens.map((token) => (
            <InviteTokenCard
              key={token.id}
              token={token}
              onDeleteClick={() => onDeleteClick(token.id)}
              isDeleting={isDeletingToken && deleteTokenId === token.id}
              onResendClick={() => handleResendInviteToken(token.id)}
              isResending={resendingTokenId === token.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}
