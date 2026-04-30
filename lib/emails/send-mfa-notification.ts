import { resend, ACCOUNTS_FROM_EMAIL } from "@/lib/emails/resend";

const LOGO_URL =
  "https://ersdsmuybpfvgvaiwcgl.supabase.co/storage/v1/object/public/hbmedical-bucket-public/assets/hb-logo-name-2%20(1).png";

/**
 * Type of MFA-related security event the recipient is being told about.
 * Each maps to a distinct subject + body so they don't sit in spam, look
 * legit, and tell the user what action (if any) they should take.
 */
export type MfaNotificationKind =
  /** User just replaced their authenticator from settings (or via the
   *  sign-in backup-code recovery flow). Confirms it was them. */
  | "replaced"
  /** Admin used the user-management page to wipe the user's factors +
   *  backup codes. Tells the user to expect a re-enrollment prompt. */
  | "admin_reset"
  /** Brute-force signal: many failed verify attempts in a short window.
   *  Reserved for future use; not currently triggered. */
  | "failed_attempts";

interface SendMfaNotificationParams {
  to: string;
  /** Recipient first name for personalization. Falls back to "there". */
  firstName?: string | null;
  kind: MfaNotificationKind;
  /** When `kind === "admin_reset"`, the name of the admin who performed it. */
  adminName?: string | null;
  /** Optional context for `failed_attempts` (count, time window). */
  failedAttemptCount?: number;
  /** When `kind === "replaced"`, an ISO timestamp of when it happened. */
  replacedAt?: string | null;
}

/**
 * Send a security-event notification email about an MFA change. Non-fatal:
 * if Paubox is down or the user's email is invalid, this never throws —
 * the underlying MFA action (replace, admin reset, etc.) already succeeded
 * by the time this runs, so swallowing the error is the correct choice.
 */
export async function sendMfaNotificationEmail(
  params: SendMfaNotificationParams,
): Promise<void> {
  try {
    const { subject, body } = buildContent(params);
    const { error } = await resend.emails.send({
      from: ACCOUNTS_FROM_EMAIL,
      to: params.to,
      subject,
      html: buildHtml({ body }),
    });
    if (error) {
      console.error("[sendMfaNotificationEmail] paubox error:", error);
    }
  } catch (err) {
    console.error("[sendMfaNotificationEmail] unexpected:", err);
  }
}

function buildContent({
  firstName,
  kind,
  adminName,
  failedAttemptCount,
  replacedAt,
}: SendMfaNotificationParams): { subject: string; body: string } {
  const greeting = `Hi ${firstName?.trim() || "there"},`;
  const when = replacedAt
    ? new Date(replacedAt).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "just now";

  switch (kind) {
    case "replaced":
      return {
        subject: "Your two-factor authenticator was replaced",
        body: `
          <p>${greeting}</p>
          <p>Your authenticator app for <strong>HB Medical Portal</strong> was replaced ${when}. Your previous device has been signed out and the new one is now the only valid 2FA source on your account.</p>
          <p><strong>If this was you</strong> — no action needed. You're all set.</p>
          <p><strong>If this was NOT you</strong> — your account may be compromised. Sign in immediately, change your password, and contact an HB Medical administrator. Your saved backup codes are still valid and may be needed to recover access.</p>
          <p class="muted">Sent automatically when an authenticator change is detected on your account.</p>
        `,
      };

    case "admin_reset":
      return {
        subject: "An administrator reset your two-factor authentication",
        body: `
          <p>${greeting}</p>
          <p>An HB Medical administrator${adminName ? ` (<strong>${adminName}</strong>)` : ""} just reset the two-factor authentication on your account.</p>
          <p>Your previous authenticator and any backup recovery codes have been removed. The next time you sign in, you'll be prompted to set up a new authenticator app and you'll receive a fresh set of backup codes — save them safely.</p>
          <p>If you did not request this reset, contact HB Medical immediately to confirm it was authorized.</p>
          <p class="muted">Sent automatically as part of a HIPAA-required security audit trail.</p>
        `,
      };

    case "failed_attempts":
      return {
        subject: "Multiple failed sign-in attempts on your HB Medical account",
        body: `
          <p>${greeting}</p>
          <p>We detected ${failedAttemptCount ?? "several"} failed two-factor authentication attempts on your <strong>HB Medical Portal</strong> account in a short window.</p>
          <p>If this was you (typo, wrong device, etc.) you can ignore this message. If it wasn't, your account may be under attack — change your password and consider regenerating your backup codes immediately.</p>
          <p class="muted">Sent automatically when unusual sign-in activity is detected.</p>
        `,
      };
  }
}

function buildHtml({ body }: { body: string }): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f9; margin: 0; padding: 0; }
    .wrapper { background-color: #f4f7f9; padding: 32px 16px; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
    .header { background-color: #ffffff; padding: 22px 28px 16px; text-align: center; border-bottom: 1px solid #f1f5f9; }
    .logo-img { display: block; margin: 0 auto; width: 176px; height: auto; border: 0; }
    .content { padding: 24px 32px 30px; line-height: 1.55; color: #334155; font-size: 14px; }
    .content p { margin: 0 0 12px; }
    .muted { font-size: 12px; color: #94a3b8; margin-top: 16px; }
    .footer { background-color: #f8fafc; padding: 18px 24px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #f1f5f9; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <img src="${LOGO_URL}" alt="HB Medical" width="176" class="logo-img" />
      </div>
      <div class="content">${body}</div>
      <div class="footer">&copy; 2026 HB Medical Portal. Secure &amp; Confidential.</div>
    </div>
  </div>
</body>
</html>`;
}
