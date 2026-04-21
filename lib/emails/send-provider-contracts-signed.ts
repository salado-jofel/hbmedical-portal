import { resend, ACCOUNTS_FROM_EMAIL } from "@/lib/emails/resend";

const LOGO_URL =
  "https://ersdsmuybpfvgvaiwcgl.supabase.co/storage/v1/object/public/hbmedical-bucket-public/assets/hb-logo-name-2%20(1).png";

export interface ProviderContractsSignedEmailParams {
  to: string[];
  providerName: string;
  providerEmail: string;
  clinicName: string | null;
  signedAt: Date;
  attachments: Array<{
    filename: string;
    content: Buffer;
  }>;
}

export async function sendProviderContractsSignedEmail({
  to,
  providerName,
  providerEmail,
  clinicName,
  signedAt,
  attachments,
}: ProviderContractsSignedEmailParams): Promise<{ error: string | null }> {
  try {
    const subject = `Signed contracts — ${providerName}${clinicName ? ` (${clinicName})` : ""}`;
    const { data, error } = await resend.emails.send({
      from: ACCOUNTS_FROM_EMAIL,
      to,
      subject,
      html: buildHtml({ providerName, providerEmail, clinicName, signedAt }),
      attachments: attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
      })),
    });
    if (error) {
      console.error("[sendProviderContractsSignedEmail] Resend error:", error);
      return { error: "Failed to send contracts email." };
    }
    console.log("[sendProviderContractsSignedEmail] Sent, id:", data?.id);
    return { error: null };
  } catch (err) {
    console.error("[sendProviderContractsSignedEmail] Unexpected:", err);
    return { error: "Failed to send contracts email." };
  }
}

function buildHtml({
  providerName,
  providerEmail,
  clinicName,
  signedAt,
}: {
  providerName: string;
  providerEmail: string;
  clinicName: string | null;
  signedAt: Date;
}) {
  const signedAtFormatted = signedAt.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

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
    .info-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 18px; margin: 18px 0; }
    .info-row { display: block; font-size: 13px; color: #334155; margin-bottom: 6px; }
    .info-label { color: #64748b; font-weight: 600; display: inline-block; min-width: 110px; }
    ul { padding-left: 20px; margin: 6px 0 14px; }
    li { font-size: 14px; color: #334155; margin-bottom: 4px; }
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
        <h1 class="h1">New provider signed contracts</h1>
        <p>A clinical provider has completed onboarding on the HB Medical Portal and signed the required agreements. The signed PDFs are attached to this email.</p>
        <div class="info-box">
          <span class="info-row"><span class="info-label">Provider:</span> ${providerName}</span>
          <span class="info-row"><span class="info-label">Email:</span> ${providerEmail}</span>
          ${clinicName ? `<span class="info-row"><span class="info-label">Clinic:</span> ${clinicName}</span>` : ""}
          <span class="info-row"><span class="info-label">Signed on:</span> ${signedAtFormatted}</span>
        </div>
        <p>Attached documents:</p>
        <ul>
          <li>Business Associates Agreement (BAA)</li>
          <li>Product &amp; Services Agreement</li>
        </ul>
        <p class="muted">This email was generated automatically when the provider completed signup.</p>
      </div>
      <div class="footer">&copy; 2026 HB Medical Portal. Secure &amp; Confidential.</div>
    </div>
  </div>
</body>
</html>`;
}
