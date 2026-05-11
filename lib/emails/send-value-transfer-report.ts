import { resend, ACCOUNTS_FROM_EMAIL } from "@/lib/emails/resend";
import {
  COMPLIANCE_FLAGS,
  MONTH_LABELS,
  type ComplianceFlagKey,
  type ComplianceFlagNoteKey,
} from "@/utils/constants/value-transfers";
import type { IValueReport } from "@/utils/interfaces/value-transfers";

const LOGO_URL =
  "https://ersdsmuybpfvgvaiwcgl.supabase.co/storage/v1/object/public/hbmedical-bucket-public/assets/meridian-logo.png";

const FLAG_PROP_MAP: Record<ComplianceFlagKey, keyof IValueReport> = {
  flag_recipient_no_report: "flagRecipientNoReport",
  flag_ownership_inquiry: "flagOwnershipInquiry",
  flag_mischaracterize: "flagMischaracterize",
  flag_third_party: "flagThirdParty",
  flag_funding_for_referrals: "flagFundingForReferrals",
  flag_family_member: "flagFamilyMember",
  flag_other: "flagOther",
};

const NOTE_PROP_MAP: Record<ComplianceFlagNoteKey, keyof IValueReport> = {
  flag_recipient_no_report_note: "flagRecipientNoReportNote",
  flag_ownership_inquiry_note: "flagOwnershipInquiryNote",
  flag_mischaracterize_note: "flagMischaracterizeNote",
  flag_third_party_note: "flagThirdPartyNote",
  flag_funding_for_referrals_note: "flagFundingForReferralsNote",
  flag_family_member_note: "flagFamilyMemberNote",
  flag_other_note: "flagOtherNote",
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildFlagsBlock(report: IValueReport): string {
  const triggered = COMPLIANCE_FLAGS.filter((f) =>
    Boolean(report[FLAG_PROP_MAP[f.key]]),
  );
  if (triggered.length === 0) {
    return `<p style="font-size:13px;color:#16a34a;margin:0 0 12px;">
      <strong>No compliance flags triggered this month.</strong>
    </p>`;
  }

  const items = triggered
    .map((f) => {
      const note = report[NOTE_PROP_MAP[f.noteKey]] as string | null;
      return `<li style="margin:0 0 8px;">
        <div style="font-weight:600;color:#dc2626;">${escapeHtml(f.question)}</div>
        ${note ? `<div style="margin-top:2px;color:#475569;">${escapeHtml(note)}</div>` : ""}
      </li>`;
    })
    .join("");

  return `
    <div style="margin:0 0 16px;padding:14px 16px;background:#fef2f2;border-left:3px solid #dc2626;border-radius:6px;">
      <div style="font-size:13px;font-weight:700;color:#7f1d1d;margin-bottom:8px;">
        ⚠ Compliance flags triggered — review required
      </div>
      <ul style="margin:0;padding-left:18px;font-size:13px;color:#7f1d1d;">${items}</ul>
    </div>`;
}

type SendParams = {
  to: string | string[];
  report: IValueReport;
  repName: string;
  repEmail: string;
  totalTransfers: number;
  distinctRecipients: number;
  totalValueUsd: number;
  pdfBuffer: Buffer;
  pdfFileName: string;
};

export async function sendValueTransferReportEmail({
  to,
  report,
  repName,
  repEmail,
  totalTransfers,
  distinctRecipients,
  totalValueUsd,
  pdfBuffer,
  pdfFileName,
}: SendParams): Promise<void> {
  const monthLabel = MONTH_LABELS[report.reportingMonth - 1] ?? "";
  const usd = totalValueUsd.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });

  const subject = `Transfer of Value Report — ${repName} — ${monthLabel} ${report.reportingYear}`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f4f7f9;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <div style="background:#f4f7f9;padding:32px 16px;">
    <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
      <div style="padding:22px 28px 16px;text-align:center;border-bottom:1px solid #f1f5f9;">
        <img src="${LOGO_URL}" alt="Meridian" width="176" style="display:block;margin:0 auto;height:auto;" />
      </div>
      <div style="padding:28px 32px;line-height:1.6;color:#334155;">
        <h1 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 12px;">
          Monthly Transfer of Value Report
        </h1>
        <p style="margin:0 0 14px;font-size:14px;">
          ${escapeHtml(repName)} has submitted the Sunshine Act / Open Payments
          tracking report for <strong>${monthLabel} ${report.reportingYear}</strong>.
          The full report is attached as a PDF for your records.
        </p>

        <div style="margin:18px 0;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;">
          <div style="margin:3px 0;"><strong>Representative:</strong> ${escapeHtml(repName)} &lt;${escapeHtml(repEmail)}&gt;</div>
          <div style="margin:3px 0;"><strong>Territory:</strong> ${escapeHtml(report.territory ?? "—")}</div>
          <div style="margin:3px 0;"><strong>Total transfers:</strong> ${totalTransfers}</div>
          <div style="margin:3px 0;"><strong>Distinct Covered Recipients:</strong> ${distinctRecipients}</div>
          <div style="margin:3px 0;"><strong>Total dollar value:</strong> ${usd}</div>
          <div style="margin:3px 0;"><strong>Submitted:</strong> ${report.submittedAt ? new Date(report.submittedAt).toLocaleString() : "—"}</div>
        </div>

        ${buildFlagsBlock(report)}

        <p style="margin:18px 0 0;font-size:13px;color:#94a3b8;">
          Sent automatically from Meridian Portal on submission. The attached PDF
          is the rep's certified, signed copy and is the record-of-truth for CMS
          Open Payments reporting.
        </p>
      </div>
      <div style="background:#f8fafc;padding:18px 24px;text-align:center;font-size:12px;color:#64748b;border-top:1px solid #f1f5f9;">
        &copy; 2026 Meridian Portal · HB Medical · Confidential
      </div>
    </div>
  </div>
</body></html>`;

  await resend.emails.send({
    from: ACCOUNTS_FROM_EMAIL,
    to,
    subject,
    html,
    attachments: [
      {
        filename: pdfFileName,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });
}
