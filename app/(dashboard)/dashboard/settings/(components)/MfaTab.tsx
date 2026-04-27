"use client";

import { useEffect, useState, useTransition } from "react";
import { ShieldCheck, ShieldAlert, KeyRound, Loader2, Copy, Check } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  beginMfaEnrollment,
  disableMfa,
  finishMfaEnrollment,
  getMfaStatus,
  type MfaStatus,
} from "../(services)/mfa-actions";

interface MfaTabProps {
  /** When true, the user's role mandates MFA — disabling shows a stronger warning. */
  mandatory: boolean;
}

/**
 * Two-factor enrollment UI. Three states:
 *   1. Idle (not enrolled) — show "Set up two-factor authentication" button
 *   2. Pending verification — QR code + secret + 6-digit input
 *   3. Enrolled — show "Two-factor is on" + Disable button
 *
 * The `mandatory` prop controls the wording around disabling. For roles
 * where MFA is required (admin, clinical_provider), disabling triggers an
 * immediate redirect back here on the next dashboard load — see the
 * MfaGate in dashboard layout.
 */
export function MfaTab({ mandatory }: MfaTabProps) {
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [enrollment, setEnrollment] = useState<{
    factorId: string;
    qrCode?: string;
    secret?: string;
    uri?: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [isPending, startTransition] = useTransition();
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getMfaStatus()
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch((err) => console.error("[MfaTab] getMfaStatus failed:", err));
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  function handleBegin() {
    startTransition(async () => {
      const res = await beginMfaEnrollment();
      if (!res.success) {
        toast.error(res.error ?? "Failed to start enrollment.");
        return;
      }
      setEnrollment({
        factorId: res.factorId!,
        qrCode: res.qrCode,
        secret: res.secret,
        uri: res.uri,
      });
    });
  }

  function handleVerify() {
    if (!enrollment) return;
    startTransition(async () => {
      const res = await finishMfaEnrollment(enrollment.factorId, code);
      if (!res.success) {
        toast.error(res.error ?? "Verification failed.");
        return;
      }
      toast.success("Two-factor authentication enabled.");
      setEnrollment(null);
      setCode("");
      setRefreshTick((n) => n + 1);
    });
  }

  function handleDisable() {
    const confirmMsg = mandatory
      ? "Your role requires two-factor authentication. Disabling now will sign you out and require re-enrollment on next sign-in. Continue?"
      : "Disable two-factor authentication?";
    if (!window.confirm(confirmMsg)) return;
    startTransition(async () => {
      const res = await disableMfa();
      if (!res.success) {
        toast.error(res.error ?? "Failed to disable.");
        return;
      }
      toast.success("Two-factor authentication disabled.");
      setRefreshTick((n) => n + 1);
    });
  }

  if (!status) {
    return (
      <div className="flex items-center gap-2 text-[12px] text-[var(--text3)]">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading…
      </div>
    );
  }

  // Pending enrollment — QR code + verification input
  if (enrollment) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 shrink-0 text-[var(--navy)]" />
          <div>
            <h3 className="text-[14px] font-semibold text-[var(--navy)]">
              Scan with your authenticator app
            </h3>
            <p className="mt-1 text-[12px] text-[var(--text2)]">
              Use Google Authenticator, 1Password, Authy, or any TOTP app. Once
              the code shows up, type it below to confirm enrollment.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[auto_1fr]">
          {enrollment.qrCode && (
            <div className="rounded-md border border-[var(--border)] bg-white p-3">
              {/* Supabase returns the QR as a data: URI; render as <img>. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={enrollment.qrCode}
                alt="Authenticator QR code"
                className="mx-auto h-44 w-44"
              />
            </div>
          )}

          <div className="space-y-3">
            {enrollment.secret && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[var(--text3)]">
                  Or enter this code manually
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 font-mono text-[12px] tracking-wider text-[var(--navy)]">
                    {enrollment.secret}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(enrollment.secret ?? "");
                      setCopiedSecret(true);
                      window.setTimeout(() => setCopiedSecret(false), 1500);
                    }}
                    className="flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1.5 text-[11px] hover:bg-[var(--bg)]"
                  >
                    {copiedSecret ? (
                      <>
                        <Check className="h-3 w-3" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" /> Copy
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[var(--text3)]">
                6-digit code from your app
              </label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                className="mt-1 font-mono tracking-widest"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                onClick={handleVerify}
                disabled={code.length !== 6 || isPending}
                className="bg-[var(--navy)] text-white hover:bg-[var(--navy)]/90"
              >
                {isPending ? "Verifying…" : "Verify and enable"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setEnrollment(null);
                  setCode("");
                }}
                disabled={isPending}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Enrolled
  if (status.enrolled) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 shrink-0 text-[var(--green)]" />
          <div>
            <h3 className="text-[14px] font-semibold text-[var(--navy)]">
              Two-factor authentication is on
            </h3>
            <p className="mt-1 text-[12px] text-[var(--text2)]">
              Your account is protected with an authenticator code at sign-in.
            </p>
          </div>
        </div>
        <div className="pt-1">
          <Button
            variant="outline"
            onClick={handleDisable}
            disabled={isPending}
            className="text-[var(--red)] hover:bg-[#fef2f2]"
          >
            {isPending ? "Working…" : "Disable two-factor"}
          </Button>
        </div>
      </div>
    );
  }

  // Not enrolled
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        {mandatory ? (
          <ShieldAlert className="h-5 w-5 shrink-0 text-[var(--red)]" />
        ) : (
          <KeyRound className="h-5 w-5 shrink-0 text-[var(--text3)]" />
        )}
        <div>
          <h3 className="text-[14px] font-semibold text-[var(--navy)]">
            {mandatory
              ? "Two-factor authentication is required"
              : "Set up two-factor authentication"}
          </h3>
          <p className="mt-1 text-[12px] text-[var(--text2)]">
            {mandatory
              ? "Your role has access to patient health information, so HIPAA requires a second authentication factor. You'll be prompted at sign-in for a 6-digit code from your authenticator app."
              : "Add a second layer of security to your account. You'll be asked for a 6-digit code at sign-in."}
          </p>
        </div>
      </div>
      <div className="pt-1">
        <Button
          onClick={handleBegin}
          disabled={isPending}
          className="bg-[var(--navy)] text-white hover:bg-[var(--navy)]/90"
        >
          {isPending ? "Starting…" : "Set up two-factor"}
        </Button>
      </div>
    </div>
  );
}
