"use client";

import { useEffect, useState, useTransition } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  X,
} from "lucide-react";
import * as RadixDialog from "@radix-ui/react-dialog";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BackupCodesPanel } from "@/app/(components)/BackupCodesPanel";
import { cn } from "@/utils/utils";
import {
  beginMfaEnrollment,
  finishMfaEnrollment,
  getMfaStatus,
  regenerateBackupCodes,
  type MfaStatus,
} from "../(services)/mfa-actions";
import { BACKUP_CODE_COUNT } from "@/utils/constants/mfa";

interface MfaTabProps {
  /** When true, the user's role mandates MFA. Currently every role does, so
   *  this is effectively always true; kept as a prop for future flexibility. */
  mandatory: boolean;
}

/**
 * Two-factor enrollment + management UI. Four states:
 *   1. IDLE / not enrolled    — "Set up two-factor authentication" button
 *   2. ENROLLING              — QR + secret + 6-digit input (verify)
 *   3. SHOWING_BACKUP_CODES   — display 10 codes (one-time, must acknowledge)
 *   4. ENROLLED               — status + codes-remaining + Regenerate + Replace
 *
 * The flow never destroys the working factor before the new one is verified
 * (`finishMfaEnrollment` handles that atomically server-side). For mandatory
 * roles there's no "Disable" — only "Replace authenticator", which goes
 * through the same enrollment path. Loss-of-device recovery happens via
 * backup codes at the sign-in challenge or admin reset.
 */
export function MfaTab({ mandatory }: MfaTabProps) {
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [enrollment, setEnrollment] = useState<{
    factorId: string;
    qrCode?: string;
    secret?: string;
    uri?: string;
    isReplace: boolean;
  } | null>(null);
  const [code, setCode] = useState("");
  const [pendingBackupCodes, setPendingBackupCodes] = useState<string[] | null>(null);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
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
        isReplace: !!res.isReplace,
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
      setEnrollment(null);
      setCode("");

      // First-time enrollment returns backup codes — must be shown to the
      // user once. Replace flows return undefined; nothing to display.
      if (res.backupCodes && res.backupCodes.length > 0) {
        setPendingBackupCodes(res.backupCodes);
      } else {
        toast.success(
          res.wasReplace
            ? "Authenticator replaced. Old device is now signed out."
            : "Two-factor authentication enabled.",
        );
        setRefreshTick((n) => n + 1);
      }
    });
  }

  function handleRegenerateBackupCodes() {
    setShowRegenerateConfirm(true);
  }

  function confirmRegenerateBackupCodes() {
    startTransition(async () => {
      const res = await regenerateBackupCodes();
      setShowRegenerateConfirm(false);
      if (!res.success || !res.codes) {
        toast.error(res.error ?? "Failed to regenerate codes.");
        return;
      }
      setPendingBackupCodes(res.codes);
    });
  }

  function handleAcknowledgeBackupCodes() {
    setPendingBackupCodes(null);
    toast.success("Backup codes saved.");
    setRefreshTick((n) => n + 1);
  }

  if (!status) {
    return (
      <div className="flex items-center gap-2 text-[12px] text-[var(--text3)]">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading…
      </div>
    );
  }

  // ── State 3: showing backup codes (one-time display) ───────────────────
  if (pendingBackupCodes) {
    return (
      <BackupCodesPanel
        codes={pendingBackupCodes}
        onAcknowledge={handleAcknowledgeBackupCodes}
      />
    );
  }

  // ── State 2: pending enrollment (QR + verify) ─────────────────────────
  if (enrollment) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 shrink-0 text-[var(--navy)]" />
          <div>
            <h3 className="text-[14px] font-semibold text-[var(--navy)]">
              {enrollment.isReplace
                ? "Scan with your new authenticator"
                : "Scan with your authenticator app"}
            </h3>
            <p className="mt-1 text-[12px] text-[var(--text2)]">
              {enrollment.isReplace
                ? "Your existing authenticator stays active until you confirm the new code below — so you can't lock yourself out by abandoning this flow."
                : "Use Google Authenticator, 1Password, Authy, or any TOTP app. Once the code shows up, type it below to confirm enrollment."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[auto_1fr]">
          {enrollment.qrCode && (
            <div className="rounded-md border border-[var(--border)] bg-white p-3">
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
                {isPending ? "Verifying…" : enrollment.isReplace ? "Verify and replace" : "Verify and enable"}
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

  // ── State 4: enrolled — manage existing factor ────────────────────────
  if (status.enrolled) {
    const lowCodes = status.backupCodesRemaining < 3;
    return (
      <div className="space-y-4">
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

        {/* Backup codes status panel */}
        <div
          className={
            "rounded-md border p-3 " +
            (lowCodes
              ? "border-[var(--red)]/30 bg-[#fef2f2]"
              : "border-[var(--border)] bg-[var(--bg)]")
          }
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              {lowCodes ? (
                <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--red)] mt-0.5" />
              ) : (
                <KeyRound className="h-4 w-4 shrink-0 text-[var(--text3)] mt-0.5" />
              )}
              <div>
                <p className="text-[13px] font-semibold text-[var(--navy)]">
                  {status.backupCodesRemaining} of {BACKUP_CODE_COUNT} backup codes remaining
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--text2)]">
                  {lowCodes
                    ? "You're running low. Regenerate now so you don't get locked out if you lose your authenticator."
                    : "Single-use recovery codes. Use one if you ever lose your phone."}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRegenerateBackupCodes}
              disabled={isPending}
              className="shrink-0"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Regenerate
            </Button>
          </div>
        </div>

        <div className="pt-1">
          <Button
            variant="outline"
            onClick={handleBegin}
            disabled={isPending}
          >
            {isPending ? "Working…" : "Replace authenticator"}
          </Button>
          <p className="mt-1 text-[11px] text-[var(--text3)]">
            Got a new phone? Lost your old authenticator app? Replace your device — your existing setup stays active until the new one is confirmed.
          </p>
        </div>

        <RegenerateConfirmModal
          open={showRegenerateConfirm}
          remaining={status.backupCodesRemaining}
          isPending={isPending}
          onConfirm={confirmRegenerateBackupCodes}
          onCancel={() => setShowRegenerateConfirm(false)}
        />
      </div>
    );
  }

  // ── State 1: not enrolled ─────────────────────────────────────────────
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

