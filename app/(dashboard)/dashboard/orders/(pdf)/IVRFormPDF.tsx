/** @jsxImportSource react */
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { PDFHeader } from "./PDFHeader";
import { CB, CBVal } from "./PDFComponents";

/* ── Palette ── */
const NAVY  = "#0f2d4a";
const GRAY  = "#6B7280";
const LGRAY = "#F9FAFB";
const LINE  = "#D1D5DB";
const BLACK = "#000000";
const WHITE = "#FFFFFF";

/* ── Styles ── */
const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: BLACK,
    paddingTop: 28,
    paddingBottom: 48,
    paddingHorizontal: 36,
    backgroundColor: "#fff",
  },
  sectionHeader: {
    backgroundColor: NAVY,
    color: WHITE,
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    padding: "3 8",
    marginTop: 8,
    letterSpacing: 0.8,
  },
  sectionBody: {
    border: `0.5pt solid ${LINE}`,
    padding: "6 10",
    backgroundColor: LGRAY,
  },
  label: {
    fontSize: 6.5,
    color: GRAY,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  uval: {
    fontSize: 8,
    color: BLACK,
    borderBottom: `0.5pt solid #333`,
    paddingBottom: 1,
    flex: 1,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 6.5,
    color: GRAY,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    width: 100,
    flexShrink: 0,
    paddingBottom: 1,
  },
  subHeader: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    color: NAVY,
    borderBottom: `0.5pt solid ${LINE}`,
    paddingBottom: 2,
    marginBottom: 4,
  },
  twoCol: { flexDirection: "row", gap: 10 },
  col: { flex: 1 },
  cbRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: 2,
    marginBottom: 2,
  },
  notesBox: {
    marginTop: 8,
    padding: "6 10",
    backgroundColor: "#F3F4F6",
    border: `0.5pt solid ${LINE}`,
  },
  sigLine: {
    borderBottom: `0.75pt solid #333`,
    marginTop: 16,
    marginBottom: 2,
  },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 6.5,
    color: GRAY,
    borderTop: `0.5pt solid ${LINE}`,
    paddingTop: 4,
  },
});

/* ── Helpers ── */
const f = (v: unknown, fallback = "—"): string =>
  v != null && v !== "" ? String(v) : fallback;

const fBlank = (v: unknown): string =>
  v != null && v !== "" ? String(v) : "";

function Row({ label, value, labelW = 100 }: { label: string; value: string; labelW?: number }) {
  return (
    <View style={s.fieldRow}>
      <Text style={[s.fieldLabel, { width: labelW }]}>{label}:</Text>
      <Text style={s.uval}>{value}</Text>
    </View>
  );
}

function TwoRow({
  left,
  right,
}: {
  left: { label: string; value: string };
  right: { label: string; value: string };
}) {
  return (
    <View style={s.twoCol}>
      <View style={s.col}><Row label={left.label} value={left.value} labelW={80} /></View>
      <View style={s.col}><Row label={right.label} value={right.value} labelW={80} /></View>
    </View>
  );
}

/* ── Known wound types & products ── */
const WOUND_TYPES_ROW1 = [
  "Diabetic Foot Ulcer",
  "Venous Leg Ulcer",
  "Pressure Ulcer",
  "Traumatic Burns",
] as const;

const WOUND_TYPES_ROW2 = [
  "Radiation Burns",
  "Necrotizing Fasciitis",
  "Dehisced Surgical Wound",
] as const;

const KNOWN_PRODUCTS = [
  "CompleteAA",
  "Membrane Wrap",
  "Hydro Membrane Wrap",
  "WoundPlus",
  "ESANO",
] as const;

