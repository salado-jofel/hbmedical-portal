"use client";

import Link from "next/link";
import { CheckCircle, Mail, KeyRound, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MANUAL_ONBOARDING_PATH } from "@/utils/constants/manual-onboarding";

export function OnboardSuccess({
  providerEmail,
  facilityName,
}: {
  providerEmail: string;
  facilityName: string;
}) {
  const next = [
    { icon: Mail, text: `${providerEmail} received a link to set their password (copies of the signed agreements attached).` },
    { icon: Smartphone, text: "On first sign-in they verify their mobile number by SMS." },
    { icon: KeyRound, text: "Then they create their 4-digit signing PIN before reaching the dashboard." },
  ];

  return (
    <div className="max-w-xl mx-auto bg-white rounded-xl border border-[var(--border)] p-6 sm:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)] text-center space-y-5">
      <div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
        <CheckCircle className="w-7 h-7 text-emerald-600" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-[var(--navy)]">{facilityName} is onboarded</h2>
        <p className="text-sm text-[var(--text2)] mt-1">The clinic account is live and assigned to its sales rep.</p>
      </div>
      <ul className="text-left space-y-2.5">
        {next.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-2.5 text-sm text-[var(--text2)]">
            <Icon className="w-4 h-4 text-[var(--navy)] mt-0.5 shrink-0" />
            <span>{text}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-col sm:flex-row gap-2 justify-center pt-1">
        <Button asChild variant="outline" size="sm" className="h-9">
          <Link href="/dashboard/onboarding">Back to Onboarding</Link>
        </Button>
        <Button asChild size="sm" className="h-9 bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white">
          {/* Plain anchor: a full reload gives the wizard a fresh batch id. */}
          <a href={MANUAL_ONBOARDING_PATH}>Onboard another clinic</a>
        </Button>
      </div>
    </div>
  );
}