/**
 * Polished confirmation modal for the "Regenerate backup codes" action.
 * Built on Radix Dialog primitives (focus trap, ESC, click-outside) but
 * with a custom amber/warning visual — replaces the native window.confirm
 * which looked dated and bypassed our design system.
 */
function RegenerateConfirmModal({
  open,
  remaining,
  isPending,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  remaining: number;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <RadixDialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v && !isPending) onCancel();
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        />
        <RadixDialog.Content
          aria-describedby={undefined}
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[min(440px,calc(100vw-32px))]",
            "-translate-x-1/2 -translate-y-1/2 outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          )}
        >
          <div className="rounded-2xl bg-white shadow-2xl border border-slate-200/60 overflow-hidden">
            {/* Top strip — subtle amber gradient signals warning, not destruction */}
            <div className="h-1 bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500" />

            {/* Close button (top-right) */}
            <RadixDialog.Close
              disabled={isPending}
              className="absolute right-4 top-4 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors disabled:opacity-40"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </RadixDialog.Close>

            {/* Body */}
            <div className="px-6 pt-6 pb-2">
              <div className="flex items-start gap-3">
                <div className="shrink-0 w-10 h-10 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center">
                  <RefreshCw className="w-4.5 h-4.5 text-amber-600" strokeWidth={2.2} />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <RadixDialog.Title className="text-[15px] font-semibold text-slate-900 leading-tight">
                    Regenerate backup codes?
                  </RadixDialog.Title>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
                    Your existing codes will{" "}
                    <strong className="text-slate-800">stop working immediately</strong>
                    {" "}and we&apos;ll give you 10 fresh ones. Save them somewhere safe — this is the only time we&apos;ll show them.
                  </p>
                </div>
              </div>

              {/* Context card — what's being thrown away */}
              {remaining > 0 && (
                <div className="mt-4 ml-13 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-[12px] text-slate-600 flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>
                    You currently have <strong className="text-slate-800">{remaining} unused</strong>{" "}
                    {remaining === 1 ? "code" : "codes"} that will be invalidated.
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 mt-2 bg-slate-50/50 border-t border-slate-100">
              <button
                type="button"
                onClick={onCancel}
                disabled={isPending}
                className="h-9 px-4 rounded-lg text-[13px] font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isPending}
                className={cn(
                  "h-9 px-4 rounded-lg text-[13px] font-semibold inline-flex items-center gap-1.5",
                  "bg-amber-500 text-white hover:bg-amber-600 transition-colors",
                  "shadow-sm shadow-amber-500/30",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                )}
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Regenerating…
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    Regenerate codes
                  </>
                )}
              </button>
            </div>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

