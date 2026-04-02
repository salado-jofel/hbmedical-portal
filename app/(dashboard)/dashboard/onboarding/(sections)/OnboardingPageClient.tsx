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
    <div className="p-4 md:p-8 mx-auto max-w-3xl space-y-8">
      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#15689E]/10 flex items-center justify-center shrink-0">
          <Share2 className="w-5 h-5 text-[#15689E]" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">Onboarding</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Invite clinic users and manage rep access
          </p>
        </div>
      </div>

      {/* ── Admin note ── */}
      {role === "admin" && (
        <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-700">
            Main rep and support staff accounts are managed from the{" "}
            <a href="/dashboard/users" className="font-semibold underline underline-offset-2">
              Users page
            </a>
            . Use the sections below to invite clinic users and sub-reps.
          </p>
        </div>
      )}

      {/* ── Section A — Invite Clinic User ── */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#15689E]" />
          <h2 className="text-base font-semibold text-slate-800">Invite Clinic User</h2>
        </div>
        <p className="text-sm text-slate-500">
          Generate a one-time link to onboard a Clinical Provider or Clinical Staff
          member to the portal.
        </p>
        <div suppressHydrationWarning>
          {!hasCompletedSetup ? (
            <div className="flex flex-col gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-4">
              <div className="flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-800">
                  You need to complete your office setup before inviting clinic
                  users. Please complete your profile first.
                </p>
              </div>
              <Button
                asChild
                size="sm"
                className="self-start bg-[#15689E] hover:bg-[#15689E]/90 text-white"
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
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[#e8821a]" />
            <h2 className="text-base font-semibold text-slate-800">Invite Sub-Rep</h2>
          </div>
          <p className="text-sm text-slate-500">
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
          <h2 className="text-sm font-semibold text-slate-700">
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
