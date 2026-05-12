"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, KeyRound, MessageSquare, AlertCircle } from "lucide-react";
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
  /** Where to send the user after successful verify. Defaults to /dashboard. */
  returnTo?: string;
  /** Error message from the server-side auto-send, if any. Surfaced as
   *  an inline alert so the user knows the SMS won't arrive without action. */
  initialSendError?: string | null;
  /** True when the server skipped the auto-send because a code was already
   *  sent within the cooldown window. Used to soften the resend cooldown
   *  copy ("Code already sent" instead of "Wait 30s"). */
  initialSendSkipped?: boolean;
}

/**
 * SMS MFA challenge form for sales reps. Mirrors MfaChallengeForm.tsx but
 * uses Twilio Verify instead of TOTP. The page server-side triggers an
 * initial code send before render; this form provides Resend + Verify.
 *
 * Resend has a 30-second client-side cooldown to discourage button mashing
 * and stay well below Twilio's per-phone rate limits (5 sends per 10 min).
 */
export function SmsMfaChallengeForm({
  maskedPhone,
  returnTo = "/dashboard",
  initialSendError = null,
  initialSendSkipped = false,
}: Props) {
  const router = useRouter();
  const [code, setCode] = useState("");
  // If the server send failed, allow Resend immediately (no cooldown — the
  // user needs to retry to get any SMS at all).
  const [resendIn, setResendIn] = useState(initialSendError ? 0 : 30);
  const [sendError, setSendError] = useState<string | null>(initialSendError);
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
      router.replace(returnTo);
    });
  }

  function handleResend() {
    startTransition(async () => {
      const res = await requestSmsMfaCode();
      if (!res.success) {
        // Promote to inline alert (persistent) + toast (transient) so the user
        // can still see the reason after the toast fades.
        setSendError(res.error);
        toast.error(res.error);
        return;
      }
      setSendError(null);
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F0F7FF] to-[#F8FAFC] px-4">
      <div className="w-full max-w-md select-none rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-[0_8px_40px_rgba(0,0,0,0.1)]">
        <div className="mb-6 flex items-center justify-center">
          <MeridianLogo variant="light" size="lg" />
        </div>

        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--navy)]/10">
            <ShieldCheck className="h-6 w-6 text-[var(--navy)]" />
          </div>
          <h2 className="text-2xl font-bold text-[#0F172A]">
            Verify your phone
          </h2>
          <p className="mt-1.5 text-sm text-[#64748B]">
            {sendError
              ? "Couldn't send a code to "
              : initialSendSkipped
                ? "A code was just sent to "
                : "We sent a code to "}
            <span className="font-medium text-[var(--navy)]">
              {maskedPhone}
            </span>
            .
          </p>
        </div>

        {sendError && (
          <div className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            <div>
              <p className="font-semibold">SMS not sent</p>
              <p className="mt-0.5">{sendError}</p>
              <p className="mt-1 text-red-600/80">
                Try{" "}
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isPending}
                  className="underline underline-offset-2 hover:no-underline disabled:opacity-50"
                >
                  resend
                </button>{" "}
                — if it keeps failing, contact your administrator.
              </p>
            </div>
          </div>
        )}

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
