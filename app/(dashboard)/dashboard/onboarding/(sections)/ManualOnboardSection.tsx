"use client";

import Link from "next/link";
import { FileSignature, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MANUAL_ONBOARDING_PATH } from "@/utils/constants/manual-onboarding";

/** Entry point for paper-signed onboarding. Shown to admins and sales reps
 *  who have finished office setup (same audience as the invite link). */
export function ManualOnboardSection({
  showSection,
  hasCompletedSetup,
}: {
  showSection: boolean;
  hasCompletedSetup: boolean;
}) {
  if (!showSection || !hasCompletedSetup) return null;

  return (
    <section className="bg-white rounded-xl border border-[var(--border)] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="shrink-0 w-10 h-10 rounded-lg bg-[var(--navy)]/5 text-[var(--navy)] flex items-center justify-center">
            <FileSignature className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[var(--navy)]">
              Clinic signed on paper?
            </h2>
            <p className="text-sm text-[var(--text2)] mt-0.5">
              Enter the clinic&apos;s details yourself and upload the scanned BAA and
              Product &amp; Services Agreement. The provider just sets a password.
            </p>
          </div>
        </div>
        <Button
          asChild
          size="sm"
          variant="outline"
          className="h-9 gap-1.5 shrink-0 border-[var(--navy)]/30 text-[var(--navy)] hover:bg-[#EFF6FF]"
        >
          <Link href={MANUAL_ONBOARDING_PATH}>
            Onboard manually <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
