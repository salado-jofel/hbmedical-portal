/**
 * Email template — dispatch of standalone IVRs to an external approver.
 *
 * ONE email per approver per batch (per Dr. Ben Q4), listing every IVR
 * with its own "Review IVR" link. Each link carries the IVR's unique
 * approval_token so the recipient's click can be attributed even if
 * they forward the email. No portal login needed — the token IS the
 * auth for the decision endpoint.
 */

interface IvrLineItem {
  patientName: string;
  patientDob: string;
  physicianName: string;
  productSummary: string;
  reviewUrl: string;
}

interface Params {
  approverName: string;
  approverEmail: string;
  senderOrgName: string; // e.g. "Meridian Portal"
  ivrs: IvrLineItem[];
  expiresLabel: string; // "30 days" or similar
}

export function buildIvrApprovalEmail(params: Params): {
  subject: string;
  html: string;
  text: string;
} {
  const { approverName, senderOrgName, ivrs, expiresLabel } = params;
  const count = ivrs.length;
  const subject =
    count === 1
      ? `IVR ready for your review — ${ivrs[0].patientName}`
      : `${count} IVRs ready for your review`;

  const rows = ivrs
    .map((i, idx) => {
      const num = idx + 1;
      return `
      <tr>
        <td style="padding:16px;border-top:1px solid #eee;">
          <div style="font-size:12px;color:#6b7280;">IVR ${num} of ${count}</div>
          <div style="font-size:15px;font-weight:600;color:#111827;margin-top:2px;">${escapeHtml(
            i.patientName,
          )} <span style="color:#6b7280;font-weight:400;font-size:13px;">· DOB ${escapeHtml(
            i.patientDob,
          )}</span></div>
          <div style="font-size:13px;color:#374151;margin-top:4px;">
            <span style="color:#6b7280;">Physician:</span> ${escapeHtml(
              i.physicianName,
            )}
          </div>
          <div style="font-size:13px;color:#374151;margin-top:4px;">
            <span style="color:#6b7280;">Products:</span> ${escapeHtml(
              i.productSummary,
            )}
          </div>
          <div style="margin-top:12px;">
            <a href="${i.reviewUrl}"
               style="display:inline-block;padding:9px 18px;background:#0f2d4a;color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:500;">
              Review IVR ${num} →
            </a>
          </div>
        </td>
      </tr>`;
    })
    .join("");

  const textRows = ivrs
    .map(
      (i, idx) =>
        `IVR ${idx + 1} of ${count} — ${i.patientName} (DOB ${i.patientDob})\n` +
        `Physician: ${i.physicianName}\n` +
        `Products: ${i.productSummary}\n` +
        `Review: ${i.reviewUrl}\n`,
    )
    .join("\n");

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:24px;background:#f5f7fa;font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
  <table style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <tr>
      <td style="padding:24px 24px 8px;">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:#0f2d4a;font-weight:600;">
          ${escapeHtml(senderOrgName)}
        </div>
        <h1 style="margin:8px 0 0;font-size:20px;color:#111827;">
          Hi ${escapeHtml(approverName)},
        </h1>
        <p style="margin:12px 0 0;color:#374151;">
          You have <strong>${count} IVR${count !== 1 ? "s" : ""}</strong> ready for review.
          Each one opens its own review page where you can Approve or Deny.
        </p>
      </td>
    </tr>
    ${rows}
    <tr>
      <td style="padding:16px 24px 24px;border-top:1px solid #eee;background:#f9fafb;font-size:12px;color:#6b7280;">
        These links expire in ${escapeHtml(expiresLabel)}. If you didn't
        expect this email, you can ignore it — no action means no change.
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Hi ${approverName},

You have ${count} IVR${count !== 1 ? "s" : ""} ready for review. Open each link below to Approve or Deny.

${textRows}

These links expire in ${expiresLabel}. If you didn't expect this email, you can ignore it.

${senderOrgName}`;

  return { subject, html, text };
}

/**
 * Email template — notify internal parties (rep, doctor's staff,
 * Meridian) when an external approver has approved or denied an IVR.
 */
interface DecisionEmailParams {
  recipientName: string;
  decision: "approved" | "denied";
  approverDisplayName: string;
  patientName: string;
  physicianName: string;
  productSummary: string;
  denialReason: string | null;
  ivrUrl: string; // dashboard URL to view the IVR
}

export function buildIvrDecisionEmail(params: DecisionEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    recipientName,
    decision,
    approverDisplayName,
    patientName,
    physicianName,
    productSummary,
    denialReason,
    ivrUrl,
  } = params;

  const isApproved = decision === "approved";
  const emoji = isApproved ? "✅" : "❌";
  const verb = isApproved ? "APPROVED" : "DENIED";
  const bannerColor = isApproved ? "#d1fae5" : "#fee2e2";
  const bannerBorder = isApproved ? "#059669" : "#dc2626";
  const bannerText = isApproved ? "#065f46" : "#7f1d1d";

  const subject = `IVR ${verb.toLowerCase()} — ${patientName}`;

  const reasonBlock =
    !isApproved && denialReason
      ? `<div style="margin-top:12px;padding:12px;background:#fef2f2;border-left:3px solid #dc2626;border-radius:4px;color:#7f1d1d;font-size:13px;">
          <strong>Reason:</strong> ${escapeHtml(denialReason)}
        </div>`
      : "";

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:24px;background:#f5f7fa;font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
  <table style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <tr>
      <td style="padding:24px;">
        <p style="margin:0 0 8px;color:#374151;">Hi ${escapeHtml(recipientName)},</p>
        <div style="margin:16px 0;padding:14px;background:${bannerColor};border-left:4px solid ${bannerBorder};border-radius:6px;color:${bannerText};font-weight:600;font-size:15px;">
          ${emoji} IVR ${verb} by ${escapeHtml(approverDisplayName)}
        </div>
        <div style="font-size:13px;color:#374151;line-height:1.7;">
          <div><strong>Patient:</strong> ${escapeHtml(patientName)}</div>
          <div><strong>Physician:</strong> ${escapeHtml(physicianName)}</div>
          <div><strong>Products:</strong> ${escapeHtml(productSummary)}</div>
        </div>
        ${reasonBlock}
        <div style="margin-top:18px;">
          <a href="${ivrUrl}" style="display:inline-block;padding:9px 18px;background:#0f2d4a;color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:500;">
            Open IVR
          </a>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Hi ${recipientName},

${emoji} IVR ${verb} by ${approverDisplayName}

Patient: ${patientName}
Physician: ${physicianName}
Products: ${productSummary}
${!isApproved && denialReason ? `Reason: ${denialReason}\n` : ""}
Open: ${ivrUrl}`;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
