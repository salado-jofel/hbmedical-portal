"use client";

/**
 * Root-level error boundary. Catches uncaught errors from any nested route
 * segment (Server Components AND Client Components) and renders a recovery
 * UI instead of the raw Next.js error overlay.
 *
 * Primary case this exists for: **stale-deployment Server Action 404s**.
 *
 * Background — Next.js Server Actions get hash IDs generated at build time
 * and baked into both the deployed JS bundle (so the browser knows what to
 * POST) and the server's action registry. If a user loads the page under
 * deploy A, holds the tab open while a new deploy B goes out, then submits,
 * the POST carries an action ID that's no longer in the server's registry.
 * Next.js throws "Failed to find Server Action <hash>".
 *
 * Vercel Skew Protection (enabled in vercel.json) pins each session back to
 * its original deploy for 12 hours, which covers the vast majority of cases.
 * This boundary catches everything that falls outside that window — e.g. a
 * tab left open over a weekend, a mobile-Safari tab restored from days ago,
 * or any other route-mismatch edge case — and turns the raw crash into a
 * one-click "refresh to continue" UI.
 *
 * The reload preserves the invite token in the URL, so the user lands back
 * on the same step they started on (just with a fresh bundle whose action
 * IDs match the server).
 */

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw, AlertTriangle, ArrowLeft } from "lucide-react";
import { MeridianLogo } from "@/app/(components)/MeridianLogo";

// Hash signatures of the Next.js error messages we want to recognize. These
// are the exact substrings Next emits — keeping them as constants makes the
// detection grep-able and lets us add new signatures (e.g. for future
// deployment-skew variants) without rewriting the predicate.
const STALE_DEPLOYMENT_SIGNATURES = [
  "Failed to find Server Action",
  "older or newer deployment",
] as const;

function isStaleDeploymentError(error: { message?: string }): boolean {
  const msg = error.message ?? "";
  return STALE_DEPLOYMENT_SIGNATURES.some((sig) => msg.includes(sig));
}

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  // Next.js passes this so we can attempt a client-side re-render of the
  // segment. For stale deployments that doesn't help (the bundle is what's
  // wrong) — we force a full reload instead.
  reset: () => void;
}) {
  const stale = isStaleDeploymentError(error);

  useEffect(() => {
    // Always log so the issue is visible in Sentry / Vercel logs. Skipping
    // PHI by design — Next-Action error messages are framework-only and
    // safe to surface.
    console.error("[error-boundary]", {
      message: error.message,
      digest: error.digest,
      stale,
    });
  }, [error, stale]);

  if (stale) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F0F7FF] to-[#F8FAFC] px-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-[#E2E8F0] shadow-[0_8px_40px_rgba(0,0,0,0.1)] p-8 text-center">
          <div className="mb-6 flex justify-center">
            <MeridianLogo variant="light" size="lg" />
          </div>

          <div className="mb-5 inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-50">
            <RefreshCw className="w-7 h-7 text-amber-600" strokeWidth={1.8} />
          </div>

          <h1 className="text-xl font-bold text-[#0F172A] mb-2">
            Update available
          </h1>
          <p className="text-sm text-[#64748B] leading-relaxed mb-6">
            This page is from an older version of the portal. Click below to
            refresh and continue where you left off.
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full h-10 inline-flex items-center justify-center gap-2 bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white font-medium rounded-lg shadow-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" strokeWidth={2} />
            Refresh and continue
          </button>

          <p className="mt-4 text-[11px] text-[var(--text3)]">
            If you were filling out a form, you may need to re-enter some
            details. Uploaded files are safe.
          </p>
        </div>
      </div>
    );
  }

  // ── Generic fallback for non-stale errors. Keeps users from staring at the
  // Next.js default error overlay (which is dev-only anyway, but production
  // crashes look just as bad without this).
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F0F7FF] to-[#F8FAFC] px-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#E2E8F0] shadow-[0_8px_40px_rgba(0,0,0,0.1)] p-8 text-center">
        <div className="mb-6 flex justify-center">
          <MeridianLogo variant="light" size="lg" />
        </div>

        <div className="mb-5 inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-50">
          <AlertTriangle className="w-7 h-7 text-red-500" strokeWidth={1.8} />
        </div>

        <h1 className="text-xl font-bold text-[#0F172A] mb-2">
          Something went wrong
        </h1>
        <p className="text-sm text-[#64748B] leading-relaxed mb-6">
          An unexpected error happened. You can try again, or head back to the
          dashboard. If this keeps happening, contact support.
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={reset}
            className="flex-1 h-10 inline-flex items-center justify-center gap-2 bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white font-medium rounded-lg shadow-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" strokeWidth={2} />
            Try again
          </button>
          <Link
            href="/dashboard"
            className="flex-1 h-10 inline-flex items-center justify-center gap-2 border border-[var(--border)] text-[var(--text2)] hover:bg-[var(--bg)] font-medium rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={2} />
            Dashboard
          </Link>
        </div>

        {error.digest && (
          <p className="mt-4 text-[10px] font-mono text-[var(--text3)]">
            Reference: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
