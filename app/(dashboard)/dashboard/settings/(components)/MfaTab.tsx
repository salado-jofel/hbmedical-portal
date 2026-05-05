"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Smartphone, RefreshCw, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
  getSmsMfaStatus,
  resetMyPhoneEnrollment,
  type SmsMfaStatus,
} from "../(services)/mfa-actions";
import { maskPhone } from "@/utils/helpers/phone";

interface MfaTabProps {
  /** Kept on the prop signature so the parent SettingsTabs render call
   *  doesn't need to change; SMS MFA is mandatory for every workforce role
   *  in the app, so we don't actually branch on it. */
  mandatory: boolean;
}

/**
 * Settings → Security tab. Single SMS-MFA status panel:
 *
 *   ENROLLED  — show phone (masked), verified-since date, "Update phone"
 *               action that wipes the enrollment and routes to /onboarding/phone.
 *   NOT ENROLLED — banner pointing to /onboarding/phone (the dashboard MFA
 *                  gate will already have redirected the user there before
 *                  they could reach this tab, so this is mostly a safety
 *                  fallback for direct navigation).
 *
 * The legacy TOTP enrollment UI was removed when the client unified MFA on
 * Twilio SMS for all roles. Existing TOTP factors in auth.mfa_factors are
 * ignored by the gate and remain only as harmless dead weight.
 */
export function MfaTab({ mandatory: _mandatory }: MfaTabProps) {
  const router = useRouter();
  const [status, setStatus] = useState<SmsMfaStatus | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getSmsMfaStatus()
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch((err) => console.error("[MfaTab] getSmsMfaStatus failed:", err));
    return () => {
      cancelled = true;
    };
  }, []);

  function handleUpdatePhone() {
    startTransition(async () => {
      const res = await resetMyPhoneEnrollment();
      if (!res.success) {
        toast.error(res.error ?? "Failed to update phone.");
        return;
      }
      // Send the user to the enrollment page directly. The dashboard MFA
      // gate would also redirect them there on next request, but explicit
      // navigation skips a hop and keeps the flow obvious.
      router.replace("/onboarding/phone");
    });
  }

  if (!status) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--text3)]">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading…
      </div>
    );
  }

  if (!status.enrolled) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 w-5 h-5 shrink-0 text-amber-600" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-amber-900">
              Two-factor authentication not set up
            </h3>
            <p className="mt-1 text-xs text-amber-800">
              Set up SMS verification so we can text you a code each time you
              sign in.
            </p>
            <Button
              onClick={() => router.replace("/onboarding/phone")}
              className="mt-3 h-8 bg-[var(--navy)] hover:bg-[var(--navy)]/90 text-white text-xs font-medium px-3"
            >
              Set up phone verification
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const verifiedDate = status.verifiedAt
    ? new Date(status.verifiedAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 w-5 h-5 shrink-0 text-emerald-600" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-emerald-900">
              SMS verification is active
            </h3>
            <p className="mt-1 text-xs text-emerald-800">
              We text a 6-digit code to your phone each time you sign in.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Smartphone className="mt-0.5 w-5 h-5 shrink-0 text-[var(--navy)]" />
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[var(--text3)]">
                Phone on file
              </div>
              <div className="mt-0.5 font-mono text-sm text-[var(--text1)]">
                {status.phone ? maskPhone(status.phone) : "—"}
              </div>
              {verifiedDate && (
                <div className="mt-1 text-[11px] text-[var(--text3)]">
                  Verified {verifiedDate}
                </div>
              )}
            </div>
          </div>
          <Button
            onClick={handleUpdatePhone}
            disabled={isPending}
            variant="outline"
            className="shrink-0 h-8 text-xs font-medium gap-1.5"
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Update phone
          </Button>
        </div>
      </div>
    </div>
  );
}