/* ── Component ── */
export function IVRFormPDF({
  order,
  ivr,
}: {
  order: Record<string, unknown>;
  ivr: Record<string, unknown> | null;
  form?: Record<string, unknown> | null;
  physicianName?: string | null;
}) {
  const i = ivr ?? {};

  /* Parse product_information (comma-separated) */
  const productParts = fBlank(i.product_information)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const otherProduct = productParts.find((p) => p.startsWith("Other:"));
  const otherProductText = otherProduct ? otherProduct.slice(6).trim() : "";

  /* Wound type — check if "Other" (not in known list) */
  const knownWoundTypes: string[] = [...WOUND_TYPES_ROW1, ...WOUND_TYPES_ROW2];
  const woundTypeIsOther =
    !!i.wound_type &&
    !knownWoundTypes.includes(String(i.wound_type));

  /* Date display */
  const fmtDate = (v: unknown): string => {
    if (!v) return "—";
    try { return new Date(String(v)).toLocaleDateString("en-US"); } catch { return String(v); }
  };

  return (
    <Document>
      <Page size="LETTER" wrap style={s.page}>

        {/* ── 1. HEADER ── */}
        <PDFHeader title="Patient Insurance Support Form" />
        <View style={{ marginTop: 2, marginBottom: 6, alignItems: "center" }}>
          <Text style={{ fontSize: 7, color: GRAY }}>
            Please fax completed form to toll-free HIPAA compliant fax: 223.336.4751
          </Text>
          <Text style={{ fontSize: 7, color: GRAY, marginTop: 1 }}>
            Or email to Reimbursement@MeridianSurgical.com
          </Text>
        </View>

        {/* ── 2. SALES REP ── */}
        <View style={[s.fieldRow, { marginBottom: 6 }]}>
          <Text style={s.fieldLabel}>Sales Rep:</Text>
          <Text style={s.uval}>{f(i.sales_rep_name)}</Text>
        </View>

        {/* ── 3. FACILITY INFORMATION ── */}
        <Text style={s.sectionHeader}>FACILITY INFORMATION</Text>
        <View style={s.sectionBody}>
          {/* Place of Service */}
          <View style={{ marginBottom: 4 }}>
            <Text style={[s.label, { marginBottom: 2 }]}>Place of Service:</Text>
            <View style={s.cbRow}>
              {["Office", "Outpatient Hospital", "Ambulatory Surgical Center", "Other"].map((pos) => (
                <CBVal key={pos} current={i.place_of_service} value={pos} label={pos} />
              ))}
            </View>
          </View>
          <TwoRow left={{ label: "Facility Name", value: f(i.facility_name) }} right={{ label: "Medicare Admin Contractor", value: f(i.medicare_admin_contractor) }} />
          <TwoRow left={{ label: "Address", value: f(i.facility_address) }} right={{ label: "NPI", value: f(i.facility_npi) }} />
          <TwoRow left={{ label: "Contact Name", value: f(i.facility_contact) }} right={{ label: "TIN", value: f(i.facility_tin) }} />
          <TwoRow left={{ label: "Phone", value: f(i.facility_phone) }} right={{ label: "PTAN", value: f(i.facility_ptan) }} />
          <Row label="Fax" value={f(i.facility_fax)} labelW={80} />
        </View>

        {/* ── 4. PHYSICIAN INFORMATION ── */}
        <Text style={s.sectionHeader}>PHYSICIAN INFORMATION</Text>
        <View style={s.sectionBody}>
          <TwoRow left={{ label: "Physician Name", value: f(i.physician_name) }} right={{ label: "Fax", value: f(i.physician_fax) }} />
          <TwoRow left={{ label: "Address", value: f(i.physician_address) }} right={{ label: "NPI", value: f(i.physician_npi) }} />
          <TwoRow left={{ label: "Phone", value: f(i.physician_phone) }} right={{ label: "TIN", value: f(i.physician_tin) }} />
        </View>

        {/* ── 5. PATIENT INFORMATION ── */}
        <Text style={s.sectionHeader}>PATIENT INFORMATION</Text>
        <View style={s.sectionBody}>
          <TwoRow left={{ label: "Patient Name", value: f(i.patient_name) }} right={{ label: "Phone", value: f(i.patient_phone) }} />
          <Row label="Address (City / State / Zip)" value={f(i.patient_address)} labelW={130} />
          <TwoRow left={{ label: "Date of Birth", value: fmtDate(i.patient_dob) }} right={{ label: "", value: "" }} />
          <View style={s.fieldRow}>
            <Text style={s.fieldLabel}>OK to Contact:</Text>
            <View style={s.cbRow}>
              <CB checked={i.ok_to_contact_patient === true}  label="Yes" />
              <CB checked={i.ok_to_contact_patient === false} label="No"  />
            </View>
          </View>
        </View>

        {/* ── 6. INSURANCE INFORMATION ── */}
        <Text style={s.sectionHeader}>INSURANCE INFORMATION</Text>
        <View style={[s.sectionBody, { flexDirection: "row", gap: 12 }]}>
          {/* Primary */}
          <View style={{ flex: 1, borderRight: `0.5pt solid ${LINE}`, paddingRight: 8 }}>
            <Text style={s.subHeader}>Primary Insurance</Text>
            <Row label="Subscriber Name" value={f(i.subscriber_name)} labelW={90} />
            <Row label="Policy / Member ID" value={f(i.member_id)} labelW={90} />
            <Row label="Subscriber DOB" value={fmtDate(i.subscriber_dob)} labelW={90} />
            <View style={{ marginBottom: 4 }}>
              <Text style={[s.label, { marginBottom: 2 }]}>Type of Plan:</Text>
              <View style={s.cbRow}>
                <CBVal current={i.plan_type} value="HMO" label="HMO" />
                <CBVal current={i.plan_type} value="PPO" label="PPO" />
                <CBVal current={i.plan_type} value="Other" label="Other" />
              </View>
            </View>
            <Row label="Insurance Phone" value={f(i.insurance_phone)} labelW={90} />
            <View>
              <Text style={[s.label, { marginBottom: 2 }]}>Provider Participates:</Text>
              <View style={s.cbRow}>
                <CBVal current={i.provider_participates_primary} value="Yes"      label="Yes" />
                <CBVal current={i.provider_participates_primary} value="No"       label="No" />
                <CBVal current={i.provider_participates_primary} value="Not Sure" label="Not Sure" />
              </View>
            </View>
          </View>

          {/* Secondary */}
          <View style={{ flex: 1 }}>
            <Text style={s.subHeader}>Secondary Insurance</Text>
            <Row label="Subscriber Name" value={f(i.secondary_subscriber_name)} labelW={90} />
            <Row label="Policy Number" value={f(i.secondary_policy_number)} labelW={90} />
            <Row label="Subscriber DOB" value={fmtDate(i.secondary_subscriber_dob)} labelW={90} />
            <View style={{ marginBottom: 4 }}>
              <Text style={[s.label, { marginBottom: 2 }]}>Type of Plan:</Text>
              <View style={s.cbRow}>
                <CBVal current={i.secondary_plan_type} value="HMO" label="HMO" />
                <CBVal current={i.secondary_plan_type} value="PPO" label="PPO" />
                <CBVal current={i.secondary_plan_type} value="Other" label="Other" />
              </View>
            </View>
            <Row label="Insurance Phone" value={f(i.secondary_insurance_phone)} labelW={90} />
            <View>
              <Text style={[s.label, { marginBottom: 2 }]}>Provider Participates:</Text>
              <View style={s.cbRow}>
                <CBVal current={i.provider_participates_secondary} value="Yes"      label="Yes" />
                <CBVal current={i.provider_participates_secondary} value="No"       label="No" />
                <CBVal current={i.provider_participates_secondary} value="Not Sure" label="Not Sure" />
              </View>
            </View>
          </View>
        </View>

        {/* ── 7. WOUND INFORMATION ── */}
        <Text style={s.sectionHeader}>WOUND INFORMATION</Text>
        <View style={s.sectionBody}>
          <View style={{ marginBottom: 4 }}>
            <Text style={[s.label, { marginBottom: 2 }]}>Wound Type:</Text>
            <View style={[s.cbRow, { marginBottom: 2 }]}>
              {WOUND_TYPES_ROW1.map((wt) => (
                <CBVal key={wt} current={i.wound_type} value={wt} label={wt} />
              ))}
            </View>
            <View style={s.cbRow}>
              {WOUND_TYPES_ROW2.map((wt) => (
                <CBVal key={wt} current={i.wound_type} value={wt} label={wt} />
              ))}
              <CB
                checked={woundTypeIsOther}
                label={woundTypeIsOther ? `Other: ${f(i.wound_type)}` : "Other"}
              />
            </View>
          </View>
          <TwoRow left={{ label: "Wound Size(s)", value: f(i.wound_sizes) }} right={{ label: "Application CPT(s)", value: f(i.application_cpts) }} />
          <TwoRow left={{ label: "Date of Procedure", value: fmtDate(i.date_of_procedure) }} right={{ label: "ICD-10 Diagnosis Code(s)", value: f(i.icd10_codes) }} />
          <View>
            <Text style={[s.label, { marginBottom: 2 }]}>Product Information:</Text>
            <View style={s.cbRow}>
              {KNOWN_PRODUCTS.map((product) => (
                <CB
                  key={product}
                  checked={productParts.includes(product)}
                  label={product}
                />
              ))}
              <CB
                checked={!!otherProduct}
                label={otherProductText ? `Other: ${otherProductText}` : "Other"}
              />
            </View>
          </View>
        </View>

        {/* ── 8. ADDITIONAL INFORMATION ── */}
        <Text style={s.sectionHeader}>ADDITIONAL INFORMATION</Text>
        <View style={s.sectionBody}>
          <View style={[s.fieldRow, { alignItems: "center" }]}>
            <Text style={[s.fieldLabel, { width: 200 }]}>Patient currently residing in SNF?</Text>
            <View style={s.cbRow}>
              <CB checked={i.is_patient_at_snf === true}  label="Yes" />
              <CB checked={i.is_patient_at_snf === false} label="No"  />
            </View>
          </View>
          <View style={[s.fieldRow, { alignItems: "center" }]}>
            <Text style={[s.fieldLabel, { width: 200 }]}>Patient under surgical Global Period?</Text>
            <View style={s.cbRow}>
              <CB checked={i.surgical_global_period === true}  label="Yes" />
              <CB checked={i.surgical_global_period === false} label="No"  />
            </View>
          </View>
          <Row label="CPT Code (if global period)" value={f(i.global_period_cpt)} labelW={130} />
          <View style={[s.fieldRow, { alignItems: "center", marginTop: 2 }]}>
            <CB checked={i.prior_auth_permission === true} label="" />
            <Text style={{ fontSize: 7, color: BLACK, flex: 1, marginLeft: 4 }}>
              If Prior Authorization is Required, check here to allow us to work with payer on your behalf.
            </Text>
          </View>
          <Text style={{ fontSize: 7, color: GRAY, marginTop: 3, fontFamily: "Helvetica-Oblique" }}>
            Please attach a copy of the patient&apos;s clinical records.
          </Text>
          <Row label="Specialty Site Name (if different)" value={f(i.specialty_site_name)} labelW={150} />
        </View>

        {/* ── 9. IMPORTANT NOTES ── */}
        <View style={s.notesBox}>
          <Text style={{ fontSize: 7, color: BLACK, marginBottom: 2 }}>
            • Please include the front &amp; back copy of the patient insurance card.
          </Text>
          <Text style={{ fontSize: 7, color: BLACK }}>
            • This verification of benefits is not a guarantee of payment by the payor.
          </Text>
        </View>

        {/* ── 10. PHYSICIAN AGREEMENT ── */}
        <View style={{ marginTop: 10, paddingTop: 6, borderTop: `0.5pt solid ${LINE}` }}>
          <Text style={{ fontSize: 7, color: BLACK, lineHeight: 1.5, marginBottom: 8 }}>
            By signing below, I certify that I have received the necessary patient authorization to release the medical
            and/or other patient information referenced on the form relating to the above-referenced patient. This
            information is for verifying insurance coverage, seeking reimbursement, and the sole purpose of claim support.
          </Text>
          <View style={s.twoCol}>
            <View style={s.col}>
              <View style={s.sigLine} />
              <Text style={[s.label, { marginTop: 2 }]}>Physician or Authorized Signature</Text>
              {i.physician_signature ? (
                <Text style={{ fontSize: 8, fontFamily: "Helvetica-Oblique", marginTop: 2 }}>
                  {String(i.physician_signature)}
                </Text>
              ) : null}
            </View>
            <View style={{ width: 140 }}>
              <View style={s.sigLine} />
              <Text style={[s.label, { marginTop: 2 }]}>Date</Text>
              {i.physician_signature_date ? (
                <Text style={{ fontSize: 8, marginTop: 2 }}>{String(i.physician_signature_date)}</Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* ── 11. FOOTER ── */}
        <View style={s.footer} fixed>
          <Text>235 Singleton Ridge Road Suite 105, Conway SC 29526  |  MeridianSurgicalsupplies.com</Text>
          <Text render={({ pageNumber, totalPages }) => `REV2.1  |  Page ${pageNumber} of ${totalPages}`} />
        </View>

      </Page>
    </Document>
  );
}
