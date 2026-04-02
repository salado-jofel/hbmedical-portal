"use client";

import { Share2, Users, UserPlus, Info } from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { InviteClinicForm } from "../(components)/InviteClinicForm";
import { InviteSubRepForm } from "../(components)/InviteSubRepForm";
import { InviteTokenCard } from "../(components)/InviteTokenCard";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/utils/helpers/role";

interface OnboardingPageClientProps {
  role: UserRole | null;
  baseUrl: string;
  hasCompletedSetup: boolean;
}

export function OnboardingPageClient({ role, baseUrl, hasCompletedSetup }: OnboardingPageClientProps) {
  const tokens = useAppSelector((s) => s.inviteTokens.items);
  const showSubRepSection = role === "sales_representative" || role === "admin";

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
            <InviteClinicForm baseUrl={baseUrl} />
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
            Your invite links ({tokens.length})
          </h2>
          <div className="space-y-2" suppressHydrationWarning>
            {tokens.map((token) => (
              <InviteTokenCard key={token.id} token={token} baseUrl={baseUrl} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
