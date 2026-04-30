"use server";

/**
 * Multi-factor authentication (TOTP) server actions for the settings page.
 *
 * HIPAA Security Rule §164.312(d) requires "person or entity authentication"
 * proportional to the sensitivity of the data. Every workforce role on this
 * portal reads PHI in some form, so all of them require TOTP enrollment —
 * see `MFA_MANDATORY_ROLES` in `lib/supabase/mfa-gate.ts`.
 *
 * Implementation: Supabase Auth's MFA primitives (mfa.enroll, mfa.challenge,
 * mfa.verify, mfa.unenroll). The factor lives on the auth.users record; the
 * session AAL (Authenticator Assurance Level) jumps from "aal1" to "aal2"
 * once the user verifies a TOTP code. We gate dashboard access on aal2.
 *
 * Replace flow (atomic, no destructive intermediate state):
 *   1. `beginMfaEnrollment` creates a NEW unverified factor — the existing
 *      verified factor (if any) is left intact.
 *   2. User scans new QR + types the new code.
 *   3. `finishMfaEnrollment` verifies. On success it:
 *        a. unenrolls every OTHER verified factor (the old one), and
 *        b. revokes other sessions so a stolen-and-still-AAL2 session on a
 *           different device can't keep using the now-deleted old factor.
 *      First-time enrollment is the same code path with zero "other" factors
 *      to unenroll, plus an automatic backup-code generation.
 *
 * Recovery: backup codes (`mfa_backup_codes` table) let a user sign in even
 * when they've lost their authenticator. Codes are bcrypt-hashed, single-use,
 * never expire, regenerable from settings. Wiping all factors (admin reset)
 * also wipes their backup codes — the recovering user gets a clean re-enroll.
 */

import bcrypt from "bcryptjs";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrThrow, getUserRole } from "@/lib/supabase/auth";
import { isAdmin } from "@/utils/helpers/role";
import { logPhiAccess } from "@/lib/audit/log-phi-access";
import { sendMfaNotificationEmail } from "@/lib/emails/send-mfa-notification";
import { BACKUP_CODE_COUNT, BACKUP_CODE_HALF_LEN } from "@/utils/constants/mfa";

/* ─── How long an unverified factor survives before it counts as abandoned.
   Keeps the auth.mfa_factors table from accumulating orphans when users
   close the QR screen without finishing. */
const UNVERIFIED_FACTOR_TTL_MIN = 10;

/* ─── Backup code shape ─── */
const BACKUP_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // skip 0/O/1/I/L
const BCRYPT_COST = 10;

export interface MfaStatus {
  enrolled: boolean;
  /** AAL of the *current session*. "aal1" means signed in but not MFA-verified. */
  currentAal: "aal1" | "aal2" | null;
  /** Set when the user has enrolled but the session is still aal1. */
  needsChallenge: boolean;
  /** Backup codes still unused, for the "X of 10 remaining" UI. */
  backupCodesRemaining: number;
}

