"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, KeyRound } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HBLogo } from "@/app/(components)/HBLogo";
import { challengeAndVerifyMfa } from "@/app/(dashboard)/dashboard/settings/(services)/mfa-actions";
import { signOut } from "@/app/(dashboard)/dashboard/(services)/actions";

/**
 * Sign-in step-up: user already authenticated with password (aal1) but a
 * verified TOTP factor is on the account, so we challenge here before
 * letting them into /dashboard.
 *
 * Submitting a valid 6-digit code lifts the session to aal2; the layout
 * gate then lets them through. Cancel → sign out.
 */
export function MfaChallengeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleVerify() {
    startTransition(async () => {
      const res = await challengeAndVerifyMfa(code);
      if (!res.success) {
        toast.error(res.error ?? "Verification failed.");
        setCode("");
        return;
      }
      router.replace("/dashboard");
    });
  }

  function handleCancel() {
    startTransition(async () => {
      try {
        await signOut();
      } catch {
        router.replace("/sign-in");
      }
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md select-none rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-[0_8px_40px_rgba(0,0,0,0.1)]">
        <div className="mb-6 flex items-center justify-center">
          <HBLogo variant="light" size="lg" />
        </div>

        <div className="mb-5 flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--navy)]" />
          <div>
            <h2 className="text-xl font-bold text-[#0F172A]">
              Two-factor authentication
            </h2>
            <p className="mt-1 text-sm text-[#64748B]">
              Enter the 6-digit code from your authenticator app to finish
              signing in.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[var(--text3)]">
              Authenticator code
            </label>
            <div className="mt-1 flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-[var(--text3)]" />
              <Input
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                autoFocus
                className="font-mono tracking-widest"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && code.length === 6 && !isPending) {
                    handleVerify();
                  }
                }}
              />
            </div>
          </div>

          <Button
            onClick={handleVerify}
            disabled={code.length !== 6 || isPending}
            className="h-9 w-full bg-[var(--navy)] font-medium text-white hover:bg-[var(--navy)]/90 disabled:opacity-50"
          >
            {isPending ? "Verifying…" : "Verify"}
          </Button>

          <button
            type="button"
            onClick={handleCancel}
            disabled={isPending}
            className="w-full text-center text-xs text-[var(--text3)] hover:text-[var(--navy)]"
          >
            Sign out and try a different account
          </button>
        </div>
      </div>
    </div>
  );
}
