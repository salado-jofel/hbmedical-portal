/** @jsxImportSource react */
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import {
  MONTH_LABELS,
  RECIPIENT_CREDENTIAL_LABELS,
  FORM_CATEGORY_LABELS,
  CONSULTING_STATUS_LABELS,
  COMPLIANCE_FLAGS,
  CERTIFICATIONS,
  type ComplianceFlagKey,
  type ComplianceFlagNoteKey,
} from "@/utils/constants/value-transfers";
import type {
  IValueReport,
  IValueTransferEntry,
  IValueGroupMealEntry,
  IValueSampleEntry,
} from "@/utils/interfaces/value-transfers";

const NAVY = "#0f2d4a";
const GRAY = "#555555";
const LIGHT = "#e2e8f0";
const BG = "#f8fafc";

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#0f172a",
    paddingTop: 36,
    paddingBottom: 50,
    paddingHorizontal: 36,
  },
  h1: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginBottom: 6,
  },
  h2: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginTop: 14,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottom: `1pt solid ${NAVY}`,
  },
  subtitle: { fontSize: 9, color: GRAY, marginBottom: 12 },
  metaTable: { marginBottom: 14, borderTop: `0.5pt solid ${LIGHT}` },
  metaRow: {
    flexDirection: "row",
    borderBottom: `0.5pt solid ${LIGHT}`,
    paddingVertical: 4,
  },
  metaLabel: { width: "35%", fontSize: 8, color: GRAY, fontFamily: "Helvetica-Bold" },
  metaValue: { flex: 1, fontSize: 9 },
  tableHead: {
    flexDirection: "row",
    backgroundColor: BG,
    borderBottom: `1pt solid ${NAVY}`,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tableHeadCell: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: NAVY, textTransform: "uppercase" },
  tableRow: {
    flexDirection: "row",
    borderBottom: `0.5pt solid ${LIGHT}`,
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  tableCell: { fontSize: 8, paddingRight: 4 },
  emptyText: { fontSize: 8, fontStyle: "italic", color: GRAY, marginVertical: 6 },
  flagBlock: {
    marginBottom: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 2,
    backgroundColor: BG,
  },
  flagQuestion: { fontSize: 8.5 },
  flagYes: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "#dc2626" },
  flagNo: { fontSize: 8.5, color: GRAY },
  flagNote: { fontSize: 8, marginTop: 3, color: "#0f172a" },
  certNumber: { fontFamily: "Helvetica-Bold" },
  certText: { fontSize: 9, marginBottom: 6, lineHeight: 1.4 },
  sigBlock: { marginTop: 14, paddingTop: 8, borderTop: `0.5pt solid ${LIGHT}` },
  sigLabel: { fontSize: 8, color: GRAY, marginBottom: 3 },
  sigName: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  sigImage: { height: 50, width: 220, marginVertical: 4 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    fontSize: 7,
    color: GRAY,
    textAlign: "center",
    borderTop: `0.5pt solid ${LIGHT}`,
    paddingTop: 6,
  },
});

