"use client";

import { Trash2 } from "lucide-react";
import { ROLE_LABELS } from "@/utils/helpers/role";
import type { IFacilityMember } from "@/utils/interfaces/facility-members";

interface TeamMemberRowProps {
  member: IFacilityMember;
  isDeleting: boolean;
  onDeleteClick: (id: string) => void;
}

export function TeamMemberRow({ member, isDeleting, onDeleteClick }: TeamMemberRowProps) {
  const profile = member.member_profile;
  const name = profile ? `${profile.first_name} ${profile.last_name}` : "Unknown";

  return (
    <div className="flex items-center gap-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3">
      <div className="w-8 h-8 rounded-full bg-[#EFF6FF] flex items-center justify-center shrink-0">
        <span className="text-xs font-bold text-[#15689E]">
          {name.charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#0F172A] truncate">{name}</p>
        {profile?.email && (
          <p className="text-xs text-[#94A3B8] truncate">{profile.email}</p>
        )}
      </div>
      <span className="text-xs px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#15689E] font-medium shrink-0">
        {ROLE_LABELS[member.role_type as keyof typeof ROLE_LABELS] ?? member.role_type}
      </span>
      <button
        type="button"
        onClick={() => onDeleteClick(member.id)}
        disabled={isDeleting}
        className="w-7 h-7 flex items-center justify-center rounded-md text-[#94A3B8] hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
        title="Remove member"
      >
        {isDeleting ? (
          <div className="size-3.5 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
        ) : (
          <Trash2 className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}
