"use client";

import { useState } from "react";
import toast from "react-hot-toast";
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

  if (tokens.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-[var(--navy)]">
        {isAdmin
          ? `All invite links (${tokens.length})`
          : `Your invite links (${tokens.length})`}
      </h2>
      {isAdmin ? (
        <div className="bg-white rounded-xl border border-[var(--border)] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-[var(--bg)] border-b border-[var(--border)]">
                <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-[var(--text3)]">
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
              </tr>
            </thead>
            <tbody suppressHydrationWarning>
              {tokens.map((token) => {
                const isUsed = !!token.used_at;
                const isExpired =
                  !isUsed && token.expires_at
                    ? new Date(token.expires_at) < new Date()
                    : false;
                const statusLabel = isUsed
                  ? "Used"
                  : isExpired
                    ? "Expired"
                    : "Active";
                const statusStyle = isUsed
                  ? "bg-[var(--border)] text-[var(--text2)]"
                  : isExpired
                    ? "bg-red-50 text-red-600"
                    : "bg-emerald-50 text-emerald-700";
                const dotStyle = isUsed
                  ? "bg-[var(--text3)]"
                  : isExpired
                    ? "bg-red-400"
                    : "bg-emerald-500";
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
                      <span className="text-sm text-[var(--navy)] font-medium">
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
