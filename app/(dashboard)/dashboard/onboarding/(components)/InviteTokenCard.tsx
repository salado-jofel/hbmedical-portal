"use client";

import { Trash2, Clock, Loader2, Mail } from "lucide-react";
import { cn } from "@/utils/utils";
import { ROLE_LABELS } from "@/utils/helpers/role";
import type { IInviteToken } from "@/utils/interfaces/invite-tokens";

interface InviteTokenCardProps {
  token: IInviteToken;
  onDeleteClick: () => void;
  isDeleting: boolean;
  onResendClick?: () => void;
  isResending?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Primary label logic                                                         */
/* -------------------------------------------------------------------------- */

function getTokenPrimaryLabel(token: IInviteToken): string {
  // Used token — show what was created
  if (token.used_at) {
    if (token.used_by_facility_name) return token.used_by_facility_name;
    if (token.used_by_has_completed_setup) return "Setup complete";
    return "Pending setup";
  }
  // Unused token — show who was invited
  if (token.invited_email) return token.invited_email;
  // Fallback for old tokens without email
  switch (token.role_type) {
    case "clinical_provider":    return "Awaiting provider signup";
    case "sales_representative": return "Awaiting rep signup";
    case "clinical_staff":       return "Awaiting staff signup";
    default:                     return "Pending";
  }
}

/* -------------------------------------------------------------------------- */
/* Card                                                                        */
/* -------------------------------------------------------------------------- */

export function InviteTokenCard({
  token,
  onDeleteClick,
  isDeleting,
  onResendClick,
  isResending = false,
}: InviteTokenCardProps) {
  const isUsed    = token.used_at !== null;
  const isExpired = token.expires_at ? new Date(token.expires_at) < new Date() : false;
  const isActive  = !isUsed && !isExpired;

  const primaryLabel = getTokenPrimaryLabel(token);

  return (
    <div
      className={cn(
        "bg-white rounded-xl border p-4 space-y-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
        isUsed || isExpired ? "border-[#F1F5F9] opacity-60" : "border-[#E2E8F0]",
      )}
    >
      {/* ── Top row: label + badges + actions ── */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {/* Primary label */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-[#0F172A]">
              {primaryLabel}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#15689E] font-medium">
              {ROLE_LABELS[token.role_type]}
            </span>
            {isUsed && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#64748B]">
                Used
              </span>
            )}
            {isExpired && !isUsed && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                Expired
              </span>
            )}
          </div>

          {/* Secondary: "by [name]" for used tokens */}
          {isUsed && token.used_by_name && (
            <p className="text-xs text-[#94A3B8] mt-1">
              by {token.used_by_name}
            </p>
          )}

          {/* Expiry for active tokens */}
          {isActive && token.expires_at && (
            <p className="text-xs text-[#94A3B8] mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Expires{" "}
              {new Date(token.expires_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Resend email — only for unused tokens that have an email */}
          {!isUsed && token.invited_email && onResendClick && (
            <button
              type="button"
              onClick={onResendClick}
              disabled={isResending || isDeleting}
              className="h-7 px-2 inline-flex items-center gap-1.5 rounded-md text-xs text-[#94A3B8] hover:text-[#15689E] hover:bg-[#EFF6FF] transition-colors disabled:opacity-40"
              title="Resend invite email"
            >
              {isResending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Mail className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Resend</span>
            </button>
          )}
          <button
            type="button"
            onClick={onDeleteClick}
            disabled={isDeleting}
            className="w-7 h-7 flex items-center justify-center rounded-md text-[#94A3B8] hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
            title="Delete token"
          >
            {isDeleting
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Trash2 className="w-3.5 h-3.5" />
            }
          </button>
        </div>
      </div>
    </div>
  );
}
