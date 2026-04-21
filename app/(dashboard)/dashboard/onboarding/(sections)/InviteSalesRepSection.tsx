"use client";

import { Users } from "lucide-react";
import { InviteSalesRepForm } from "../(components)/InviteSalesRepForm";

interface InviteSalesRepSectionProps {
  showSection: boolean;
}

export function InviteSalesRepSection({
  showSection,
}: InviteSalesRepSectionProps) {
  if (!showSection) return null;

  return (
    <section className="bg-white rounded-xl border border-[var(--border)] p-5 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-[var(--navy)]" />
        <h2 className="text-base font-semibold text-[var(--navy)]">
          Invite Sales Rep
        </h2>
      </div>
      <p className="text-sm text-[var(--text2)]">
        Generate a one-time link to onboard a Sales Rep.
      </p>
      <div suppressHydrationWarning>
        <InviteSalesRepForm />
      </div>
    </section>
  );
}
