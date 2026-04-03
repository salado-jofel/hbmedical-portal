"use client";

import { useState } from "react";
import { Trash2, Building2, Users } from "lucide-react";
import toast from "react-hot-toast";
import { ROLE_LABELS } from "@/utils/helpers/role";
import ConfirmModal from "@/app/(components)/ConfirmModal";
import { EmptyState } from "@/app/(components)/EmptyState";
import { removeFacilityMember } from "@/app/(dashboard)/dashboard/settings/(services)/actions";
import type { IFacilityMember } from "@/utils/interfaces/facility-members";
import type { ISubRep } from "@/utils/interfaces/sub-reps";
import type { IClinicAccount } from "@/app/(dashboard)/dashboard/settings/(services)/actions";

interface TeamTabProps {
  isRep: boolean;
  myClinicAccounts: IClinicAccount[];
  mySubReps: ISubRep[];
  myClinicMembers: IFacilityMember[];
}

/* ── Status badge ── */
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; text: string; label: string }> = {
    active:   { bg: "bg-emerald-50", text: "text-emerald-600", label: "Active"   },
    inactive: { bg: "bg-[#F1F5F9]",  text: "text-[#64748B]",  label: "Inactive" },
    prospect: { bg: "bg-amber-50",   text: "text-amber-600",  label: "Prospect" },
    pending:  { bg: "bg-amber-50",   text: "text-amber-600",  label: "Pending"  },
  };
  const c = cfg[status] ?? cfg.inactive;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

/* ── Section heading ── */
function SectionHeading({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">{title}</p>
      <span className="text-xs px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#64748B] font-medium">
        {count}
      </span>
    </div>
  );
}

/* ── Rep view ── */
function RepTeamTab({
  myClinicAccounts,
  mySubReps,
}: {
  myClinicAccounts: IClinicAccount[];
  mySubReps: ISubRep[];
}) {
  return (
    <div className="space-y-8">
      {/* My Clinics */}
      <div>
        <SectionHeading title="My Clinics" count={myClinicAccounts.length} />
        {myClinicAccounts.length === 0 ? (
          <EmptyState
            icon={<Building2 className="w-10 h-10 stroke-1" />}
            message="No clinics yet"
            description="Onboard a clinical provider from the Onboarding page to see their clinic here."
            className="py-8"
          />
        ) : (
          <div className="space-y-2">
            {myClinicAccounts.map((clinic) => (
              <div
                key={clinic.id}
                className="flex items-center gap-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3"
              >
                <div className="w-8 h-8 rounded-full bg-[#EFF6FF] flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-[#15689E]">
                    {clinic.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0F172A] truncate">{clinic.name}</p>
                  <p className="text-xs text-[#94A3B8] truncate">{clinic.primaryDoctor}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#64748B] font-medium">
                    {clinic.memberCount} member{clinic.memberCount !== 1 ? "s" : ""}
                  </span>
                  <StatusBadge status={clinic.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* My Sub-Reps */}
      <div>
        <SectionHeading title="My Sub-Reps" count={mySubReps.length} />
        {mySubReps.length === 0 ? (
          <EmptyState
            icon={<Users className="w-10 h-10 stroke-1" />}
            message="No sub-reps yet"
            description="Invite a sub-rep from the Onboarding page."
            className="py-8"
          />
        ) : (
          <div className="space-y-2">
            {mySubReps.map((rep) => (
              <div
                key={rep.id}
                className="flex items-center gap-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3"
              >
                <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-orange-600">
                    {rep.first_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0F172A] truncate">
                    {rep.first_name} {rep.last_name}
                  </p>
                  <p className="text-xs text-[#94A3B8] truncate">{rep.email}</p>
                </div>
                <StatusBadge status={rep.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Provider view ── */
function ProviderTeamTab({ myClinicMembers }: { myClinicMembers: IFacilityMember[] }) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDeleteConfirm() {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await removeFacilityMember(deleteId);
      toast.success("Member removed.");
      setConfirmOpen(false);
    } catch {
      toast.error("Failed to remove member.");
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  }

  return (
    <div>
      <SectionHeading title="My Clinic Members" count={myClinicMembers.length} />
      {myClinicMembers.length === 0 ? (
        <EmptyState
          icon={<Users className="w-10 h-10 stroke-1" />}
          message="No clinic members yet"
          description="Invite clinical staff from the Onboarding page."
          className="py-8"
        />
      ) : (
        <div className="space-y-2">
          {myClinicMembers.map((member) => {
            const profile = member.member_profile;
            const name = profile ? `${profile.first_name} ${profile.last_name}` : "Unknown";
            return (
              <div
                key={member.id}
                className="flex items-center gap-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3"
              >
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
                  onClick={() => { setDeleteId(member.id); setConfirmOpen(true); }}
                  disabled={isDeleting && deleteId === member.id}
                  className="w-7 h-7 flex items-center justify-center rounded-md text-[#94A3B8] hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                  title="Remove member"
                >
                  {isDeleting && deleteId === member.id ? (
                    <div className="size-3.5 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={confirmOpen}
        onOpenChange={(v) => { if (!isDeleting) setConfirmOpen(v); }}
        onConfirm={handleDeleteConfirm}
        isLoading={isDeleting}
        title="Remove Member"
        description="This member will be removed from your team."
      />
    </div>
  );
}

/* ── Main export ── */
export function TeamTab({ isRep, myClinicAccounts, mySubReps, myClinicMembers }: TeamTabProps) {
  if (isRep) {
    return <RepTeamTab myClinicAccounts={myClinicAccounts} mySubReps={mySubReps} />;
  }
  return <ProviderTeamTab myClinicMembers={myClinicMembers} />;
}
