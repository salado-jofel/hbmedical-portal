"use client";

import { useState } from "react";
import { Building2, Users, Briefcase } from "lucide-react";
import toast from "react-hot-toast";
import ConfirmModal from "@/app/(components)/ConfirmModal";
import { EmptyState } from "@/app/(components)/EmptyState";
import { removeFacilityMember } from "@/app/(dashboard)/dashboard/settings/(services)/actions";
import { TeamMemberRow } from "./TeamMemberRow";
import type { IFacilityMember } from "@/utils/interfaces/facility-members";
import type { ISubRep } from "@/utils/interfaces/sub-reps";
import type { IClinicAccount } from "@/utils/interfaces/settings";
import type { IAssignedRep } from "@/app/(dashboard)/dashboard/settings/(services)/actions";

interface TeamTabProps {
  isRep: boolean;
  myClinicAccounts: IClinicAccount[];
  mySubReps: ISubRep[];
  myClinicMembers: IFacilityMember[];
  myAssignedRep: IAssignedRep | null;
}

/* ── Status badge ── */
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; text: string; label: string }> = {
    active:   { bg: "bg-emerald-50", text: "text-emerald-600", label: "Active"   },
    inactive: { bg: "bg-[var(--border)]",  text: "text-[var(--text2)]",  label: "Inactive" },
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
      <p className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wide">{title}</p>
      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--border)] text-[var(--text2)] font-medium">
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
                className="flex items-center gap-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3"
              >
                <div className="w-8 h-8 rounded-full bg-[#EFF6FF] flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-[var(--navy)]">
                    {clinic.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--navy)] truncate">{clinic.name}</p>
                  <p className="text-xs text-[var(--text3)] truncate">{clinic.primaryDoctor}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--border)] text-[var(--text2)] font-medium">
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
                className="flex items-center gap-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3"
              >
                <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-orange-600">
                    {rep.first_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--navy)] truncate">
                    {rep.first_name} {rep.last_name}
                  </p>
                  <p className="text-xs text-[var(--text3)] truncate">{rep.email}</p>
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
function ProviderTeamTab({
  myClinicMembers,
  myAssignedRep,
}: {
  myClinicMembers: IFacilityMember[];
  myAssignedRep: IAssignedRep | null;
}) {
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
    <div className="space-y-8">
      {/* Assigned sales rep (if the clinic was onboarded via a rep invite) */}
      <div>
        <SectionHeading title="My Sales Rep" count={myAssignedRep ? 1 : 0} />
        {myAssignedRep ? (
          <div className="flex items-center gap-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-[var(--teal-lt)] flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-[var(--teal)]">
                {myAssignedRep.first_name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--navy)] truncate">
                {myAssignedRep.first_name} {myAssignedRep.last_name}
              </p>
              <p className="text-xs text-[var(--text3)] truncate">{myAssignedRep.email}</p>
            </div>
            <StatusBadge status={myAssignedRep.status} />
          </div>
        ) : (
          <EmptyState
            icon={<Briefcase className="w-10 h-10 stroke-1" />}
            message="No sales rep assigned"
            description="Your clinic isn't linked to a sales rep yet. Contact HB Medical support if you were expecting one."
            className="py-8"
          />
        )}
      </div>

      {/* Clinic members */}
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
            {myClinicMembers.map((member) => (
              <TeamMemberRow
                key={member.id}
                member={member}
                isDeleting={isDeleting && deleteId === member.id}
                onDeleteClick={(id) => { setDeleteId(id); setConfirmOpen(true); }}
              />
            ))}
          </div>
        )}
      </div>

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
export function TeamTab({
  isRep,
  myClinicAccounts,
  mySubReps,
  myClinicMembers,
  myAssignedRep,
}: TeamTabProps) {
  if (isRep) {
    return <RepTeamTab myClinicAccounts={myClinicAccounts} mySubReps={mySubReps} />;
  }
  return (
    <ProviderTeamTab
      myClinicMembers={myClinicMembers}
      myAssignedRep={myAssignedRep}
    />
  );
}
