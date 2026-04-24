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
  console.log("[IVRFormPDF] ivr received:", ivr ? "YES" : "NO (null)");
  console.log("[IVRFormPDF] ivr.facility_name:", ivr?.facility_name ?? "(null)");
  console.log("[IVRFormPDF] ivr.physician_name:", ivr?.physician_name ?? "(null)");
  console.log("[IVRFormPDF] ivr.patient_name:", ivr?.patient_name ?? "(null)");
  console.log("[IVRFormPDF] ivr.sales_rep_name:", ivr?.sales_rep_name ?? "(null)");

  /* ── Extract all fields from ivr record ── */
  const salesRep          = f(ivr?.sales_rep_name);
  // Facility
  const facilityName      = f(ivr?.facility_name);
  const medicareAdmin     = f(ivr?.medicare_admin_contractor);
  const facilityAddress   = f(ivr?.facility_address);
  const facilityNpi       = f(ivr?.facility_npi);
  const facilityContact   = f(ivr?.facility_contact);
  const facilityTin       = f(ivr?.facility_tin);
  const facilityPhone     = f(ivr?.facility_phone);
  const facilityPtan      = f(ivr?.facility_ptan);
  const facilityFax       = f(ivr?.facility_fax);
  const placeOfService    = ivr?.place_of_service;
  // Physician
  const physicianName     = f(ivr?.physician_name);
  const physicianFax      = f(ivr?.physician_fax);
  const physicianAddress  = f(ivr?.physician_address);
  const physicianNpi      = f(ivr?.physician_npi);
  const physicianPhone    = f(ivr?.physician_phone);
  const physicianTin      = f(ivr?.physician_tin);
  // Patient
  const patientName       = f(ivr?.patient_name);
  const patientPhone      = f(ivr?.patient_phone);
  const patientAddress    = f(ivr?.patient_address);
  const okToContact       = ivr?.ok_to_contact_patient;
  // Insurance — primary
  const subscriberName    = f(ivr?.subscriber_name);
  const memberId          = f(ivr?.member_id);
  const subscriberDob     = ivr?.subscriber_dob;
  const planType          = ivr?.plan_type;
  const insurancePhone    = f(ivr?.insurance_phone);
  const providerPrimary   = ivr?.provider_participates_primary;
  // Insurance — secondary
  const secSubscriberName = f(ivr?.secondary_subscriber_name);
  const secPolicyNumber   = f(ivr?.secondary_policy_number);
  const secSubscriberDob  = ivr?.secondary_subscriber_dob;
  const secPlanType       = ivr?.secondary_plan_type;
  const secInsurancePhone = f(ivr?.secondary_insurance_phone);
  const providerSecondary = ivr?.provider_participates_secondary;
  // Wound
  const woundType         = ivr?.wound_type;
  const woundSizes        = f(ivr?.wound_sizes);
  const applicationCpts   = f(ivr?.application_cpts);
  const dateOfProcedure   = ivr?.date_of_procedure;
  const icd10Codes        = f(ivr?.icd10_codes);
  const productInfo       = fBlank(ivr?.product_information ?? "");
  // Additional
  const isPatientAtSnf    = ivr?.is_patient_at_snf;
  const surgicalGlobal    = ivr?.surgical_global_period;
  const globalCpt         = f(ivr?.global_period_cpt);
  const priorAuthPerm     = ivr?.prior_auth_permission;
  const specialtySite     = f(ivr?.specialty_site_name);
  // Signature
  const physicianSig      = ivr?.physician_signature;
  const physicianSigDate  = ivr?.physician_signature_date;

  // Chronic-only bundle — extended insurance, benefits, detailed auth,
  // verification. Gated by order.wound_type so post-surgical renders the
  // lean physician-facing form per the client-provided template.
  const isPostSurgical = (order as any)?.wound_type === "post_surgical";
  const groupNumber        = f(ivr?.group_number);
  const planName           = f(ivr?.plan_name);
  const subscriberRel      = f(ivr?.subscriber_relationship);
  const coverageStart      = ivr?.coverage_start_date;
  const coverageEnd        = ivr?.coverage_end_date;
  const secGroupNumber     = f(ivr?.secondary_group_number);
  const secSubscriberRel   = f(ivr?.secondary_subscriber_relationship);
  const deductibleAmount   = ivr?.deductible_amount;
  const deductibleMet      = ivr?.deductible_met;
  const outOfPocketMax     = ivr?.out_of_pocket_max;
  const outOfPocketMet     = ivr?.out_of_pocket_met;
  const copayAmount        = ivr?.copay_amount;
  const coinsurancePercent = ivr?.coinsurance_percent;
  const dmeCovered         = ivr?.dme_covered;
  const woundCareCovered   = ivr?.wound_care_covered;
  const priorAuthRequired  = ivr?.prior_auth_required;
  const priorAuthNumber    = f(ivr?.prior_auth_number);
  const unitsAuthorized    = ivr?.units_authorized;
  const priorAuthStart     = ivr?.prior_auth_start_date;
  const priorAuthEnd       = ivr?.prior_auth_end_date;
  const verifiedBy         = f(ivr?.verified_by);
  const verifiedDate       = ivr?.verified_date;
  const verificationRef    = f(ivr?.verification_reference);
  const verificationNotes  = f(ivr?.notes);

  const fmtMoney = (v: unknown): string => {
    if (v == null || v === "") return "—";
    const n = Number(v);
    if (!isFinite(n)) return "—";
    return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
  };

  /* Date display */
  const fmtDate = (v: unknown): string => {
    if (!v) return "—";
    try { return new Date(String(v)).toLocaleDateString("en-US"); } catch { return String(v); }
  };

  /* Parse product_information (comma-separated) */
  const productParts = productInfo
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const otherProduct = productParts.find((p) => p.startsWith("Other:"));
  const otherProductText = otherProduct ? otherProduct.slice(6).trim() : "";

  /* Wound type — check if "Other" (not in known list) */
  const knownWoundTypes: string[] = [...WOUND_TYPES_ROW1, ...WOUND_TYPES_ROW2];
  const woundTypeIsOther =
    !!woundType &&
    !knownWoundTypes.includes(String(woundType));

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
          <Text style={s.uval}>{salesRep}</Text>
        </View>

        {/* ── 3. FACILITY INFORMATION ── */}
        <Text style={s.sectionHeader}>FACILITY INFORMATION</Text>
        <View style={s.sectionBody}>
          {/* Place of Service */}
          <View style={{ marginBottom: 4 }}>
            <Text style={[s.label, { marginBottom: 2 }]}>Place of Service:</Text>
            <View style={s.cbRow}>
              {["Office", "Outpatient Hospital", "Ambulatory Surgical Center", "Other"].map((pos) => (
                <CBVal key={pos} current={placeOfService} value={pos} label={pos} />
              ))}
            </View>
          </View>
          <TwoRow left={{ label: "Facility Name", value: facilityName }} right={{ label: "Medicare Admin Contractor", value: medicareAdmin }} />
          <TwoRow left={{ label: "Address", value: facilityAddress }} right={{ label: "NPI", value: facilityNpi }} />
          <TwoRow left={{ label: "Contact Name", value: facilityContact }} right={{ label: "TIN", value: facilityTin }} />
          <TwoRow left={{ label: "Phone", value: facilityPhone }} right={{ label: "PTAN", value: facilityPtan }} />
          <Row label="Fax" value={facilityFax} labelW={80} />
        </View>

        {/* ── 4. PHYSICIAN INFORMATION ── */}
        <Text style={s.sectionHeader}>PHYSICIAN INFORMATION</Text>
        <View style={s.sectionBody}>
          <TwoRow left={{ label: "Physician Name", value: physicianName }} right={{ label: "Fax", value: physicianFax }} />
          <TwoRow left={{ label: "Address", value: physicianAddress }} right={{ label: "NPI", value: physicianNpi }} />
          <TwoRow left={{ label: "Phone", value: physicianPhone }} right={{ label: "TIN", value: physicianTin }} />
        </View>

        {/* ── 5. PATIENT INFORMATION ── */}
        <Text style={s.sectionHeader}>PATIENT INFORMATION</Text>
        <View style={s.sectionBody}>
          <TwoRow left={{ label: "Patient Name", value: patientName }} right={{ label: "Phone", value: patientPhone }} />
          <Row label="Address (City / State / Zip)" value={patientAddress} labelW={130} />
          <TwoRow left={{ label: "Date of Birth", value: fmtDate(ivr?.patient_dob) }} right={{ label: "", value: "" }} />
          <View style={s.fieldRow}>
            <Text style={s.fieldLabel}>OK to Contact:</Text>
            <View style={s.cbRow}>
              <CB checked={okToContact === true}  label="Yes" />
              <CB checked={okToContact === false} label="No"  />
            </View>
          </View>
        </View>

        {/* ── 6. INSURANCE INFORMATION ── */}
        <Text style={s.sectionHeader}>INSURANCE INFORMATION</Text>
        <View style={[s.sectionBody, { flexDirection: "row", gap: 12 }]}>
          {/* Primary */}
          <View style={{ flex: 1, borderRight: `0.5pt solid ${LINE}`, paddingRight: 8 }}>
            <Text style={s.subHeader}>Primary Insurance</Text>
            <Row label="Subscriber Name" value={subscriberName} labelW={90} />
            <Row label="Policy / Member ID" value={memberId} labelW={90} />
            <Row label="Subscriber DOB" value={fmtDate(subscriberDob)} labelW={90} />
            <View style={{ marginBottom: 4 }}>
              <Text style={[s.label, { marginBottom: 2 }]}>Type of Plan:</Text>
              <View style={s.cbRow}>
                <CBVal current={planType} value="HMO" label="HMO" />
                <CBVal current={planType} value="PPO" label="PPO" />
                <CBVal current={planType} value="Other" label="Other" />
              </View>
            </View>
            <Row label="Insurance Phone" value={insurancePhone} labelW={90} />
            <View>
              <Text style={[s.label, { marginBottom: 2 }]}>Provider Participates:</Text>
              <View style={s.cbRow}>
                <CBVal current={providerPrimary} value="Yes"      label="Yes" />
                <CBVal current={providerPrimary} value="No"       label="No" />
                <CBVal current={providerPrimary} value="Not Sure" label="Not Sure" />
              </View>
            </View>
          </View>

          {/* Secondary */}
          <View style={{ flex: 1 }}>
            <Text style={s.subHeader}>Secondary Insurance</Text>
            <Row label="Subscriber Name" value={secSubscriberName} labelW={90} />
            <Row label="Policy Number" value={secPolicyNumber} labelW={90} />
            <Row label="Subscriber DOB" value={fmtDate(secSubscriberDob)} labelW={90} />
            <View style={{ marginBottom: 4 }}>
              <Text style={[s.label, { marginBottom: 2 }]}>Type of Plan:</Text>
              <View style={s.cbRow}>
                <CBVal current={secPlanType} value="HMO" label="HMO" />
                <CBVal current={secPlanType} value="PPO" label="PPO" />
                <CBVal current={secPlanType} value="Other" label="Other" />
              </View>
            </View>
            <Row label="Insurance Phone" value={secInsurancePhone} labelW={90} />
            <View>
              <Text style={[s.label, { marginBottom: 2 }]}>Provider Participates:</Text>
              <View style={s.cbRow}>
                <CBVal current={providerSecondary} value="Yes"      label="Yes" />
                <CBVal current={providerSecondary} value="No"       label="No" />
                <CBVal current={providerSecondary} value="Not Sure" label="Not Sure" />
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
                <CBVal key={wt} current={woundType} value={wt} label={wt} />
              ))}
            </View>
            <View style={s.cbRow}>
              {WOUND_TYPES_ROW2.map((wt) => (
                <CBVal key={wt} current={woundType} value={wt} label={wt} />
              ))}
              <CB
                checked={woundTypeIsOther}
                label={woundTypeIsOther ? `Other: ${f(woundType)}` : "Other"}
              />
            </View>
          </View>
          <TwoRow left={{ label: "Wound Size(s)", value: woundSizes }} right={{ label: "Application CPT(s)", value: applicationCpts }} />
          <TwoRow left={{ label: "Date of Procedure", value: fmtDate(dateOfProcedure) }} right={{ label: "ICD-10 Diagnosis Code(s)", value: icd10Codes }} />
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
              <CB checked={isPatientAtSnf === true}  label="Yes" />
              <CB checked={isPatientAtSnf === false} label="No"  />
            </View>
          </View>
          <View style={[s.fieldRow, { alignItems: "center" }]}>
            <Text style={[s.fieldLabel, { width: 200 }]}>Patient under surgical Global Period?</Text>
            <View style={s.cbRow}>
              <CB checked={surgicalGlobal === true}  label="Yes" />
              <CB checked={surgicalGlobal === false} label="No"  />
            </View>
          </View>
          <Row label="CPT Code (if global period)" value={globalCpt} labelW={130} />
          <View style={[s.fieldRow, { alignItems: "center", marginTop: 2 }]}>
            <CB checked={priorAuthPerm === true} label="" />
            <Text style={{ fontSize: 7, color: BLACK, flex: 1, marginLeft: 4 }}>
              If Prior Authorization is Required, check here to allow us to work with payer on your behalf.
            </Text>
          </View>
          <Text style={{ fontSize: 7, color: GRAY, marginTop: 3, fontFamily: "Helvetica-Oblique" }}>
            Please attach a copy of the patient&apos;s clinical records.
          </Text>
          <Row label="Specialty Site Name (if different)" value={specialtySite} labelW={150} />
        </View>

        {/* ── 8b. CHRONIC-ONLY SUPPLEMENTAL SECTIONS ──
            Back-office detail that's not part of the post-surgical
            physician-facing template. Mirrors what's on screen for chronic. */}
        {!isPostSurgical && (
          <>
            {/* Insurance details — Primary & Secondary extended fields */}
            <Text style={s.sectionHeader}>INSURANCE DETAILS</Text>
            <View style={[s.sectionBody, { flexDirection: "row", gap: 12 }]}>
              <View style={{ flex: 1, borderRight: `0.5pt solid ${LINE}`, paddingRight: 8 }}>
                <Text style={s.subHeader}>Primary</Text>
                <Row label="Group Number"           value={groupNumber}            labelW={110} />
                <Row label="Plan Name"              value={planName}               labelW={110} />
                <Row label="Subscriber Relationship" value={subscriberRel}         labelW={130} />
                <Row label="Coverage Start"         value={fmtDate(coverageStart)} labelW={110} />
                <Row label="Coverage End"           value={fmtDate(coverageEnd)}   labelW={110} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.subHeader}>Secondary</Text>
                <Row label="Group Number"           value={secGroupNumber}     labelW={110} />
                <Row label="Subscriber Relationship" value={secSubscriberRel} labelW={130} />
              </View>
            </View>

            {/* Benefits & Coverage */}
            <Text style={s.sectionHeader}>BENEFITS & COVERAGE</Text>
            <View style={[s.sectionBody, { flexDirection: "row", flexWrap: "wrap", gap: 12 }]}>
              <View style={{ flex: 1, minWidth: 220 }}>
                <Row label="Deductible Amount" value={fmtMoney(deductibleAmount)} labelW={110} />
                <Row label="Deductible Met"    value={fmtMoney(deductibleMet)}    labelW={110} />
                <Row label="Out of Pocket Max" value={fmtMoney(outOfPocketMax)}   labelW={110} />
                <Row label="Out of Pocket Met" value={fmtMoney(outOfPocketMet)}   labelW={110} />
              </View>
              <View style={{ flex: 1, minWidth: 220 }}>
                <Row label="Copay Amount"  value={fmtMoney(copayAmount)}                                                    labelW={110} />
                <Row label="Coinsurance %" value={coinsurancePercent != null ? `${coinsurancePercent}%` : "—"} labelW={110} />
                <View style={[s.fieldRow, { alignItems: "center" }]}>
                  <Text style={[s.fieldLabel, { width: 110 }]}>DME Covered?</Text>
                  <View style={s.cbRow}>
                    <CB checked={dmeCovered === true}  label="Yes" />
                    <CB checked={dmeCovered === false} label="No"  />
                  </View>
                </View>
                <View style={[s.fieldRow, { alignItems: "center" }]}>
                  <Text style={[s.fieldLabel, { width: 110 }]}>Wound Care Covered?</Text>
                  <View style={s.cbRow}>
                    <CB checked={woundCareCovered === true}  label="Yes" />
                    <CB checked={woundCareCovered === false} label="No"  />
                  </View>
                </View>
              </View>
            </View>

            {/* Prior Authorization — detailed */}
            <Text style={s.sectionHeader}>PRIOR AUTHORIZATION</Text>
            <View style={s.sectionBody}>
              <View style={[s.fieldRow, { alignItems: "center" }]}>
                <Text style={[s.fieldLabel, { width: 150 }]}>Prior Auth Required?</Text>
                <View style={s.cbRow}>
                  <CB checked={priorAuthRequired === true}  label="Yes" />
                  <CB checked={priorAuthRequired === false} label="No"  />
                </View>
              </View>
              {priorAuthRequired === true && (
                <>
                  <Row label="Auth Number"      value={priorAuthNumber}                        labelW={110} />
                  <Row label="Units Authorized" value={unitsAuthorized != null ? String(unitsAuthorized) : "—"} labelW={110} />
                  <Row label="Auth Start Date"  value={fmtDate(priorAuthStart)}                labelW={110} />
                  <Row label="Auth End Date"    value={fmtDate(priorAuthEnd)}                  labelW={110} />
                </>
              )}
            </View>

            {/* Verification */}
            <Text style={s.sectionHeader}>VERIFICATION</Text>
            <View style={s.sectionBody}>
              <Row label="Verified By"      value={verifiedBy}         labelW={110} />
              <Row label="Verified Date"    value={fmtDate(verifiedDate)} labelW={110} />
              <Row label="Reference Number" value={verificationRef}    labelW={110} />
              {verificationNotes && verificationNotes !== "—" ? (
                <View style={{ marginTop: 2 }}>
                  <Text style={s.label}>Notes:</Text>
                  <Text style={{ fontSize: 7, color: BLACK, marginTop: 1 }}>{verificationNotes}</Text>
                </View>
              ) : null}
            </View>
          </>
        )}

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
              {physicianSig ? (
                <Text style={{ fontSize: 8, fontFamily: "Helvetica-Oblique", marginTop: 2 }}>
                  {String(physicianSig)}
                </Text>
              ) : null}
            </View>
            <View style={{ width: 140 }}>
              <View style={s.sigLine} />
              <Text style={[s.label, { marginTop: 2 }]}>Date</Text>
              {physicianSigDate ? (
                <Text style={{ fontSize: 8, marginTop: 2 }}>{String(physicianSigDate)}</Text>
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
