import { resend, ACCOUNTS_FROM_EMAIL } from "@/lib/emails/resend";

const LOGO_URL =
  "https://ersdsmuybpfvgvaiwcgl.supabase.co/storage/v1/object/public/hbmedical-bucket-public/assets/meridian-logo.png";

type SendEmailChangeParams = {
  oldEmail: string;
  newEmail: string;
  firstName: string;
  appUrl: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/* ── Variant 1: alert to the OLD address ──
 *
 * Standard security practice — tell the prior account holder that their
 * login email changed. Gives them a chance to escalate if they didn't
 * authorize it (e.g. account takeover scenario, admin error). Mirrors how
 * Google, GitHub, and 1Password handle the same event.
 */
function buildOldAddressHtml({
  firstName,
  oldEmail,
  newEmail,
  appUrl,
}: SendEmailChangeParams): string {
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : "Hi,";
  const maskedNew = maskEmail(newEmail);

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f4f7f9;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <div style="background:#f4f7f9;padding:32px 16px;">
    <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
      <div style="padding:22px 28px 16px;text-align:center;border-bottom:1px solid #f1f5f9;">
        <img src="${LOGO_URL}" alt="Meridian" width="176" style="display:block;margin:0 auto;" />
      </div>
      <div style="padding:28px 32px;line-height:1.6;color:#334155;">
        <h1 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 14px;">
          Your sign-in email was changed
        </h1>
        <p style="margin:0 0 14px;font-size:14px;">${greeting}</p>
        <p style="margin:0 0 14px;font-size:14px;">
          An administrator on Meridian Portal just changed the email address
          on your account from <strong>${escapeHtml(oldEmail)}</strong> to
          <strong>${escapeHtml(maskedNew)}</strong>.
        </p>

        <div style="margin:18px 0;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;">
          <p style="margin:0 0 6px;"><strong>What this means</strong></p>
          <p style="margin:0;">From now on, sign in with the new email. Your password,
          phone number, and account history are unchanged.</p>
        </div>

        <div style="margin:18px 0;padding:14px 16px;background:#fef2f2;border-left:3px solid #dc2626;border-radius:6px;font-size:13px;color:#7f1d1d;">
          <p style="margin:0 0 4px;font-weight:700;">If you didn't request this</p>
          <p style="margin:0;">Contact your portal administrator immediately or reply to this email so we can investigate.</p>
        </div>

        <div style="text-align:center;margin:22px 0 6px;">
          <a href="${appUrl}/sign-in"
             style="display:inline-block;background-color:#15689E;color:#ffffff !important;padding:13px 28px;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
            Sign in →
          </a>
        </div>
        <p style="margin-top:18px;font-size:13px;color:#94a3b8;">
          This message was sent because your account email changed. You'll
          stop receiving messages at this address from us going forward.
        </p>
      </div>
      <div style="background:#f8fafc;padding:18px 24px;text-align:center;font-size:12px;color:#64748b;border-top:1px solid #f1f5f9;">
        &copy; 2026 Meridian Portal. Secure &amp; Confidential.
      </div>
    </div>
  </div>
</body></html>`;
}

/* ── Variant 2: confirmation to the NEW address ──
 *
 * Lets the new mailbox owner know they now own this account so they're not
 * confused by a sudden burst of activity from a system they weren't using.
 */
function buildNewAddressHtml({
  firstName,
  newEmail,
  appUrl,
}: SendEmailChangeParams): string {
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : "Hi,";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f4f7f9;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <div style="background:#f4f7f9;padding:32px 16px;">
    <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
      <div style="padding:22px 28px 16px;text-align:center;border-bottom:1px solid #f1f5f9;">
        <img src="${LOGO_URL}" alt="Meridian" width="176" style="display:block;margin:0 auto;" />
      </div>
      <div style="padding:28px 32px;line-height:1.6;color:#334155;">
        <h1 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 14px;">
          This is now your Meridian Portal email
        </h1>
        <p style="margin:0 0 14px;font-size:14px;">${greeting}</p>
        <p style="margin:0 0 14px;font-size:14px;">
          Your Meridian Portal account is now associated with
          <strong>${escapeHtml(newEmail)}</strong>. Sign in with this email
          going forward — your password and phone number are unchanged.
        </p>

        <div style="margin:18px 0;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;">
          <p style="margin:0 0 6px;"><strong>Next sign-in</strong></p>
          <p style="margin:0;">You'll be asked to re-verify your phone with an SMS code as a security check.</p>
        </div>

        <div style="text-align:center;margin:22px 0 6px;">
          <a href="${appUrl}/sign-in"
             style="display:inline-block;background-color:#15689E;color:#ffffff !important;padding:13px 28px;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
            Sign in →
          </a>
        </div>

        <p style="margin-top:18px;font-size:13px;color:#94a3b8;">
          If you didn't expect this email, contact your portal administrator.
        </p>
      </div>
      <div style="background:#f8fafc;padding:18px 24px;text-align:center;font-size:12px;color:#64748b;border-top:1px solid #f1f5f9;">
        &copy; 2026 Meridian Portal. Secure &amp; Confidential.
      </div>
    </div>
  </div>
</body></html>`;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0] ?? ""}***@${domain}`;
  return `${local[0]}${"*".repeat(Math.max(1, local.length - 2))}${local[local.length - 1]}@${domain}`;
}

/**
 * Send security-alert + confirmation pair after an admin changes a user's
 * login email. Sent in parallel; either failure is logged but doesn't
 * cancel the other.
 */
export async function sendEmailChangeNotification(
  params: SendEmailChangeParams,
): Promise<void> {
  const { oldEmail, newEmail } = params;

  await Promise.allSettled([
    resend.emails.send({
      from: ACCOUNTS_FROM_EMAIL,
      to: oldEmail,
      subject: "Your Meridian Portal email was changed",
      html: buildOldAddressHtml(params),
    }),
    resend.emails.send({
      from: ACCOUNTS_FROM_EMAIL,
      to: newEmail,
      subject: "Welcome — this is now your Meridian Portal email",
      html: buildNewAddressHtml(params),
    }),
  ]).then((results) => {
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(
          `[send-email-change-notification] send #${i} failed:`,
          r.reason,
        );
      }
    });
  });
}
