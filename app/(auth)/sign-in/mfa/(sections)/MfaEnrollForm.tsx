"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, Copy, Check } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MeridianLogo } from "@/app/(components)/MeridianLogo";
import { BackupCodesPanel } from "@/app/(components)/BackupCodesPanel";
import {
  beginMfaEnrollment,
  finishMfaEnrollment,
} from "@/app/(dashboard)/dashboard/settings/(services)/mfa-actions";
import { signOut } from "@/app/(dashboard)/dashboard/(services)/actions";

/**
 * First-time MFA setup, rendered when the dashboard gate sees an admin /
 * clinical_provider with no verified TOTP factor. Lives outside the
 * dashboard layout to avoid any chance of a redirect loop.
 *
 * Two phases: tap "Set up" to fetch a QR + secret from Supabase, then enter
 * the first 6-digit code to verify and lift the session to aal2. Once
 * verified, redirect to /dashboard.
 */
export function MfaEnrollForm() {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<{
    factorId: string;
    qrCode?: string;
    secret?: string;
  } | null>(null);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [isPending, startTransition] = useTransition();
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [pendingBackupCodes, setPendingBackupCodes] = useState<string[] | null>(null);

  // Auto-start enrollment on mount — the user is here because the gate
  // bounced them, so don't make them tap an extra button first.
  useEffect(() => {
    let cancelled = false;
    startTransition(async () => {
      const res = await beginMfaEnrollment();
      if (cancelled) return;
      if (!res.success) {
        const msg = res.error ?? "Failed to start enrollment.";
        setEnrollError(msg);
        toast.error(msg);
        return;
      }
      setEnrollment({
        factorId: res.factorId!,
        qrCode: res.qrCode,
        secret: res.secret,
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleVerify() {
    if (!enrollment) return;
    startTransition(async () => {
      const res = await finishMfaEnrollment(enrollment.factorId, code);
      if (!res.success) {
        toast.error(res.error ?? "Verification failed.");
        setCode("");
        return;
      }
      // First-time enrollment ALWAYS returns backup codes (this page only
      // renders for users with no existing factor). Show them once before
      // letting the user into the dashboard — losing this view = losing the
      // recovery path until they regenerate from settings.
      if (res.backupCodes && res.backupCodes.length > 0) {
        setPendingBackupCodes(res.backupCodes);
      } else {
        toast.success("Two-factor authentication enabled.");
        router.replace("/dashboard");
      }
    });
  }

  function handleAcknowledgeBackupCodes() {
    setPendingBackupCodes(null);
    toast.success("Two-factor authentication enabled.");
    router.replace("/dashboard");
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

  // Once verification succeeded and the server returned backup codes, the
  // user MUST acknowledge the codes before being let into the dashboard.
  // This is a fresh-enrollment screen so the codes panel takes the full
  // card; no QR / verify input visible here.
  if (pendingBackupCodes) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-6">
        <div className="w-full max-w-2xl rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-[0_8px_40px_rgba(0,0,0,0.1)]">
          <div className="mb-6 flex items-center justify-center">
            <MeridianLogo variant="light" size="lg" />
          </div>
          <BackupCodesPanel
            codes={pendingBackupCodes}
            onAcknowledge={handleAcknowledgeBackupCodes}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-6">
      <div className="w-full max-w-md select-none rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-[0_8px_40px_rgba(0,0,0,0.1)]">
        <div className="mb-6 flex items-center justify-center">
          <MeridianLogo variant="light" size="lg" />
        </div>

        <div className="mb-5 flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[var(--red)]" />
          <div>
            <h2 className="text-xl font-bold text-[#0F172A]">
              Set up two-factor authentication
            </h2>
            <p className="mt-1 text-sm text-[#64748B]">
              Your role has access to patient health information, so HIPAA
              requires a second authentication factor. Scan the QR code with
              an authenticator app (Google Authenticator, 1Password, Authy)
              and enter the 6-digit code below to finish.
            </p>
          </div>
        </div>

        {enrollError ? (
          <div className="space-y-3 py-2">
            <div className="rounded-md border border-[#fecaca] bg-[#fef2f2] p-3 text-sm text-[#991b1b]">
              <p className="font-semibold">Two-factor enrollment is not available</p>
              <p className="mt-1 text-[12px]">{enrollError}</p>
              <p className="mt-2 text-[12px]">
                If this is a configuration issue (TOTP disabled in the auth
                provider), an administrator needs to enable it before this
                account can finish setup.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isPending}
              className="w-full text-center text-xs text-[var(--text3)] hover:text-[var(--navy)]"
            >
              Sign out
            </button>
          </div>
        ) : !enrollment ? (
          <div className="py-6 text-center text-sm text-[var(--text3)]">
            Preparing your authenticator setup…
          </div>
        ) : (
          <div className="space-y-4">
            {enrollment.qrCode && (
              <div className="flex justify-center">
                <div className="rounded-md border border-[#E2E8F0] bg-white p-3">
                  {/* Supabase returns the QR as a data: URI (data:image/svg+xml;utf-8,…),
                      so render it as an <img>. dangerouslySetInnerHTML would print
                      the data: prefix as text. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={enrollment.qrCode}
                    alt="Authenticator QR code"
                    className="mx-auto h-44 w-44"
                  />
                </div>
              </div>
            )}

            {enrollment.secret && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[var(--text3)]">
                  Or enter this code manually
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 rounded-md border border-[#E2E8F0] bg-[var(--bg)] px-2 py-1.5 font-mono text-[12px] tracking-wider text-[var(--navy)]">
                    {enrollment.secret}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(enrollment.secret ?? "");
                      setCopiedSecret(true);
                      window.setTimeout(() => setCopiedSecret(false), 1500);
                    }}
                    className="flex items-center gap-1 rounded-md border border-[#E2E8F0] px-2 py-1.5 text-[11px] hover:bg-[var(--bg)]"
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
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                autoFocus
                className="mt-1 font-mono tracking-widest"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && code.length === 6 && !isPending) {
                    handleVerify();
                  }
                }}
              />
            </div>

            <Button
              onClick={handleVerify}
              disabled={code.length !== 6 || isPending}
              className="h-9 w-full bg-[var(--navy)] font-medium text-white hover:bg-[var(--navy)]/90 disabled:opacity-50"
            >
              {isPending ? "Verifying…" : "Verify and enable"}
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
        )}
      </div>
    </div>
  );
}
