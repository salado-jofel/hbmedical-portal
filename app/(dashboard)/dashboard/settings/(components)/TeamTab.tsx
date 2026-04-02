"use client";

import { useState } from "react";
import { Trash2, UserPlus } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { removeFacilityMember, updateMemberRole } from "@/app/(dashboard)/dashboard/settings/(services)/actions";
import { ROLE_LABELS } from "@/utils/helpers/role";
import type { IFacilityMember } from "@/utils/interfaces/facility-members";

interface TeamTabProps {
  members: IFacilityMember[];
  canManage: boolean;
}

const STAFF_ROLES = [
  { value: "clinical_provider", label: "Clinical Provider" },
  { value: "clinical_staff", label: "Clinical Staff" },
];

export function TeamTab({ members, canManage }: TeamTabProps) {
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleRemove(memberId: string) {
    setRemovingId(memberId);
    try {
      await removeFacilityMember(memberId);
      toast.success("Member removed.");
    } catch {
      toast.error("Failed to remove member.");
    } finally {
      setRemovingId(null);
    }
  }

  if (members.length === 0) {
    return (
      <div className="py-10 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-[#F1F5F9] flex items-center justify-center mx-auto">
          <UserPlus className="w-5 h-5 text-[#94A3B8]" />
        </div>
        <p className="text-sm text-[#64748B]">No team members yet.</p>
        <p className="text-xs text-[#94A3B8]">
          Use the Onboarding page to generate invite links.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {members.map((member) => {
        const profile = member.member_profile;
        const name = profile
          ? `${profile.first_name} ${profile.last_name}`
          : "Unknown";

        return (
          <div
            key={member.id}
            className="flex items-center gap-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3"
          >
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full bg-[#EFF6FF] flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-[#15689E]">
                {name.charAt(0).toUpperCase()}
              </span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#0F172A] truncate">{name}</p>
              {profile?.email && (
                <p className="text-xs text-[#94A3B8] truncate">{profile.email}</p>
              )}
            </div>

            {/* Role selector or badge */}
            {canManage ? (
              <Select
                defaultValue={member.role_type}
                onValueChange={async (value) => {
                  const fd = new FormData();
                  fd.set("role", value);
                  const result = await updateMemberRole(member.id, null, fd);
                  if (result.success) {
                    toast.success("Role updated.");
                  } else {
                    toast.error(result.error ?? "Failed to update role.");
                  }
                }}
              >
                <SelectTrigger className="h-7 text-xs w-40 shrink-0 border-[#E2E8F0]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAFF_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value} className="text-xs">
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#15689E] font-medium shrink-0">
                {ROLE_LABELS[member.role_type as keyof typeof ROLE_LABELS] ?? member.role_type}
              </span>
            )}

            {/* Remove */}
            {canManage && (
              <button
                type="button"
                onClick={() => handleRemove(member.id)}
                disabled={removingId === member.id}
                className="w-7 h-7 flex items-center justify-center rounded-md text-[#94A3B8] hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                title="Remove member"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
