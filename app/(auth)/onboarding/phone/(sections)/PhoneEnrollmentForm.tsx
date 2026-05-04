"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Phone, ShieldCheck, KeyRound } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MeridianLogo } from "@/app/(components)/MeridianLogo";
import { signOut } from "@/app/(dashboard)/dashboard/(services)/actions";
import {
  startPhoneEnrollment,
  confirmPhoneEnrollment,
} from "../(services)/actions";

/**
 * Two-phase phone enrollment for sales reps.
 *
 *   Phase 1 ("phone"):  user types a phone number (E.164) → server sends
 *                       Twilio Verify code → we advance to Phase 2.
 *   Phase 2 ("code"):   user types the 6-digit code → server verifies →
 *                       saves phone + phone_verified_at to profiles → creates
 *                       SMS MFA session → redirect to /dashboard.
 *
 * "Use a different number" in Phase 2 returns to Phase 1 — useful if the
 * user typed the wrong number and didn't get the SMS.
 */
export function PhoneEnrollmentForm() {
  const router = useRouter();
  const [phase, setPhase] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [code, setCode] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSendCode() {
    startTransition(async () => {
      const res = await startPhoneEnrollment(phone);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setVerifiedPhone(res.phoneE164);
      setPhase("code");
      toast.success("Code sent.");
    });
  }

  function handleConfirm() {
    startTransition(async () => {
      const res = await confirmPhoneEnrollment(verifiedPhone, code);
      if (!res.success) {
        toast.error(res.error);
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
          <MeridianLogo variant="light" size="lg" />
        </div>

        <div className="mb-5 flex items-start gap-3">
          {phase === "phone" ? (
            <Phone className="mt-0.5 h-5 w-5 shrink-0 text-[var(--navy)]" />
          ) : (
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--navy)]" />
          )}
          <div>
            <h2 className="text-xl font-bold text-[#0F172A]">
              {phase === "phone"
                ? "Enroll your phone"
                : "Verify your phone"}
            </h2>
            <p className="mt-1 text-sm text-[#64748B]">
              {phase === "phone"
                ? "We'll text you a 6-digit code each time you sign in. Enter your phone in international format, e.g. +639310259241 or +14155551234."
                : `Enter the code we just sent to ${verifiedPhone}.`}
            </p>
          </div>
        </div>

        {phase === "phone" ? (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[var(--text3)]">
                Phone number
              </label>
              <div className="mt-1 flex items-center gap-2">
                <Phone className="h-4 w-4 text-[var(--text3)]" />
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+639310259241"
                  autoFocus
                  className="font-mono"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && phone.length >= 8 && !isPending) {
                      handleSendCode();
                    }
                  }}
                />
              </div>
              <p className="mt-1 text-[11px] text-[var(--text3)]">
                Must start with + and country code (E.164 format).
              </p>
            </div>

            <Button
              onClick={handleSendCode}
              disabled={phone.length < 8 || isPending}
              className="h-9 w-full bg-[var(--navy)] font-medium text-white hover:bg-[var(--navy)]/90 disabled:opacity-50"
            >
              {isPending ? "Sending…" : "Send verification code"}
            </Button>

            <button
              type="button"
              onClick={handleCancel}
              disabled={isPending}
              className="w-full text-center text-xs text-[var(--text3)] hover:text-[var(--navy)]"
            >
              Sign out
            </button>
          </div>
        ) : (
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
                      handleConfirm();
                    }
                  }}
                />
              </div>
            </div>

            <Button
              onClick={handleConfirm}
              disabled={code.length !== 6 || isPending}
              className="h-9 w-full bg-[var(--navy)] font-medium text-white hover:bg-[var(--navy)]/90 disabled:opacity-50"
            >
              {isPending ? "Verifying…" : "Verify and continue"}
            </Button>

            <button
              type="button"
              onClick={() => {
                setPhase("phone");
                setCode("");
              }}
              disabled={isPending}
              className="w-full text-center text-xs text-[var(--navy)] underline underline-offset-2 hover:text-[var(--navy)]/70"
            >
              ← Use a different number
            </button>

            <button
              type="button"
              onClick={handleCancel}
              disabled={isPending}
              className="w-full text-center text-xs text-[var(--text3)] hover:text-[var(--navy)]"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
