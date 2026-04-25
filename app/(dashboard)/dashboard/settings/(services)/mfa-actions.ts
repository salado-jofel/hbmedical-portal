"use server";

/**
 * Multi-factor authentication (TOTP) server actions for the settings page.
 *
 * HIPAA Security Rule §164.312(d) requires "person or entity authentication"
 * proportional to the sensitivity of the data. Single-factor (password) is
 * below the bar for accounts with broad PHI access — admin sees every order,
 * provider signs orders. We mandate TOTP for those two roles.
 *
 * Implementation: Supabase Auth's MFA primitives (mfa.enroll, mfa.challenge,
 * mfa.verify, mfa.unenroll). The factor lives on the auth.users record; the
 * session AAL (Authenticator Assurance Level) jumps from "aal1" to "aal2"
 * once the user verifies a TOTP code. We gate dashboard access on aal2 for
 * users in the mandatory roles.
 *
 * Re-enrollment: an admin can disable MFA on their own account via this
 * action (they immediately get redirected back to enrollment by the gate).
 * For account recovery (lost device), an admin must reset another user
 * out-of-band — there's no self-serve path here on purpose.
 */

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserOrThrow } from "@/lib/supabase/auth";

export interface MfaStatus {
  enrolled: boolean;
  /** AAL of the *current session*. "aal1" means signed in but not MFA-verified. */
  currentAal: "aal1" | "aal2" | null;
  /** Set when the user has enrolled but the session is still aal1. */
  needsChallenge: boolean;
}

/** Returns the current user's MFA enrollment + session AAL. */
export async function getMfaStatus(): Promise<MfaStatus> {
  const supabase = await createClient();
  await getCurrentUserOrThrow(supabase);

  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  const verifiedTotp = factorsData?.totp?.find((f) => f.status === "verified");
  const enrolled = !!verifiedTotp;

  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const currentAal = (aalData?.currentLevel ?? null) as MfaStatus["currentAal"];

  return {
    enrolled,
    currentAal,
    needsChallenge: enrolled && currentAal === "aal1",
  };
}

export interface BeginEnrollmentResult {
  success: boolean;
  /** Otpauth URI / QR code SVG / TOTP secret returned by Supabase. */
  factorId?: string;
  qrCode?: string;
  secret?: string;
  uri?: string;
  error?: string;
}

/**
 * Begin TOTP enrollment. Returns a QR code SVG + secret the user scans into
 * their authenticator app. Call `finishMfaEnrollment(factorId, code)` next
 * to confirm the factor with the first 6-digit code.
 *
 * Idempotency: if there's an unverified factor lingering from a prior
 * abandoned attempt, we unenroll it before starting a new one. Otherwise
 * Supabase rejects duplicate factor names.
 */
export async function beginMfaEnrollment(): Promise<BeginEnrollmentResult> {
  const supabase = await createClient();
  await getCurrentUserOrThrow(supabase);

  // Clear any stale unverified factor. listFactors() typings only surface
  // verified factors, but the underlying API returns every factor regardless
  // of status — cast through unknown so we can filter by the runtime value.
  const { data: existing } = await supabase.auth.mfa.listFactors();
  const allTotp = ((existing?.totp ?? []) as unknown) as Array<{
    id: string;
    status: string;
  }>;
  const stale = allTotp.find((f) => f.status !== "verified");
  if (stale) {
    await supabase.auth.mfa.unenroll({ factorId: stale.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Authenticator (${new Date().toISOString().slice(0, 10)})`,
  });

  if (error || !data) {
    console.error("[beginMfaEnrollment]", error);
    return {
      success: false,
      error: error?.message ?? "Failed to start enrollment.",
    };
  }

  return {
    success: true,
    factorId: data.id,
    qrCode: data.totp?.qr_code,
    secret: data.totp?.secret,
    uri: data.totp?.uri,
  };
}

/**
 * Verify the first TOTP code from the authenticator app. Marks the factor
 * "verified" and the session jumps to aal2.
 */
export async function finishMfaEnrollment(
  factorId: string,
  code: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  await getCurrentUserOrThrow(supabase);

  if (!/^\d{6}$/.test(code.trim())) {
    return { success: false, error: "Code must be 6 digits." };
  }

  const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
    factorId,
  });
  if (chErr || !challenge) {
    return { success: false, error: chErr?.message ?? "Challenge failed." };
  }

  const { error: vErr } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: code.trim(),
  });
  if (vErr) {
    return { success: false, error: vErr.message };
  }
  return { success: true };
}

/**
 * Disable TOTP — unenrolls every verified factor on the account. Subject to
 * the dashboard-level gate, which re-prompts enrollment immediately for
 * mandatory-MFA roles.
 */
export async function disableMfa(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  await getCurrentUserOrThrow(supabase);

  const { data } = await supabase.auth.mfa.listFactors();
  const factors = data?.totp ?? [];
  for (const f of factors) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
    if (error) return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Step-up the *current* session from aal1 → aal2 by submitting a TOTP code.
 * Used by the sign-in challenge flow when the user already has MFA enrolled
 * and just authenticated with their password.
 */
export async function challengeAndVerifyMfa(
  code: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  await getCurrentUserOrThrow(supabase);

  if (!/^\d{6}$/.test(code.trim())) {
    return { success: false, error: "Code must be 6 digits." };
  }

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = factors?.totp?.find((f) => f.status === "verified");
  if (!verified) {
    return { success: false, error: "No verified TOTP factor on this account." };
  }

  const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
    factorId: verified.id,
  });
  if (chErr || !challenge) {
    return { success: false, error: chErr?.message ?? "Challenge failed." };
  }

  const { error: vErr } = await supabase.auth.mfa.verify({
    factorId: verified.id,
    challengeId: challenge.id,
    code: code.trim(),
  });
  if (vErr) return { success: false, error: vErr.message };
  return { success: true };
}
