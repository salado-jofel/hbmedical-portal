import { resend, ACCOUNTS_FROM_EMAIL } from "@/lib/emails/resend";

const LOGO_URL =
  "https://ersdsmuybpfvgvaiwcgl.supabase.co/storage/v1/object/public/hbmedical-bucket-public/assets/meridian-logo.png";

type SendPinChangedNotificationParams = {
  to: string;
  firstName: string;
  changedAtIso: string;
  ipAddress: string | null;
  userAgent: string | null;
  /** "change" when verified with current PIN; "reset" when verified with
   *  password via the forgot-PIN flow; "admin" when wiped by an admin. */
  method: "change" | "reset" | "admin";
  /** Base app URL used by the "Wasn't you? Secure your account" CTA. */
  appUrl: string;
};

function escapeHtml(v: string): string {
  return v
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      dateStyle: "long",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function methodLabel(m: "change" | "reset" | "admin"): string {
  if (m === "reset") return "reset via the forgot-PIN flow (password re-authentication)";
  if (m === "admin") return "reset by an Meridian administrator";
  return "changed";
}

function buildHtml({
  firstName,
  changedAtIso,
  ipAddress,
  userAgent,
  method,
  appUrl,
}: SendPinChangedNotificationParams): string {
  const when = formatTime(changedAtIso);
  const action = methodLabel(method);
  const details = [
    ["Time", when],
    ["IP address", ipAddress ?? "—"],
    ["Device", userAgent ?? "—"],
  ]
    .map(
      ([label, val]) => `
        <tr>
          <td style="padding:6px 12px;color:#64748B;font-size:13px;width:120px;">${escapeHtml(label)}</td>
          <td style="padding:6px 12px;color:#0F172A;font-size:13px;">${escapeHtml(val)}</td>
        </tr>`,
    )
    .join("");

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
      <div style="text-align:center;margin-bottom:24px;">
        <img src="${LOGO_URL}" alt="Meridian" style="height:32px;" />
      </div>
      <div style="background:#ffffff;border:1px solid #E2E8F0;border-radius:16px;padding:28px;">
        <h1 style="margin:0 0 8px 0;font-size:20px;color:#0F172A;">Your signing PIN was ${
          method === "change" ? "changed" : "reset"
        }</h1>
        <p style="margin:0 0 20px 0;color:#334155;font-size:14px;line-height:1.55;">
          Hi ${escapeHtml(firstName)}, your Meridian digital-signature PIN was just ${action}.
        </p>
        <table style="width:100%;border-collapse:collapse;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;">
          ${details}
        </table>
        <p style="margin:20px 0 12px 0;color:#334155;font-size:14px;line-height:1.55;">
          If you did this, no action is needed.
        </p>
        <p style="margin:0 0 20px 0;color:#334155;font-size:14px;line-height:1.55;">
          <strong>If you didn't do this</strong>, your account may be compromised. Sign in and change your password immediately.
        </p>
        <div style="text-align:center;margin-top:24px;">
          <a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#0f2d4a;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600;font-size:14px;">
            Secure your account
          </a>
        </div>
      </div>
      <p style="text-align:center;color:#94A3B8;font-size:11px;margin-top:16px;">
        Meridian Portal · Automated security notification
      </p>
    </div>
  </body>
</html>`;
}

export async function sendPinChangedNotificationEmail(
  params: SendPinChangedNotificationParams,
): Promise<void> {
  const subject =
    params.method === "change"
      ? "Your Meridian signing PIN was changed"
      : "Your Meridian signing PIN was reset";
  const html = buildHtml(params);
  try {
    await resend.emails.send({
      from: ACCOUNTS_FROM_EMAIL,
      to: params.to,
      subject,
      html,
    });
  } catch (err) {
    // Never let email failure block the PIN change itself.
    console.error("[sendPinChangedNotificationEmail]", err);
  }
}
