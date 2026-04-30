"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, KeyRound, LifeBuoy } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MeridianLogo } from "@/app/(components)/MeridianLogo";
import {
  challengeAndVerifyMfa,
  verifyBackupCode,
} from "@/app/(dashboard)/dashboard/settings/(services)/mfa-actions";
import { signOut } from "@/app/(dashboard)/dashboard/(services)/actions";

/**
 * Sign-in step-up: user already authenticated with password (aal1) but a
 * verified TOTP factor is on the account, so we challenge here before
 * letting them into /dashboard.
 *
 * Two paths:
 *   - TOTP: enter 6-digit code from authenticator → mfa.verify lifts session
 *     to aal2 → router.replace("/dashboard")
 *   - Backup code (recovery): enter one-time code → server burns it +
 *     unenrolls the lost factor → page refreshes → user lands on the
 *     enrollment screen because they no longer have a verified factor →
 *     fresh re-enrollment on a new device. The dashboard stays gated until
 *     enrollment completes (aal2 only happens via the new factor's verify).
 */
export function MfaChallengeForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"totp" | "backup">("totp");
  const [code, setCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleVerifyTotp() {
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

  function handleVerifyBackup() {
    startTransition(async () => {
      const res = await verifyBackupCode(backupCode);
      if (!res.success) {
        toast.error(res.error ?? "Invalid backup code.");
        setBackupCode("");
        return;
      }
      // Backup code consumed + old factor unenrolled. Page reload → MFA gate
      // sees no factor → enrollment form for fresh device setup.
      toast.success("Backup code accepted. Set up a new authenticator.");
      router.refresh();
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
          {mode === "totp" ? (
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--navy)]" />
          ) : (
            <LifeBuoy className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gold)]" />
          )}
          <div>
            <h2 className="text-xl font-bold text-[#0F172A]">
              {mode === "totp" ? "Two-factor authentication" : "Use a backup code"}
            </h2>
            <p className="mt-1 text-sm text-[#64748B]">
              {mode === "totp"
                ? "Enter the 6-digit code from your authenticator app to finish signing in."
                : "Enter one of the 8-character recovery codes you saved when you set up two-factor. Each code can be used once. After this, you'll set up a new authenticator."}
            </p>
          </div>
        </div>

        {mode === "totp" ? (
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
                      handleVerifyTotp();
                    }
                  }}
                />
              </div>
            </div>

            <Button
              onClick={handleVerifyTotp}
              disabled={code.length !== 6 || isPending}
              className="h-9 w-full bg-[var(--navy)] font-medium text-white hover:bg-[var(--navy)]/90 disabled:opacity-50"
            >
              {isPending ? "Verifying…" : "Verify"}
            </Button>

            <button
              type="button"
              onClick={() => {
                setMode("backup");
                setCode("");
              }}
              disabled={isPending}
              className="w-full text-center text-xs text-[var(--navy)] underline underline-offset-2 hover:text-[var(--navy)]/70"
            >
              Lost your authenticator? Use a backup code →
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
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[var(--text3)]">
                Backup code (XXXX-XXXX)
              </label>
              <div className="mt-1 flex items-center gap-2">
                <LifeBuoy className="h-4 w-4 text-[var(--text3)]" />
                <Input
                  value={backupCode}
                  onChange={(e) =>
                    setBackupCode(
                      e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9-]/g, "")
                        .slice(0, 9), // 8 chars + hyphen
                    )
                  }
                  inputMode="text"
                  autoComplete="off"
                  placeholder="ABCD-1234"
                  autoFocus
                  className="font-mono tracking-widest uppercase"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && backupCode.replace(/-/g, "").length === 8 && !isPending) {
                      handleVerifyBackup();
                    }
                  }}
                />
              </div>
              <p className="mt-1 text-[11px] text-[var(--text3)]">
                Using a backup code will sign out your old authenticator and
                require you to set up a new one in the next step.
              </p>
            </div>

            <Button
              onClick={handleVerifyBackup}
              disabled={backupCode.replace(/-/g, "").length !== 8 || isPending}
              className="h-9 w-full bg-[var(--gold)] font-medium text-white hover:bg-[var(--gold)]/90 disabled:opacity-50"
            >
              {isPending ? "Verifying…" : "Use backup code"}
            </Button>

            <button
              type="button"
              onClick={() => {
                setMode("totp");
                setBackupCode("");
              }}
              disabled={isPending}
              className="w-full text-center text-xs text-[var(--navy)] underline underline-offset-2 hover:text-[var(--navy)]/70"
            >
              ← Back to authenticator code
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
        )}
      </div>
    </div>
  );
}
