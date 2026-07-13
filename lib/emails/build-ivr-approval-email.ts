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
  // Patient / physician / product metadata is stored inside the PDF
  // itself and is optional at the DB level (nullable columns since the
  // 2026-07-07 simplification). The email uses fileName as the reliable
  // display label when the metadata is absent.
  patientName: string | null;
  patientDob: string | null;
  physicianName: string | null;
  productSummary: string | null;
  fileName: string | null;
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

  // Prefer the patient name when it's been captured, else the file name,
  // else a generic label. Both the subject and the per-row heading use
  // this helper so the email never renders "null" or "undefined".
  function primaryLabel(i: IvrLineItem, idx: number): string {
    if (i.patientName && i.patientName.trim()) return i.patientName;
    if (i.fileName && i.fileName.trim()) return i.fileName;
    return `IVR ${idx + 1}`;
  }

  const subject =
    count === 1
      ? `IVR ready for your review — ${primaryLabel(ivrs[0], 0)}`
      : `${count} IVRs ready for your review`;

  // Metadata rows (physician / DOB / products) only render when we
  // actually have a value — otherwise we show the file name as the
  // "see the attached PDF" hint. Keeps the email honest instead of
  // shouting "Physician: (blank)".
  function optionalRow(label: string, value: string | null): string {
    if (!value || !value.trim()) return "";
    return `
        <div style="font-size:13px;color:#374151;margin-top:4px;">
          <span style="color:#6b7280;">${label}:</span> ${escapeHtml(value)}
        </div>`;
  }

  const rows = ivrs
    .map((i, idx) => {
      const num = idx + 1;
      const heading = primaryLabel(i, idx);
      const dobLine = i.patientDob
        ? ` <span style="color:#6b7280;font-weight:400;font-size:13px;">· DOB ${escapeHtml(i.patientDob)}</span>`
        : "";
      const fileHint =
        i.fileName && i.fileName !== heading
          ? `<div style="font-size:12px;color:#6b7280;margin-top:2px;">Attachment: ${escapeHtml(i.fileName)}</div>`
          : "";
      return `
      <tr>
        <td style="padding:16px;border-top:1px solid #eee;">
          <div style="font-size:12px;color:#6b7280;">IVR ${num} of ${count}</div>
          <div style="font-size:15px;font-weight:600;color:#111827;margin-top:2px;">${escapeHtml(
            heading,
          )}${dobLine}</div>
          ${fileHint}
          ${optionalRow("Physician", i.physicianName)}
          ${optionalRow("Products", i.productSummary)}
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
    .map((i, idx) => {
      const heading = primaryLabel(i, idx);
      const parts: string[] = [`IVR ${idx + 1} of ${count} — ${heading}`];
      if (i.patientDob) parts.push(`DOB: ${i.patientDob}`);
      if (i.fileName && i.fileName !== heading)
        parts.push(`Attachment: ${i.fileName}`);
      if (i.physicianName) parts.push(`Physician: ${i.physicianName}`);
      if (i.productSummary) parts.push(`Products: ${i.productSummary}`);
      parts.push(`Review: ${i.reviewUrl}`);
      return parts.join("\n");
    })
    .join("\n\n");

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

function escapeHtml(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
