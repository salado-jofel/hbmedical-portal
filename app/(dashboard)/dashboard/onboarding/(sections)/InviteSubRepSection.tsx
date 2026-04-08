"use client";

import { UserPlus } from "lucide-react";
import { InviteSubRepForm } from "../(components)/InviteSubRepForm";

interface InviteSubRepSectionProps {
  showSection: boolean;
}

export function InviteSubRepSection({ showSection }: InviteSubRepSectionProps) {
  if (!showSection) return null;

  return (
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
  );
}
