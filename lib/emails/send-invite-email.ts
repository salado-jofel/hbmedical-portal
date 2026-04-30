import { resend, ACCOUNTS_FROM_EMAIL } from "@/lib/emails/resend";
import { ROLE_LABELS } from "@/utils/helpers/role";
import type { InviteTokenRole } from "@/utils/interfaces/invite-tokens";

const LOGO_URL =
  "https://ersdsmuybpfvgvaiwcgl.supabase.co/storage/v1/object/public/hbmedical-bucket-public/assets/meridian-logo.png";

type SendInviteEmailParams = {
  to: string;
  inviteUrl: string;
  roleType: string;
  inviterName: string;
};

export async function sendInviteEmail({
  to,
  inviteUrl,
  roleType,
  inviterName,
}: SendInviteEmailParams): Promise<{ error: string | null }> {
  console.log("[sendInviteEmail] Sending to:", to, "role:", roleType);
  console.log("[resend] API key present:", !!process.env.RESEND_API_KEY);
  try {
    const { subject, body } = buildContent(roleType, inviterName);
    const { data, error } = await resend.emails.send({
      from: ACCOUNTS_FROM_EMAIL,
      to,
      subject,
      html: buildHtml({ body, inviteUrl }),
    });
    if (error) {
      console.error("[sendInviteEmail] Resend error:", error);
      return { error: "Failed to send invite email." };
    }
    console.log("[sendInviteEmail] Sent successfully, id:", data?.id);
    return { error: null };
  } catch (err) {
    console.error("[sendInviteEmail] Unexpected error:", err);
    return { error: "Failed to send invite email." };
  }
}

function buildContent(
  roleType: string,
  inviterName: string,
): { subject: string; body: string } {
  const roleLabel = ROLE_LABELS[roleType as InviteTokenRole] ?? roleType;

  switch (roleType) {
    case "clinical_provider":
      return {
        subject: "You've been invited to join Meridian Portal as a Clinical Provider",
        body: `You've been invited by <strong>${inviterName}</strong> to join the <strong>Meridian Portal</strong> as a <strong>Clinical Provider</strong>. Click below to set up your account and clinic.`,
      };
    case "clinical_staff":
      return {
        subject: "You've been invited to join Meridian Portal as Clinical Staff",
        body: `You've been invited by <strong>${inviterName}</strong> to join their clinic on the <strong>Meridian Portal</strong> as <strong>Clinical Staff</strong>. Click below to set up your account.`,
      };
    case "sales_representative":
      return {
        subject: "You've been invited to join Meridian Portal as a Sales Representative",
        body: `You've been invited by <strong>${inviterName}</strong> to join the <strong>Meridian Portal</strong> as a <strong>Sales Representative</strong>. Click below to set up your account.`,
      };
    default:
      return {
        subject: `You've been invited to join Meridian Portal as ${roleLabel}`,
        body: `You've been invited by <strong>${inviterName}</strong> to join the <strong>Meridian Portal</strong> as <strong>${roleLabel}</strong>. Click below to set up your account.`,
      };
  }
}

function buildHtml({ body, inviteUrl }: { body: string; inviteUrl: string }) {
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
    .content { padding: 28px 32px 34px; line-height: 1.6; color: #334155; }
    .h1 { font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 12px; }
    p { margin: 0 0 14px; font-size: 14px; }
    .btn-row { text-align: center; margin: 24px 0 22px; }
    .btn { background-color: #15689E; color: #ffffff !important; padding: 13px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; }
    .muted { margin-top: 20px; font-size: 13px; color: #94a3b8; }
    .footer { background-color: #f8fafc; padding: 20px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #f1f5f9; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <img src="${LOGO_URL}" alt="Meridian" width="176" class="logo-img" />
      </div>
      <div class="content">
        <h1 class="h1">You've been invited to Meridian Portal</h1>
        <p>${body}</p>
        <div class="btn-row">
          <a href="${inviteUrl}" class="btn" target="_blank" rel="noopener noreferrer">
            Accept Invitation &rarr;
          </a>
        </div>
        <p>This invitation will expire. If you did not expect this email, you can safely ignore it.</p>
        <p class="muted">
          Questions? Reply to this email or contact your Meridian admin.
        </p>
      </div>
      <div class="footer">&copy; 2026 Meridian Portal. Secure &amp; Confidential.</div>
    </div>
  </div>
</body>
</html>`;
}