/** Returns the current user's MFA enrollment + session AAL + backup-code count. */
export async function getMfaStatus(): Promise<MfaStatus> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);

  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  const verifiedTotp = factorsData?.totp?.find((f) => f.status === "verified");
  const enrolled = !!verifiedTotp;

  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const currentAal = (aalData?.currentLevel ?? null) as MfaStatus["currentAal"];

  // Cleanup pass: any unverified factor older than the TTL is an abandoned
  // enrollment attempt. Drop them so listFactors stays clean and the next
  // enrollment doesn't trip a friendly-name collision.
  await sweepStaleUnverifiedFactors();

  // Count remaining backup codes via the admin client (RLS denies user reads
  // on this table — only the service role can see it).
  const admin = createAdminClient();
  const { count } = await admin
    .from("mfa_backup_codes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("used_at", null);

  return {
    enrolled,
    currentAal,
    needsChallenge: enrolled && currentAal === "aal1",
    backupCodesRemaining: count ?? 0,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Enrollment / replace                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

export interface BeginEnrollmentResult {
  success: boolean;
  /** Otpauth URI / QR code SVG / TOTP secret returned by Supabase. */
  factorId?: string;
  qrCode?: string;
  secret?: string;
  uri?: string;
  /** True if the user already has a verified factor — UI can label the page
   *  "Replace authenticator" instead of "Set up authenticator". */
  isReplace?: boolean;
  error?: string;
}

/**
 * Begin TOTP enrollment OR replacement. Always creates a new UNVERIFIED
 * factor; the verified factor (if any) is left in place until
 * `finishMfaEnrollment` confirms the new one. This is the atomic "verify
 * before destroy" guarantee — abandoning the flow leaves the user's working
 * factor intact.
 */
export async function beginMfaEnrollment(): Promise<BeginEnrollmentResult> {
  const supabase = await createClient();
  await getCurrentUserOrThrow(supabase);

  await sweepStaleUnverifiedFactors();

  // Detect replace vs. first-time so the UI can adjust copy.
  const { data: existing } = await supabase.auth.mfa.listFactors();
  const hasVerified = !!existing?.totp?.find((f) => f.status === "verified");

  // Friendly name needs a unique suffix — Supabase rejects duplicate names
  // per user, and same-day attempts on the old code path tripped that.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const rand = Math.random().toString(36).slice(2, 6);
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Authenticator ${stamp}-${rand}`,
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
    isReplace: hasVerified,
  };
}

export interface FinishEnrollmentResult {
  success: boolean;
  /** True if the operation removed an old verified factor (replace). */
  wasReplace?: boolean;
  /** Plaintext backup codes — populated only on first-time enrollment.
   *  Show ONCE then forget. Caller is responsible for displaying them. */
  backupCodes?: string[];
  error?: string;
}

/**
 * Verify the first TOTP code from the new authenticator. On success:
 *  - the new factor flips to `verified` (Supabase's mfa.verify side-effect)
 *  - any OTHER verified factor (the old one) is unenrolled
 *  - other sessions are revoked so a stolen device can't continue at AAL2
 *  - first-time enrollments get 10 freshly-generated backup codes returned
 *    in plaintext (one-time display); replace flows keep their existing
 *    backup codes
 */
export async function finishMfaEnrollment(
  factorId: string,
  code: string,
): Promise<FinishEnrollmentResult> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);

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
    // Audit-log failed verifies — the brute-force alert reads this.
    await logPhiAccess({
      action: "mfa.verify_failed",
      resource: "mfa_factor",
      resourceId: factorId,
      metadata: { phase: "enrollment" },
    });
    return { success: false, error: vErr.message };
  }

  // Identify any OTHER verified factors. listFactors now returns BOTH the
  // newly-verified factor AND any pre-existing one. We unenroll the others
  // (typically 0 for first-time, 1 for replace).
  const { data: allFactors } = await supabase.auth.mfa.listFactors();
  const otherVerified = (allFactors?.totp ?? []).filter(
    (f) => f.status === "verified" && f.id !== factorId,
  );

  const wasReplace = otherVerified.length > 0;

  for (const f of otherVerified) {
    await supabase.auth.mfa.unenroll({ factorId: f.id });
  }

  if (wasReplace) {
    // Other AAL2 sessions on different devices were bound to the OLD factor;
    // the JWT's aal claim is sticky so they keep working until expiry. Force
    // them to re-auth with the new factor by signing them out server-side.
    // signOut({ scope: "others" }) keeps THIS session alive.
    await supabase.auth.signOut({ scope: "others" });
  }

  await logPhiAccess({
    action: wasReplace ? "mfa.replaced" : "mfa.enrolled",
    resource: "mfa_factor",
    resourceId: factorId,
  });

  if (wasReplace && user.email) {
    // Fire-and-forget — never block the response on email delivery.
    void sendMfaNotificationEmail({
      to: user.email,
      firstName:
        (user.user_metadata?.first_name as string | undefined) ?? null,
      kind: "replaced",
      replacedAt: new Date().toISOString(),
    });
  }

  // First-time enrollment: generate + return backup codes once.
  // Replace: leave existing backup codes untouched (user can regenerate
  // separately if they want fresh ones).
  let backupCodes: string[] | undefined;
  if (!wasReplace) {
    backupCodes = await generateBackupCodesForUser(user.id);
  }

  return { success: true, wasReplace, backupCodes };
}

/**
 * Sign-in challenge: step the current session from aal1 → aal2 by submitting
 * a TOTP code. Used by `/sign-in/mfa` after password auth.
 */
export async function challengeAndVerifyMfa(
  code: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);

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
  if (vErr) {
    await logPhiAccess({
      action: "mfa.verify_failed",
      resource: "mfa_factor",
      resourceId: verified.id,
      metadata: { phase: "sign_in_challenge", userId: user.id },
    });
    return { success: false, error: vErr.message };
  }

  await logPhiAccess({
    action: "mfa.verify_success",
    resource: "mfa_factor",
    resourceId: verified.id,
  });
  return { success: true };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Backup codes                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

/** Generate one human-friendly code: XXXX-XXXX with an unambiguous alphabet
 *  (no 0/O/1/I/L). Random source is `crypto.getRandomValues` so it's
 *  cryptographically secure; bcrypt hash keeps storage non-reversible. */
function generatePlaintextCode(): string {
  const buf = new Uint8Array(BACKUP_CODE_HALF_LEN * 2);
  crypto.getRandomValues(buf);
  let s = "";
  for (let i = 0; i < buf.length; i++) {
    s += BACKUP_CODE_ALPHABET[buf[i] % BACKUP_CODE_ALPHABET.length];
  }
  return `${s.slice(0, BACKUP_CODE_HALF_LEN)}-${s.slice(BACKUP_CODE_HALF_LEN)}`;
}

/**
 * Internal helper — generates `BACKUP_CODE_COUNT` codes for the given user,
 * stores their bcrypt hashes, returns the plaintext array. Wipes any
 * existing codes for the user first (regenerate semantics).
 */
async function generateBackupCodesForUser(userId: string): Promise<string[]> {
  const admin = createAdminClient();

  // Atomically replace: delete old, insert new. We use the admin client to
  // bypass RLS on mfa_backup_codes (the table has no permissive policies).
  await admin.from("mfa_backup_codes").delete().eq("user_id", userId);

  const codes: string[] = [];
  const rows: Array<{ user_id: string; code_hash: string }> = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const code = generatePlaintextCode();
    codes.push(code);
    rows.push({ user_id: userId, code_hash: await bcrypt.hash(code, BCRYPT_COST) });
  }

  const { error } = await admin.from("mfa_backup_codes").insert(rows);
  if (error) {
    console.error("[generateBackupCodesForUser]", error.message);
    throw new Error("Failed to generate backup codes.");
  }

  await logPhiAccess({
    action: "mfa.backup_codes_generated",
    resource: "mfa_backup_codes",
    metadata: { count: BACKUP_CODE_COUNT },
  });

  return codes;
}

/**
 * User-callable: regenerate the full set of backup codes. Invalidates every
 * previous code (including unused ones) and returns the new plaintext set
 * for one-time display.
 */
export async function regenerateBackupCodes(): Promise<{
  success: boolean;
  codes?: string[];
  error?: string;
}> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);

  // Don't regenerate if the user has no verified factor — backup codes only
  // make sense alongside an enrolled TOTP. (UI shouldn't expose the button
  // in that state, but defend in depth.)
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = factors?.totp?.find((f) => f.status === "verified");
  if (!verified) {
    return {
      success: false,
      error: "Enroll an authenticator before generating backup codes.",
    };
  }

  try {
    const codes = await generateBackupCodesForUser(user.id);
    return { success: true, codes };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to regenerate codes.",
    };
  }
}

/**
 * Verify a backup code at sign-in challenge time and put the user into the
 * recovery state. Behavior on successful match:
 *
 *   1. Burn the code (mark used_at).
 *   2. Unenroll ALL factors. The user's authenticator is presumed lost —
 *      letting the old factor stick around means an attacker who finds the
 *      phone could still use it.
 *   3. Audit-log + email user that recovery was used.
 *
 * After this returns success, the caller (the sign-in MFA page) refreshes —
 * the page sees the user has no factor, renders the enrollment form, and the
 * user sets up their replacement TOTP. The actual AAL bump to aal2 happens
 * via `mfa.verify` on the NEW factor they enroll, exactly like a first-time
 * setup. Backup codes never bump AAL on their own — they unlock the recovery
 * path, not the dashboard.
 */
export async function verifyBackupCode(
  code: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);

  const normalized = code.trim().toUpperCase().replace(/\s/g, "");
  // Accept either format: with or without the hyphen, since users will
  // almost certainly mistype the dash position.
  const stripped = normalized.replace(/-/g, "");
  if (stripped.length !== BACKUP_CODE_HALF_LEN * 2) {
    return { success: false, error: "Backup code must be 8 characters." };
  }
  // Re-format to the canonical XXXX-XXXX shape we hashed.
  const canonical = `${stripped.slice(0, BACKUP_CODE_HALF_LEN)}-${stripped.slice(BACKUP_CODE_HALF_LEN)}`;

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("mfa_backup_codes")
    .select("id, code_hash")
    .eq("user_id", user.id)
    .is("used_at", null);

  if (!rows || rows.length === 0) {
    await logPhiAccess({
      action: "mfa.backup_code_failed",
      resource: "mfa_backup_codes",
      metadata: { reason: "no_remaining" },
    });
    return { success: false, error: "Invalid backup code." };
  }

  // Linear scan — at most BACKUP_CODE_COUNT entries per user. bcrypt.compare
  // is constant-time per call, so this is fine.
  for (const row of rows) {
    if (await bcrypt.compare(canonical, row.code_hash)) {
      await admin
        .from("mfa_backup_codes")
        .update({ used_at: new Date().toISOString() })
        .eq("id", row.id);

      // Burn every existing factor — backup-code redemption implies the
      // authenticator is lost. The user re-enrolls on a fresh device in
      // the next step.
      const { data: factors } = await supabase.auth.mfa.listFactors();
      for (const f of factors?.totp ?? []) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }

      await logPhiAccess({
        action: "mfa.backup_code_used",
        resource: "mfa_backup_codes",
        resourceId: row.id,
      });
      return { success: true };
    }
  }

  await logPhiAccess({
    action: "mfa.backup_code_failed",
    resource: "mfa_backup_codes",
    metadata: { reason: "no_match" },
  });
  return { success: false, error: "Invalid backup code." };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Internal — sweep stale unverified factors                                 */
/* ────────────────────────────────────────────────────────────────────────── */

/* ────────────────────────────────────────────────────────────────────────── */
/*  Admin recovery — wipe a target user's MFA state                           */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Admin-only: nuke a target user's entire MFA state (all factors + all
 * backup codes). Used when a user has lost their authenticator AND used up
 * their backup codes — last-resort recovery.
 *
 * After this completes, the target user can sign in with password, hits the
 * dashboard MFA gate, lands on /sign-in/mfa with no factor, and goes through
 * fresh enrollment (which generates a new backup-code set automatically).
 *
 * Two-admin policy: a single admin can't reset their OWN MFA via this path
 * — the targetUserId guard catches self-resets so you can't accidentally
 * lock yourself out. A second admin must do it (see docs/MFA_RECOVERY.md).
 */
export async function adminUnenrollUserMfa(
  targetUserId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const requestingUser = await getCurrentUserOrThrow(supabase);
  const requestingRole = await getUserRole(supabase);

  if (!isAdmin(requestingRole)) {
    return { success: false, error: "Admin role required." };
  }

  if (targetUserId === requestingUser.id) {
    return {
      success: false,
      error:
        "You can't reset your own MFA via this path — ask another admin to do it for you. See docs/MFA_RECOVERY.md.",
    };
  }

  const admin = createAdminClient();

  // Step 1: list the target's factors (admin client bypasses RLS) and
  // unenroll each. Supabase Auth doesn't expose admin.mfa.deleteFactor so
  // we delete directly from auth.mfa_factors. The cascade FK on
  // auth.mfa_challenges takes care of the challenge rows.
  const { error: factorsErr } = await admin
    .schema("auth")
    .from("mfa_factors")
    .delete()
    .eq("user_id", targetUserId);
  if (factorsErr) {
    console.error("[adminUnenrollUserMfa] factor delete:", factorsErr.message);
    return { success: false, error: "Failed to clear factors." };
  }

  // Step 2: wipe every backup code (used and unused both — a full reset
  // means no leftover credentials of any kind).
  const { error: codesErr } = await admin
    .from("mfa_backup_codes")
    .delete()
    .eq("user_id", targetUserId);
  if (codesErr) {
    console.error("[adminUnenrollUserMfa] backup codes delete:", codesErr.message);
    // Soft-fail — factors are already cleared, which is the security-critical
    // part. Backup codes left over will be wiped on next regenerate anyway.
  }

  // Step 3: revoke all the target user's sessions so any AAL2 session they
  // currently hold gets invalidated immediately.
  const { error: signOutErr } = await admin.auth.admin.signOut(targetUserId, "global");
  if (signOutErr) {
    console.error("[adminUnenrollUserMfa] global signOut:", signOutErr.message);
    // Non-fatal — they'll be forced to re-auth anyway when their JWT next
    // hits the MFA gate (no factor → must_enroll redirect).
  }

  await logPhiAccess({
    action: "mfa.admin_reset",
    resource: "mfa_factor",
    resourceId: targetUserId,
    metadata: { performed_by: requestingUser.id },
  });

  // Notify the target user via email — they need to know their MFA was
  // reset so the next-sign-in re-enrollment prompt isn't a surprise.
  // Look up their email + name from auth.users via the admin client.
  try {
    const { data: targetUser } = await admin.auth.admin.getUserById(targetUserId);
    if (targetUser?.user?.email) {
      const adminFirst =
        (requestingUser.user_metadata?.first_name as string | undefined) ?? null;
      const adminLast =
        (requestingUser.user_metadata?.last_name as string | undefined) ?? null;
      const adminName = [adminFirst, adminLast].filter(Boolean).join(" ").trim() || null;
      void sendMfaNotificationEmail({
        to: targetUser.user.email,
        firstName:
          (targetUser.user.user_metadata?.first_name as string | undefined) ?? null,
        kind: "admin_reset",
        adminName,
      });
    }
  } catch (err) {
    // Email failure must not bubble — the reset itself succeeded.
    console.error("[adminUnenrollUserMfa] notification email failed:", err);
  }

  return { success: true };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Internal — sweep stale unverified factors                                 */
/* ────────────────────────────────────────────────────────────────────────── */

async function sweepStaleUnverifiedFactors(): Promise<void> {
  const supabase = await createClient();
  const { data: existing } = await supabase.auth.mfa.listFactors();
  // Cast through unknown — listFactors returns both verified and unverified
  // at runtime, but the typings only surface verified.
  const all = ((existing?.totp ?? []) as unknown) as Array<{
    id: string;
    status: string;
    created_at?: string;
  }>;

  const cutoff = Date.now() - UNVERIFIED_FACTOR_TTL_MIN * 60_000;
  for (const f of all) {
    if (f.status === "verified") continue;
    const created = f.created_at ? Date.parse(f.created_at) : 0;
    // Drop unverified factors older than the TTL (or with no timestamp,
    // which is a corrupt row and best dropped anyway).
    if (!created || created < cutoff) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
  }
}
