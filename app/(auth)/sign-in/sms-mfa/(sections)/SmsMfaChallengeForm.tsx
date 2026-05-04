"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, KeyRound, MessageSquare } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MeridianLogo } from "@/app/(components)/MeridianLogo";
import { signOut } from "@/app/(dashboard)/dashboard/(services)/actions";
import {
  requestSmsMfaCode,
  verifySmsMfaCode,
} from "../(services)/actions";

interface Props {
  /** Masked phone (e.g. "+63 ••••••••41"). Server-rendered for display only. */
  maskedPhone: string;
}

/**
 * SMS MFA challenge form for sales reps. Mirrors MfaChallengeForm.tsx but
 * uses Twilio Verify instead of TOTP. The page server-side triggers an
 * initial code send before render; this form provides Resend + Verify.
 *
 * Resend has a 30-second client-side cooldown to discourage button mashing
 * and stay well below Twilio's per-phone rate limits (5 sends per 10 min).
 */
export function SmsMfaChallengeForm({ maskedPhone }: Props) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(30);
  const [isPending, startTransition] = useTransition();

  // Cooldown timer for Resend button
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  function handleVerify() {
    startTransition(async () => {
      const res = await verifySmsMfaCode(code);
      if (!res.success) {
        toast.error(res.error);
        setCode("");
        return;
      }
      router.replace("/dashboard");
    });
  }

  function handleResend() {
    startTransition(async () => {
      const res = await requestSmsMfaCode();
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Code sent.");
      setResendIn(30);
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
          <MeridianLogo variant="light" size="lg" />
        </div>

        <div className="mb-5 flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--navy)]" />
          <div>
            <h2 className="text-xl font-bold text-[#0F172A]">
              Verify your phone
            </h2>
            <p className="mt-1 text-sm text-[#64748B]">
              We sent a code to{" "}
              <span className="font-medium text-[var(--navy)]">
                {maskedPhone}
              </span>
              . Enter it below to finish signing in.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[var(--text3)]">
              Verification code
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
            onClick={handleResend}
            disabled={isPending || resendIn > 0}
            className="flex w-full items-center justify-center gap-1.5 text-center text-xs text-[var(--navy)] underline underline-offset-2 hover:text-[var(--navy)]/70 disabled:no-underline disabled:text-[var(--text3)]"
          >
            <MessageSquare className="h-3 w-3" />
            {resendIn > 0
              ? `Resend code in ${resendIn}s`
              : "Resend code"}
          </button>

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
