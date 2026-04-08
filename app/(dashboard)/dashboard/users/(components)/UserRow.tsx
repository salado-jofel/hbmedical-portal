"use client";

import { UserX, UserCheck, Trash2, Mail, Loader2 } from "lucide-react";
import { ROLE_LABELS } from "@/utils/helpers/role";
import type { UserRole } from "@/utils/helpers/role";
import type { IUser, UserStatus } from "@/utils/interfaces/users";

export const ROLE_COLORS: Record<
  NonNullable<UserRole>,
  { bg: string; text: string; dot: string }
> = {
  admin:                { bg: "bg-[#EFF6FF]",    text: "text-[#15689E]",  dot: "bg-[#15689E]"  },
  sales_representative: { bg: "bg-orange-50",    text: "text-orange-600", dot: "bg-orange-400" },
  support_staff:        { bg: "bg-purple-50",    text: "text-purple-700", dot: "bg-purple-400" },
  clinical_provider:    { bg: "bg-teal-50",      text: "text-teal-700",   dot: "bg-teal-400"   },
  clinical_staff:       { bg: "bg-[#F1F5F9]",   text: "text-[#64748B]",  dot: "bg-[#94A3B8]"  },
};

export const STATUS_CONFIG: Record<UserStatus, { bg: string; text: string; dot: string; label: string }> = {
  active:   { bg: "bg-emerald-50",  text: "text-emerald-600", dot: "bg-emerald-500", label: "Active"   },
  pending:  { bg: "bg-amber-50",    text: "text-amber-600",   dot: "bg-amber-500",   label: "Pending"  },
  inactive: { bg: "bg-[#F1F5F9]",   text: "text-gray-500",    dot: "bg-gray-400",    label: "Inactive" },
};

interface UserRowActionsProps {
  user: IUser;
  pendingId: string | null;
  loadingId: string | null;
  onDeactivate: (userId: string) => void;
  onReactivate: (userId: string) => void;
  onResendInvite: (user: IUser) => void;
  onDeleteClick: (userId: string) => void;
}

export function UserRowActions({
  user,
  pendingId,
  loadingId,
  onDeactivate,
  onReactivate,
  onResendInvite,
  onDeleteClick,
}: UserRowActionsProps) {
  const isActing = pendingId === user.id;
  const isResending = loadingId === user.id;

  if (user.status === "pending") {
    return (
      <div className="inline-flex items-center gap-1 justify-end">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onResendInvite(user); }}
          disabled={isResending || isActing}
          className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-[#15689E] hover:bg-[#EFF6FF] transition-all disabled:opacity-40 opacity-0 group-hover:opacity-100"
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
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDeactivate(user.id); }}
        disabled={isActing}
        className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-[#94A3B8] hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-40 opacity-0 group-hover:opacity-100"
        title="Deactivate user"
      >
        <UserX className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Deactivate</span>
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-1 justify-end">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onReactivate(user.id); }}
        disabled={isActing}
        className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-[#94A3B8] hover:text-emerald-600 hover:bg-emerald-50 transition-all disabled:opacity-40 opacity-0 group-hover:opacity-100"
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