function usd(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

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

export interface TransferOfValuePdfProps {
  report: IValueReport;
  transfers: IValueTransferEntry[];
  groupMeals: IValueGroupMealEntry[];
  samples: IValueSampleEntry[];
  /** Optional rep contact info for the cover. */
  repName?: string;
  repEmail?: string;
}

export function TransferOfValuePDF({
  report,
  transfers,
  groupMeals,
  samples,
  repName,
  repEmail,
}: TransferOfValuePdfProps) {
  const monthLabel = MONTH_LABELS[report.reportingMonth - 1] ?? "";
  const totalTransfersValue = transfers.reduce((sum, e) => sum + e.valueAmount, 0);
  const totalGroupMealValue = groupMeals.reduce((sum, e) => sum + e.totalCost, 0);
  const totalValue = totalTransfersValue + totalGroupMealValue;

  const distinctRecipients = new Set<string>();
  for (const t of transfers) distinctRecipients.add(`${t.recipientName}|${t.recipientNpi ?? ""}`);
  for (const gm of groupMeals)
    for (const r of gm.coveredRecipients)
      distinctRecipients.add(`${r.name}|${r.npi ?? ""}`);

  return (
    <Document>
      {/* ── Page 1 — Cover + Summary ── */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.h1}>HB Medical — Transfer of Value Tracking Form</Text>
        <Text style={s.subtitle}>
          Monthly Sunshine Act / Open Payments Report — Sales Representative
        </Text>

        <View style={s.metaTable}>
          <View style={s.metaRow}>
            <Text style={s.metaLabel}>Representative</Text>
            <Text style={s.metaValue}>{repName ?? "—"}</Text>
          </View>
          {repEmail && (
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Email</Text>
              <Text style={s.metaValue}>{repEmail}</Text>
            </View>
          )}
          <View style={s.metaRow}>
            <Text style={s.metaLabel}>Reporting period</Text>
            <Text style={s.metaValue}>
              {monthLabel} {report.reportingYear}
            </Text>
          </View>
          <View style={s.metaRow}>
            <Text style={s.metaLabel}>Territory</Text>
            <Text style={s.metaValue}>{report.territory ?? "—"}</Text>
          </View>
          <View style={s.metaRow}>
            <Text style={s.metaLabel}>Submitted</Text>
            <Text style={s.metaValue}>
              {report.submittedAt
                ? new Date(report.submittedAt).toLocaleString()
                : "—"}
            </Text>
          </View>
        </View>

        <Text style={s.h2}>3.2 Summary</Text>
        <View style={s.metaTable}>
          <View style={s.metaRow}>
            <Text style={s.metaLabel}>Total transfers logged</Text>
            <Text style={s.metaValue}>{transfers.length + groupMeals.length}</Text>
          </View>
          <View style={s.metaRow}>
            <Text style={s.metaLabel}>Distinct Covered Recipients</Text>
            <Text style={s.metaValue}>{distinctRecipients.size}</Text>
          </View>
          <View style={s.metaRow}>
            <Text style={s.metaLabel}>Total dollar value</Text>
            <Text style={s.metaValue}>{usd(totalValue)}</Text>
          </View>
          <View style={s.metaRow}>
            <Text style={s.metaLabel}>Samples / eval units</Text>
            <Text style={s.metaValue}>{samples.length}</Text>
          </View>
        </View>

        <Text style={s.footer}>
          HB Medical — Confidential — For Internal Use Only
        </Text>
      </Page>

      {/* ── Page 2 — Detail log of transfers ── */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.h2}>3.3 Detail Log — Transfers of Value</Text>

        {transfers.length === 0 ? (
          <Text style={s.emptyText}>No individual transfers logged this month.</Text>
        ) : (
          <View>
            <View style={s.tableHead}>
              <Text style={[s.tableHeadCell, { width: "12%" }]}>Date</Text>
              <Text style={[s.tableHeadCell, { width: "22%" }]}>Recipient</Text>
              <Text style={[s.tableHeadCell, { width: "12%" }]}>Type / NPI</Text>
              <Text style={[s.tableHeadCell, { width: "18%" }]}>Affiliation</Text>
              <Text style={[s.tableHeadCell, { width: "13%" }]}>Form</Text>
              <Text style={[s.tableHeadCell, { width: "13%" }]}>Description</Text>
              <Text style={[s.tableHeadCell, { width: "10%", textAlign: "right" }]}>Value</Text>
            </View>
            {transfers.map((t) => (
              <View key={t.id} style={s.tableRow} wrap={false}>
                <Text style={[s.tableCell, { width: "12%" }]}>
                  {new Date(t.transferDate).toLocaleDateString()}
                </Text>
                <Text style={[s.tableCell, { width: "22%" }]}>{t.recipientName}</Text>
                <Text style={[s.tableCell, { width: "12%" }]}>
                  {RECIPIENT_CREDENTIAL_LABELS[t.recipientCredential].split(" — ")[0]}
                  {t.recipientNpi ? `\n${t.recipientNpi}` : ""}
                </Text>
                <Text style={[s.tableCell, { width: "18%" }]}>
                  {t.affiliation ?? "—"}
                </Text>
                <Text style={[s.tableCell, { width: "13%" }]}>
                  {FORM_CATEGORY_LABELS[t.formCategory]}
                </Text>
                <Text style={[s.tableCell, { width: "13%" }]}>
                  {t.description ?? "—"}
                </Text>
                <Text style={[s.tableCell, { width: "10%", textAlign: "right" }]}>
                  {usd(t.valueAmount)}
                  {t.isEstimate ? " (est.)" : ""}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={s.h2}>3.5 Group Meal Allocation</Text>
        {groupMeals.length === 0 ? (
          <Text style={s.emptyText}>No group meals logged this month.</Text>
        ) : (
          <View>
            <View style={s.tableHead}>
              <Text style={[s.tableHeadCell, { width: "14%" }]}>Date</Text>
              <Text style={[s.tableHeadCell, { width: "14%", textAlign: "right" }]}>Total cost</Text>
              <Text style={[s.tableHeadCell, { width: "12%", textAlign: "right" }]}>Attendees</Text>
              <Text style={[s.tableHeadCell, { width: "14%", textAlign: "right" }]}>Per-person</Text>
              <Text style={[s.tableHeadCell, { width: "46%" }]}>Covered Recipients</Text>
            </View>
            {groupMeals.map((g) => (
              <View key={g.id} style={s.tableRow} wrap={false}>
                <Text style={[s.tableCell, { width: "14%" }]}>
                  {new Date(g.groupMealDate).toLocaleDateString()}
                </Text>
                <Text style={[s.tableCell, { width: "14%", textAlign: "right" }]}>
                  {usd(g.totalCost)}
                </Text>
                <Text style={[s.tableCell, { width: "12%", textAlign: "right" }]}>
                  {g.totalAttendees}
                </Text>
                <Text style={[s.tableCell, { width: "14%", textAlign: "right" }]}>
                  {usd(g.perPersonAllocation)}
                </Text>
                <Text style={[s.tableCell, { width: "46%" }]}>
                  {g.coveredRecipients
                    .map((r) => `${r.name} (${r.credential}${r.npi ? `, ${r.npi}` : ""})`)
                    .join(", ") || "—"}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={s.footer}>
          HB Medical — Confidential — For Internal Use Only
        </Text>
      </Page>

      {/* ── Page 3 — Samples + Consulting + Flags ── */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.h2}>4. Samples and Evaluation Units</Text>
        <Text style={s.subtitle}>
          Tracked for FDA / inventory. Not reportable under Sunshine Act when used for legitimate purposes.
        </Text>
        {samples.length === 0 ? (
          <Text style={s.emptyText}>No samples logged this month.</Text>
        ) : (
          <View>
            <View style={s.tableHead}>
              <Text style={[s.tableHeadCell, { width: "13%" }]}>Date</Text>
              <Text style={[s.tableHeadCell, { width: "27%" }]}>Recipient / facility</Text>
              <Text style={[s.tableHeadCell, { width: "22%" }]}>Product / lot</Text>
              <Text style={[s.tableHeadCell, { width: "10%", textAlign: "right" }]}>Qty</Text>
              <Text style={[s.tableHeadCell, { width: "16%" }]}>Purpose</Text>
              <Text style={[s.tableHeadCell, { width: "12%" }]}>Return</Text>
            </View>
            {samples.map((sm) => (
              <View key={sm.id} style={s.tableRow} wrap={false}>
                <Text style={[s.tableCell, { width: "13%" }]}>
                  {new Date(sm.sampleDate).toLocaleDateString()}
                </Text>
                <Text style={[s.tableCell, { width: "27%" }]}>{sm.recipientFacility}</Text>
                <Text style={[s.tableCell, { width: "22%" }]}>{sm.productLot}</Text>
                <Text style={[s.tableCell, { width: "10%", textAlign: "right" }]}>
                  {sm.quantity}
                </Text>
                <Text style={[s.tableCell, { width: "16%" }]}>
                  {sm.purpose ?? "—"}
                </Text>
                <Text style={[s.tableCell, { width: "12%" }]}>
                  {sm.returnDate ? new Date(sm.returnDate).toLocaleDateString() : "—"}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={s.h2}>5. Consulting Agreements and Honoraria</Text>
        <View style={s.metaTable}>
          <View style={s.metaRow}>
            <Text style={s.metaLabel}>Any engagements proposed?</Text>
            <Text style={s.metaValue}>
              {report.consultingProposed ? "Yes" : "No"}
            </Text>
          </View>
          {report.consultingProposed && (
            <>
              <View style={s.metaRow}>
                <Text style={s.metaLabel}>Covered Recipient</Text>
                <Text style={s.metaValue}>{report.consultingRecipient ?? "—"}</Text>
              </View>
              <View style={s.metaRow}>
                <Text style={s.metaLabel}>Topic / scope</Text>
                <Text style={s.metaValue}>{report.consultingTopic ?? "—"}</Text>
              </View>
              <View style={s.metaRow}>
                <Text style={s.metaLabel}>Status</Text>
                <Text style={s.metaValue}>
                  {report.consultingStatus
                    ? CONSULTING_STATUS_LABELS[report.consultingStatus]
                    : "—"}
                </Text>
              </View>
            </>
          )}
        </View>

        <Text style={s.h2}>6. Compliance Flags and Disclosures</Text>
        {COMPLIANCE_FLAGS.map((f) => {
          const flagged = Boolean(report[FLAG_PROP_MAP[f.key]]);
          const note = report[NOTE_PROP_MAP[f.noteKey]] as string | null;
          return (
            <View key={f.key} style={s.flagBlock} wrap={false}>
              <Text style={s.flagQuestion}>{f.question}</Text>
              <Text style={flagged ? s.flagYes : s.flagNo}>
                {flagged ? "YES — requires compliance review" : "No"}
              </Text>
              {flagged && note && <Text style={s.flagNote}>{note}</Text>}
            </View>
          );
        })}

        <Text style={s.footer}>
          HB Medical — Confidential — For Internal Use Only
        </Text>
      </Page>

      {/* ── Page 4 — Certification ── */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.h2}>7. Representative Certification</Text>
        <Text style={s.subtitle}>
          By signing below, the Representative certifies under penalty of the
          Sales Representative Agreement and applicable law that:
        </Text>
        {CERTIFICATIONS.map((c, i) => (
          <Text key={i} style={s.certText}>
            <Text style={s.certNumber}>{i + 1}. </Text>
            {c}
          </Text>
        ))}

        <View style={s.sigBlock}>
          <Text style={s.sigLabel}>Representative Name (printed)</Text>
          <Text style={s.sigName}>{report.certifiedName ?? "—"}</Text>

          {report.certifiedSignatureUrl && (
            <>
              <Text style={[s.sigLabel, { marginTop: 10 }]}>Signature</Text>
              <Image src={report.certifiedSignatureUrl} style={s.sigImage} />
            </>
          )}

          <Text style={[s.sigLabel, { marginTop: 10 }]}>Date</Text>
          <Text style={{ fontSize: 10 }}>
            {report.certifiedAt
              ? new Date(report.certifiedAt).toLocaleString()
              : "—"}
          </Text>
        </View>

        <Text style={s.footer}>
          HB Medical — Confidential — For Internal Use Only
        </Text>
      </Page>
    </Document>
  );
}
