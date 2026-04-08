"use client";

import { Users, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InviteClinicForm } from "../(components)/InviteClinicForm";
import type { RepWithFacility } from "@/utils/interfaces/onboarding";

interface InviteClinicSectionProps {
  isAdmin: boolean;
  showSection: boolean;
  hasCompletedSetup: boolean;
  repsWithFacilities: RepWithFacility[];
}

export function InviteClinicSection({
  isAdmin,
  showSection,
  hasCompletedSetup,
  repsWithFacilities,
}: InviteClinicSectionProps) {
  if (!showSection) return null;

  return (
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
            isAdmin={isAdmin}
            repsWithFacilities={repsWithFacilities}
          />
        )}
      </div>
    </section>
  );
}
