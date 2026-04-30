"use client";

import { useState, useTransition } from "react";
import { Banknote, ArrowRight, LogOut, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { MeridianLogo } from "@/app/(components)/MeridianLogo";
import { AuthCard } from "@/app/(components)/AuthCard";
import { createConnectOnboardingLink } from "@/app/(dashboard)/dashboard/settings/(services)/stripe-connect-actions";
import { signOut } from "@/app/(dashboard)/dashboard/(services)/actions";

interface PayoutsGateFormProps {
  hasAccount: boolean;
  email: string;
}

export default function PayoutsGateForm({
  hasAccount,
  email,
}: PayoutsGateFormProps) {
  const [isStarting, startStarting] = useTransition();
  const [isSigningOut, startSigningOut] = useTransition();
  const [redirecting, setRedirecting] = useState(false);

  const ctaLabel = hasAccount ? "Resume payout setup" : "Set up payouts";

  function handleStart() {
    startStarting(async () => {
      const res = await createConnectOnboardingLink(
        "/onboarding/payouts/return",
      );
      if (!res.success || !res.url) {
        toast.error(res.error ?? "Could not start Stripe onboarding.");
        return;
      }
      setRedirecting(true);
      window.location.href = res.url;
    });
  }

  function handleSignOut() {
    startSigningOut(() => signOut());
  }

  const busy = isStarting || redirecting;

  return (
    <AuthCard>
      <div className="flex flex-col items-center text-center mb-6">
        <MeridianLogo variant="light" size="md" asLink={false} />
      </div>

      <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#EFF6FF]">
        <Banknote className="h-6 w-6 text-[var(--navy)]" />
      </div>

      <h1 className="text-center text-xl font-semibold text-[var(--navy)]">
        Finish setting up payouts
      </h1>
      <p className="mt-2 text-center text-sm text-[var(--text2)]">
        Before you can use the portal, connect a bank account through Stripe so
        we can pay your commissions.
      </p>

      {hasAccount && (
        <p className="mt-3 text-center text-xs text-[var(--text3)]">
          You started this earlier — pick up where you left off.
        </p>
      )}

      <Button
        type="button"
        onClick={handleStart}
        disabled={busy}
        className="mt-6 w-full h-10 bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white gap-2 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Redirecting to Stripe…
          </>
        ) : (
          <>
            {ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>

      <p className="mt-4 text-center text-[11px] text-[var(--text3)]">
        Takes about 3 minutes. You'll be returned here automatically.
      </p>

      <div className="mt-6 border-t border-[var(--border)] pt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--text3)] truncate pr-2" title={email}>
            Signed in as {email || "—"}
          </span>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="inline-flex items-center gap-1 text-[var(--text2)] hover:text-[var(--navy)] transition-colors disabled:opacity-50"
          >
            {isSigningOut ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <LogOut className="h-3 w-3" />
            )}
            Sign out
          </button>
        </div>
      </div>
    </AuthCard>
  );
}
