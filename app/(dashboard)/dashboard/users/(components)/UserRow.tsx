"use client";

import { UserX, UserCheck, Trash2, Mail, Loader2, KeyRound } from "lucide-react";
import { ROLE_LABELS } from "@/utils/helpers/role";
import type { UserRole } from "@/utils/helpers/role";
import type { IUser, UserStatus } from "@/utils/interfaces/users";

export const ROLE_COLORS: Record<
  NonNullable<UserRole>,
  { bg: string; text: string; dot: string }
> = {
  admin:                { bg: "bg-[var(--blue-lt)]",   text: "text-[var(--navy)]",  dot: "bg-[var(--navy)]"  },
  sales_representative: { bg: "bg-[var(--teal-lt)]",  text: "text-[var(--teal)]",  dot: "bg-[var(--teal)]"  },
  support_staff:        { bg: "bg-[var(--purple-lt)]",text: "text-[var(--purple)]",dot: "bg-[var(--purple)]" },
  clinical_provider:    { bg: "bg-[var(--blue-lt)]",  text: "text-[var(--blue)]",  dot: "bg-[var(--blue)]"  },
  clinical_staff:       { bg: "bg-[var(--gold-lt)]",  text: "text-[var(--gold)]",  dot: "bg-[var(--gold)]"  },
};

export const STATUS_CONFIG: Record<UserStatus, { bg: string; text: string; dot: string; label: string }> = {
  active:   { bg: "bg-[var(--green-lt)]", text: "text-[var(--green)]", dot: "bg-[var(--green)]", label: "Active"   },
  pending:  { bg: "bg-[var(--gold-lt)]",  text: "text-[var(--gold)]",  dot: "bg-[var(--gold)]",  label: "Pending"  },
  inactive: { bg: "bg-[var(--border)]",   text: "text-[var(--text2)]", dot: "bg-[var(--text3)]", label: "Inactive" },
};

interface UserRowActionsProps {
  user: IUser;
  pendingId: string | null;
  loadingId: string | null;
  onDeactivate: (userId: string) => void;
  onReactivate: (userId: string) => void;
  onResendInvite: (user: IUser) => void;
  onDeleteClick: (userId: string) => void;
  /** Admin-only PIN reset. Only rendered for active clinical providers. */
  onResetPin?: (user: IUser) => void;
}

export function UserRowActions({
  user,
  pendingId,
  loadingId,
  onDeactivate,
  onReactivate,
  onResendInvite,
  onDeleteClick,
  onResetPin,
}: UserRowActionsProps) {
  const isActing = pendingId === user.id;
  const isResending = loadingId === user.id;
  const canResetPin =
    !!onResetPin && user.role === "clinical_provider" && user.status === "active";

  if (user.status === "pending") {
    return (
      <div className="inline-flex items-center gap-1 justify-end">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onResendInvite(user); }}
          disabled={isResending || isActing}
          className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-[var(--navy)] hover:bg-[#EFF6FF] transition-all disabled:opacity-40 opacity-0 group-hover:opacity-100"
          title="Resend invite"
        >
          {isResending
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Mail className="w-3.5 h-3.5" />
          }
          <span className="hidden sm:inline">Resend</span>
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDeleteClick(user.id); }}
          disabled={isActing || isResending}
          className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-red-400 hover:text-red-600 hover:bg-red-50 transition-all disabled:opacity-40 opacity-0 group-hover:opacity-100"
          title="Delete user"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  if (user.status === "active") {
    return (
      <div className="inline-flex items-center gap-1 justify-end">
        {canResetPin && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onResetPin!(user); }}
            disabled={isActing}
            className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-[var(--text3)] hover:text-[var(--navy)] hover:bg-[#EFF6FF] transition-all disabled:opacity-40 opacity-0 group-hover:opacity-100"
            title="Reset this provider's signing PIN"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset PIN</span>
          </button>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDeactivate(user.id); }}
          disabled={isActing}
          className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-[var(--text3)] hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-40 opacity-0 group-hover:opacity-100"
          title="Deactivate user"
        >
          <UserX className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Deactivate</span>
        </button>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1 justify-end">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onReactivate(user.id); }}
        disabled={isActing}
        className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-[var(--text3)] hover:text-[var(--green)] hover:bg-[var(--green-lt)] transition-all disabled:opacity-40 opacity-0 group-hover:opacity-100"
        title="Reactivate user"
      >
        <UserCheck className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Reactivate</span>
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDeleteClick(user.id); }}
        disabled={isActing}
        className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-red-400 hover:text-red-600 hover:bg-red-50 transition-all disabled:opacity-40 opacity-0 group-hover:opacity-100"
        title="Delete user"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export { ROLE_LABELS };
