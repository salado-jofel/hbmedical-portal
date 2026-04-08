import { ROLE_LABELS } from "@/utils/helpers/role";
import type { UserRole } from "@/utils/helpers/role";

const LOGO_URL =
  "https://eyrefohymvvabazvmemq.supabase.co/storage/v1/object/public/spearhead-assets/assets/email/hb-logo-name-2.png";

export function buildResetPasswordEmail({
  first_name,
  last_name,
  role,
  resetLink,
}: {
  first_name: string;
  last_name: string;
  role: string;
  resetLink: string;
}): string {
  const roleLabel = ROLE_LABELS[role as NonNullable<UserRole>] ?? role;

  return `
<!DOCTYPE html>
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
        <img src="${LOGO_URL}" alt="HB Medical" width="176" class="logo-img" />
      </div>
      <div class="content">
        <h1 class="h1">You've been invited to HB Medical Portal</h1>
        <p>Hi ${first_name},</p>
        <p>
          You have been added to the <strong>HB Medical Portal</strong> as a
          <strong> ${roleLabel}</strong>. Click the button below to set your
          password and get started.
        </p>
        <div class="btn-row">
          <a href="${resetLink}" class="btn" target="_blank" rel="noopener noreferrer">
            Set Password &amp; Sign In
          </a>
        </div>
        <p>This link expires in 24 hours. If you did not expect this email, you can safely ignore it.</p>
        <p class="muted">
          Questions? Reply to this email or contact your HB Medical admin.
        </p>
      </div>
      <div class="footer">&copy; 2026 HB Medical Portal. Secure &amp; Confidential.</div>
    </div>
  </div>
</body>
</html>
  `.trim();
}
