"use client";

import { Share2, Users, UserPlus, Info } from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { InviteClinicForm } from "../(components)/InviteClinicForm";
import { InviteSubRepForm } from "../(components)/InviteSubRepForm";
import { InviteTokenCard } from "../(components)/InviteTokenCard";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/utils/helpers/role";
import type { RepWithFacility } from "../(services)/actions";

interface OnboardingPageClientProps {
  role: UserRole | null;
  baseUrl: string;
  hasCompletedSetup: boolean;
  isAdmin?: boolean;
  repsWithFacilities?: RepWithFacility[];
}

export function OnboardingPageClient({ role, baseUrl, hasCompletedSetup, isAdmin = false, repsWithFacilities = [] }: OnboardingPageClientProps) {
  const tokens = useAppSelector((s) => s.inviteTokens.items);
  const showSubRepSection = role === "sales_representative";

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 pb-5 mb-6 border-b border-[#E2E8F0]">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A]">Onboarding</h1>
          <p className="text-sm text-[#64748B] mt-0.5">Invite clinic users and manage rep access</p>
        </div>
      </div>

      {/* ── Admin note ── */}
      {role === "admin" && (
        <div className="flex items-start gap-2.5 bg-[#EFF6FF] border border-[#15689E]/20 rounded-xl px-4 py-3">
          <Info className="w-4 h-4 text-[#15689E] mt-0.5 shrink-0" />
          <p className="text-sm text-[#15689E]">
            Main rep and support staff accounts are managed from the{" "}
            <a href="/dashboard/users" className="font-semibold underline underline-offset-2">
              Users page
            </a>
            . Use the sections below to invite clinic users and sub-reps.
          </p>
        </div>
      )}

      {/* ── Section A — Invite Clinic User ── */}
      <section className="bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#15689E]" />
          <h2 className="text-base font-semibold text-[#0F172A]">Invite Clinic User</h2>
        </div>
        <p className="text-sm text-[#64748B]">
          Generate a one-time link to onboard a Clinical Provider or Clinical Staff
          member to the portal.
        </p>
        <div suppressHydrationWarning>
          {!hasCompletedSetup ? (
            <div className="flex flex-col gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-4">
              <div className="flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-700">
                  You need to complete your office setup before inviting clinic
                  users. Please complete your profile first.
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
            <InviteClinicForm baseUrl={baseUrl} isAdmin={isAdmin} repsWithFacilities={repsWithFacilities} />
          )}
        </div>
      </section>

      {/* ── Section B — Invite Sub-Rep ── */}
      {showSubRepSection && (
        <section className="bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[#E8821A]" />
            <h2 className="text-base font-semibold text-[#0F172A]">Invite Sub-Rep</h2>
          </div>
          <p className="text-sm text-[#64748B]">
            Invite a new sales representative to work under you.
          </p>
          <div suppressHydrationWarning>
            <InviteSubRepForm />
          </div>
        </section>
      )}

      {/* ── Existing Invite Links ── */}
      {tokens.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[#0F172A]">
            {isAdmin ? `All invite links (${tokens.length})` : `Your invite links (${tokens.length})`}
          </h2>
          {isAdmin ? (
            <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-[#94A3B8]">Created By</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-[#94A3B8] hidden sm:table-cell">Role Type</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-[#94A3B8] hidden md:table-cell">Expires</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-[#94A3B8] text-right">Status</th>
                  </tr>
                </thead>
                <tbody suppressHydrationWarning>
                  {tokens.map((token) => {
                    const isUsed = !!token.used_at;
                    const isExpired = !isUsed && token.expires_at ? new Date(token.expires_at) < new Date() : false;
                    const statusLabel = isUsed ? "Used" : isExpired ? "Expired" : "Active";
                    const statusStyle = isUsed
                      ? "bg-[#F1F5F9] text-[#64748B]"
                      : isExpired
                      ? "bg-red-50 text-red-600"
                      : "bg-emerald-50 text-emerald-700";
                    const dotStyle = isUsed ? "bg-[#94A3B8]" : isExpired ? "bg-red-400" : "bg-emerald-500";
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
                      <tr key={token.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#FAFBFC] transition-colors">
                        <td className="px-4 py-3.5">
                          <span className="text-sm text-[#0F172A] font-medium">{createdBy}</span>
                        </td>
                        <td className="px-4 py-3.5 hidden sm:table-cell">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[token.role_type] ?? "bg-[#F1F5F9] text-[#64748B]"}`}>
                            {roleLabels[token.role_type] ?? token.role_type}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 hidden md:table-cell">
                          <span className="text-xs text-[#64748B]">
                            {token.expires_at ? new Date(token.expires_at).toLocaleDateString() : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${dotStyle}`} />
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
                <InviteTokenCard key={token.id} token={token} baseUrl={baseUrl} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
