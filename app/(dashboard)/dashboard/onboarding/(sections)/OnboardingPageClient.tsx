"use client";

import { useState, useActionState } from "react";
import {
  Share2,
  Users,
  UserPlus,
  UserX,
  UserCheck,
  Loader2,
  Info,
  Mail,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { removeInviteTokenFromStore } from "../(redux)/invite-tokens-slice";
import { InviteClinicForm } from "../(components)/InviteClinicForm";
import { InviteSubRepForm } from "../(components)/InviteSubRepForm";
import { InviteTokenCard } from "../(components)/InviteTokenCard";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/app/(components)/DataTable";
import ConfirmModal from "@/app/(components)/ConfirmModal";
import {
  updateSubRepStatus,
  generateClinicMemberInvite,
  deleteSubRep,
  resendSubRepInvite,
  deleteInviteToken,
} from "../(services)/actions";
import type { UserRole } from "@/utils/helpers/role";
import type { RepWithFacility } from "../(services)/actions";
import type { ISubRep } from "@/utils/interfaces/sub-reps";
import type { TableColumn } from "@/utils/interfaces/table-column";
import type { IInviteTokenFormState } from "@/utils/interfaces/invite-tokens";

type SubRepStatus = "pending" | "active" | "inactive";

const STATUS_CONFIG: Record<
  SubRepStatus,
  { bg: string; text: string; dot: string; label: string }
> = {
  active: {
    bg: "bg-emerald-50",
    text: "text-emerald-600",
    dot: "bg-emerald-500",
    label: "Active",
  },
  pending: {
    bg: "bg-amber-50",
    text: "text-amber-600",
    dot: "bg-amber-500",
    label: "Pending",
  },
  inactive: {
    bg: "bg-[#F1F5F9]",
    text: "text-gray-500",
    dot: "bg-gray-400",
    label: "Inactive",
  },
};

interface OnboardingPageClientProps {
  role: UserRole | null;
  baseUrl: string;
  hasCompletedSetup: boolean;
  isAdmin?: boolean;
  isSalesRep?: boolean;
  isClinicalProvider?: boolean;
  repsWithFacilities?: RepWithFacility[];
  subReps?: ISubRep[];
}

export function OnboardingPageClient({
  role,
  baseUrl,
  hasCompletedSetup,
  isAdmin = false,
  isSalesRep = false,
  isClinicalProvider = false,
  repsWithFacilities = [],
  subReps: initialSubReps = [],
}: OnboardingPageClientProps) {
  const dispatch = useAppDispatch();
  const tokens = useAppSelector((s) => s.inviteTokens.items);
  const router = useRouter();
  const showSubRepSection = isSalesRep;
  const showClinicStaffSection = isClinicalProvider;

  const [clinicInviteState, clinicInviteAction, isClinicInvitePending] =
    useActionState<IInviteTokenFormState | null, FormData>(
      generateClinicMemberInvite,
      null,
    );

  const [subReps, setSubReps] = useState<ISubRep[]>(initialSubReps);
  const [actionId, setActionId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [disableConfirmId, setDisableConfirmId] = useState<string | null>(null);

  const [deleteSubRepId, setDeleteSubRepId] = useState<string | null>(null);
  const [deleteSubRepConfirmOpen, setDeleteSubRepConfirmOpen] = useState(false);
  const [isDeletingSubRep, setIsDeletingSubRep] = useState(false);

  const [resendingId, setResendingId] = useState<string | null>(null);

  const [deleteTokenId, setDeleteTokenId] = useState<string | null>(null);
  const [tokenConfirmOpen, setTokenConfirmOpen] = useState(false);
  const [isDeletingToken, setIsDeletingToken] = useState(false);

  async function handleStatusChange(
    subRepId: string,
    status: "active" | "inactive",
  ) {
    setActionId(subRepId);
    setIsUpdating(true);
    try {
      const result = await updateSubRepStatus(subRepId, status);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update sub-rep status.");
        return;
      }
      setSubReps((prev) =>
        prev.map((r) => (r.id === subRepId ? { ...r, status } : r)),
      );
      toast.success(
        status === "inactive" ? "Sub-rep disabled." : "Sub-rep reactivated.",
      );
      router.refresh();
    } catch {
      toast.error("Failed to update sub-rep status.");
    } finally {
      setIsUpdating(false);
      setActionId(null);
      setDisableConfirmId(null);
    }
  }

  async function handleDeleteSubRepConfirm() {
    if (!deleteSubRepId) return;
    setIsDeletingSubRep(true);
    try {
      const result = await deleteSubRep(deleteSubRepId);
      if (!result.success) {
        toast.error(result.error ?? "Failed to delete sub-rep.");
        return;
      }
      setSubReps((prev) => prev.filter((r) => r.id !== deleteSubRepId));
      toast.success("Sub-rep deleted.");
      setDeleteSubRepConfirmOpen(false);
    } catch {
      toast.error("Failed to delete sub-rep.");
    } finally {
      setIsDeletingSubRep(false);
      setDeleteSubRepId(null);
    }
  }

  async function handleResendSubRep(rep: ISubRep) {
    setResendingId(rep.id);
    try {
      const result = await resendSubRepInvite(
        rep.id,
        rep.email,
        rep.first_name,
      );
      if (!result.success) {
        toast.error(result.error ?? "Failed to resend invite.");
        return;
      }
      toast.success("Invite resent.");
    } catch {
      toast.error("Failed to resend invite.");
    } finally {
      setResendingId(null);
    }
  }

  async function handleDeleteTokenConfirm() {
    if (!deleteTokenId) return;
    setIsDeletingToken(true);
    try {
      await deleteInviteToken(deleteTokenId);
      dispatch(removeInviteTokenFromStore(deleteTokenId));
      toast.success("Invite link deleted.");
      setTokenConfirmOpen(false);
    } catch {
      toast.error("Failed to delete invite link.");
    } finally {
      setIsDeletingToken(false);
      setDeleteTokenId(null);
    }
  }

  const subRepColumns: TableColumn<ISubRep>[] = [
    {
      key: "name",
      label: "Name",
      render: (rep) => (
        <div className="min-w-0">
          <p
            className={`text-sm font-medium truncate ${rep.status === "inactive" ? "text-[#94A3B8]" : "text-[#0F172A]"}`}
          >
            {rep.first_name} {rep.last_name}
          </p>
        </div>
      ),
    },
    {
      key: "email",
      label: "Email",
      headerClassName: "hidden sm:table-cell",
      cellClassName: "hidden sm:table-cell",
      render: (rep) => (
        <span className="text-sm text-[#64748B]">{rep.email}</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      headerClassName: "hidden sm:table-cell",
      cellClassName: "hidden sm:table-cell",
      render: (rep) => {
        const cfg = STATUS_CONFIG[rep.status] ?? STATUS_CONFIG.inactive;
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        );
      },
    },
    {
      key: "action",
      label: "",
      headerClassName: "text-right",
      cellClassName: "text-right",
      render: (rep) => {
        if (rep.status === "pending") {
          const isResending = resendingId === rep.id;
          const isDeleting = isDeletingSubRep && deleteSubRepId === rep.id;
          return (
            <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleResendSubRep(rep);
                }}
                disabled={isResending || isDeleting}
                className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-[#94A3B8] hover:text-[#15689E] hover:bg-[#EFF6FF] transition-all disabled:opacity-40"
                title="Resend invite"
              >
                {isResending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Mail className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">Resend</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteSubRepId(rep.id);
                  setDeleteSubRepConfirmOpen(true);
                }}
                disabled={isResending || isDeleting}
                className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-[#94A3B8] hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-40"
                title="Delete sub-rep"
              >
                {isDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          );
        }

        if (rep.status === "active") {
          const isActing = isUpdating && actionId === rep.id;
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDisableConfirmId(rep.id);
              }}
              disabled={isActing}
              className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-[#94A3B8] hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-40 opacity-0 group-hover:opacity-100"
              title="Deactivate sub-rep"
            >
              {isActing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <UserX className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Deactivate</span>
            </button>
          );
        }

        // inactive
        const isThisLoading =
          (isUpdating && actionId === rep.id) ||
          (isDeletingSubRep && deleteSubRepId === rep.id);
        return (
          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
              disabled={isThisLoading}
              onClick={(e) => {
                e.stopPropagation();
                handleStatusChange(rep.id, "active");
              }}
            >
              {isThisLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <UserCheck className="w-3.5 h-3.5" />
              )}
              Activate
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-8 text-xs gap-1.5"
              disabled={isThisLoading}
              onClick={(e) => {
                e.stopPropagation();
                setDeleteSubRepId(rep.id);
                setDeleteSubRepConfirmOpen(true);
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="p-6 md:p-8 max-w-480 mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 pb-5 mb-6 border-b border-[#E2E8F0]">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A]">Onboarding</h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            Invite clinic users and manage rep access
          </p>
        </div>
      </div>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* ── Admin note ── */}
        {isAdmin && (
          <div className="flex items-start gap-2.5 bg-[#EFF6FF] border border-[#15689E]/20 rounded-xl px-4 py-3">
            <Info className="w-4 h-4 text-[#15689E] mt-0.5 shrink-0" />
            <p className="text-sm text-[#15689E]">
              Admin, Sales Rep, and Support Staff accounts are managed from the{" "}
              <a
                href="/dashboard/users"
                className="font-semibold underline underline-offset-2"
              >
                Users page
              </a>
              . Use the section below to invite clinical users.
            </p>
          </div>
        )}

        {/* ── Section A — Invite Clinic User (admin + sales rep only) ── */}
        {(isAdmin || showSubRepSection) && (
          <section className="bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#15689E]" />
              <h2 className="text-base font-semibold text-[#0F172A]">
                Invite Clinic User
              </h2>
            </div>
            <p className="text-sm text-[#64748B]">
              Generate a one-time link to onboard a Clinical Provider or
              Clinical Staff member to the portal.
            </p>
            <div suppressHydrationWarning>
              {!hasCompletedSetup ? (
                <div className="flex flex-col gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-4">
                  <div className="flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                    <p className="text-sm text-amber-700">
                      You need to complete your office setup before inviting
                      clinic users. Please complete your profile first.
                    </p>
                  </div>
                  <Button
                    asChild
                    size="sm"
                    className="self-start h-9 bg-[#15689E] hover:bg-[#125d8e] text-white rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition-colors"
                  >
                    <a href="/onboarding/setup">Complete Setup</a>
                  </Button>
                </div>
              ) : (
                <InviteClinicForm
                  baseUrl={baseUrl}
                  isAdmin={isAdmin}
                  repsWithFacilities={repsWithFacilities}
                />
              )}
            </div>
          </section>
        )}

        {/* ── Section B — Invite Clinic Staff (clinical_provider only) ── */}
        {showClinicStaffSection && (
          <section className="bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#15689E]" />
              <h2 className="text-base font-semibold text-[#0F172A]">
                Invite Clinic Staff
              </h2>
            </div>
            <p className="text-sm text-[#64748B]">
              Generate a one-time link to invite a Clinical Staff member to your
              facility.
            </p>
            {clinicInviteState?.error && (
              <p className="text-xs text-red-600">{clinicInviteState.error}</p>
            )}
            {clinicInviteState?.success && clinicInviteState.token ? (
              <div
                className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3"
                suppressHydrationWarning
              >
                <Share2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <p className="text-xs text-emerald-700 font-medium break-all">
                  {baseUrl}/invite/{clinicInviteState.token}
                </p>
              </div>
            ) : (
              <form action={clinicInviteAction}>
                <input type="hidden" name="expires_in_days" value="30" />
                <Button
                  type="submit"
                  size="sm"
                  disabled={isClinicInvitePending}
                  className="h-9 bg-[#15689E] hover:bg-[#125d8e] text-white rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition-colors"
                >
                  {isClinicInvitePending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4 mr-2" />
                      Generate Invite Link
                    </>
                  )}
                </Button>
              </form>
            )}
          </section>
        )}

        {/* ── Section D — Invite Sub-Rep ── */}
        {showSubRepSection && (
          <section className="bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#E8821A]" />
              <h2 className="text-base font-semibold text-[#0F172A]">
                Invite Sub-Rep
              </h2>
            </div>
            <p className="text-sm text-[#64748B]">
              Invite a new sales representative to work under you.
            </p>
            <div suppressHydrationWarning>
              <InviteSubRepForm />
            </div>
          </section>
        )}

        {/* ── Section E — My Sub-Reps ── */}
        {/* {showSubRepSection && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#64748B]" />
            <h2 className="text-base font-semibold text-[#0F172A]">
              My Sub-Reps
              {subReps.length > 0 && (
                <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full font-medium bg-[#F1F5F9] text-[#64748B]">
                  {subReps.length}
                </span>
              )}
            </h2>
          </div>
          <DataTable
            columns={subRepColumns}
            data={subReps}
            keyExtractor={(r) => r.id}
            emptyMessage="No sub-reps yet. Use the section above to invite one."
            emptyIcon={<Users className="w-10 h-10 stroke-1" />}
            rowClassName="group"
          />
        </section>
      )} */}

        {/* ── Existing Invite Links ── */}
        {tokens.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-[#0F172A]">
              {isAdmin
                ? `All invite links (${tokens.length})`
                : `Your invite links (${tokens.length})`}
            </h2>
            {isAdmin ? (
              <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                      <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-[#94A3B8]">
                        Created By
                      </th>
                      <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-[#94A3B8] hidden sm:table-cell">
                        Role Type
                      </th>
                      <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-[#94A3B8] hidden md:table-cell">
                        Expires
                      </th>
                      <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-[#94A3B8] text-right">
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
                        ? "bg-[#F1F5F9] text-[#64748B]"
                        : isExpired
                          ? "bg-red-50 text-red-600"
                          : "bg-emerald-50 text-emerald-700";
                      const dotStyle = isUsed
                        ? "bg-[#94A3B8]"
                        : isExpired
                          ? "bg-red-400"
                          : "bg-emerald-500";
                      const roleColors: Record<string, string> = {
                        clinical_provider: "bg-teal-50 text-teal-700",
                        clinical_staff: "bg-[#F1F5F9] text-[#64748B]",
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
                          className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#FAFBFC] transition-colors"
                        >
                          <td className="px-4 py-3.5">
                            <span className="text-sm text-[#0F172A] font-medium">
                              {createdBy}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 hidden sm:table-cell">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[token.role_type] ?? "bg-[#F1F5F9] text-[#64748B]"}`}
                            >
                              {roleLabels[token.role_type] ?? token.role_type}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 hidden md:table-cell">
                            <span className="text-xs text-[#64748B]">
                              {token.expires_at
                                ? new Date(
                                    token.expires_at,
                                  ).toLocaleDateString()
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
                    baseUrl={baseUrl}
                    onDeleteClick={() => {
                      setDeleteTokenId(token.id);
                      setTokenConfirmOpen(true);
                    }}
                    isDeleting={isDeletingToken && deleteTokenId === token.id}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Deactivate Sub-Rep Confirm ── */}
        <ConfirmModal
          open={disableConfirmId !== null}
          onOpenChange={(open) => {
            if (!open) setDisableConfirmId(null);
          }}
          title="Deactivate Sub-Rep?"
          description="This sub-rep will lose portal access immediately. You can reactivate them at any time."
          confirmLabel="Deactivate Sub-Rep"
          isLoading={isUpdating && actionId === disableConfirmId}
          onConfirm={() => {
            if (disableConfirmId)
              handleStatusChange(disableConfirmId, "inactive");
          }}
        />

        {/* ── Delete Sub-Rep Confirm ── */}
        <ConfirmModal
          open={deleteSubRepConfirmOpen}
          onOpenChange={(v) => {
            if (!isDeletingSubRep) {
              setDeleteSubRepConfirmOpen(v);
              if (!v) setDeleteSubRepId(null);
            }
          }}
          title="Delete Sub-Rep?"
          description="This will permanently remove the sub-rep and revoke their access. This action cannot be undone."
          confirmLabel="Delete Sub-Rep"
          isLoading={isDeletingSubRep}
          onConfirm={handleDeleteSubRepConfirm}
        />

        {/* ── Delete Invite Token Confirm ── */}
        <ConfirmModal
          open={tokenConfirmOpen}
          onOpenChange={(v) => {
            if (!isDeletingToken) {
              setTokenConfirmOpen(v);
              if (!v) setDeleteTokenId(null);
            }
          }}
          title="Delete Invite Link?"
          description="This invite link will be permanently deleted and can no longer be used."
          confirmLabel="Delete"
          isLoading={isDeletingToken}
          onConfirm={handleDeleteTokenConfirm}
        />
      </div>
    </div>
  );
}
