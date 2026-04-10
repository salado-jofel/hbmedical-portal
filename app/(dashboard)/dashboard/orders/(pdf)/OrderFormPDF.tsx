/** @jsxImportSource react */
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Path,
  Defs,
  LinearGradient,
  Stop,
} from "@react-pdf/renderer";

/* ── Palette ── */
const NAVY  = "#0f2d4a";
const TEAL  = "#0d7a6b";
const GRAY  = "#555555";
const BLACK = "#000000";
const LINE  = "#cccccc";

/* ── Styles ── */
const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 8.5,
    color: BLACK,
    paddingTop: 28,
    paddingBottom: 44,
    paddingHorizontal: 36,
    backgroundColor: "#fff",
  },
  /* header */
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
    paddingBottom: 4,
    borderBottom: `1.5pt solid ${NAVY}`,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandText: { flexDirection: "column" },
  brandName: { fontFamily: "Helvetica-Bold", fontSize: 14, color: NAVY, letterSpacing: 1 },
  brandSub: { fontFamily: "Helvetica-Bold", fontSize: 7, color: TEAL, letterSpacing: 0.5 },
  brandTagline: { fontSize: 6, color: TEAL, letterSpacing: 0.3, marginTop: 1 },
  addrBlock: { textAlign: "right", fontSize: 7, color: GRAY, lineHeight: 1.4 },
  docTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: NAVY,
    textAlign: "center",
    textDecoration: "underline",
    letterSpacing: 0.5,
    marginTop: 5,
    marginBottom: 5,
  },
  /* rows */
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 4,
    paddingBottom: 4,
    borderBottom: `0.5pt solid ${LINE}`,
  },
  rowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 4,
    paddingBottom: 4,
    borderBottom: `0.5pt solid ${LINE}`,
  },
  label: {
    fontSize: 6.5,
    color: GRAY,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginRight: 3,
  },
  uline: {
    borderBottom: `0.75pt solid #333`,
    minWidth: 40,
    paddingBottom: 1,
    marginRight: 8,
  },
  val: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: BLACK },
  /* checkbox */
  cbRow: { flexDirection: "row", alignItems: "center", marginRight: 8 },
  cbChar: { fontSize: 9, marginRight: 2, color: BLACK },
  cbLabel: { fontSize: 7.5, color: BLACK },
  /* notice */
  notice: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: BLACK,
    textAlign: "center",
    marginBottom: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: "#f5f5f5",
    borderBottom: `0.5pt solid ${LINE}`,
  },
  sectionLabel: {
    fontSize: 6,
    color: GRAY,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  textArea: {
    fontSize: 8,
    lineHeight: 1.4,
    borderBottom: `0.5pt solid #333`,
    minHeight: 20,
    paddingBottom: 2,
    color: BLACK,
  },
  /* table */
  tableHeader: {
    flexDirection: "row",
    borderBottom: `0.75pt solid #555`,
    paddingBottom: 2,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: `0.5pt solid ${LINE}`,
    paddingVertical: 2,
  },
  tableCell: { fontSize: 8, color: BLACK },
  /* signature */
  sigGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  sigBlock: { flex: 1, marginRight: 20 },
  sigLine: { borderBottom: `0.75pt solid #333`, marginTop: 16, marginBottom: 2 },
  /* footer */
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
    paddingTop: 3,
  },
});

/* ── Helpers ── */

const v = (val: unknown, fallback = "") =>
  val != null && val !== "" ? String(val) : fallback;

const chk = (val: boolean | null | undefined) => (val ? "☑" : "☐");
const chkVal = (current: unknown, option: string) => (current === option ? "☑" : "☐");
const chkArr = (arr: string[] | null | undefined, option: string) =>
  (arr ?? []).includes(option) ? "☑" : "☐";

/** Single checkbox item */
const CB = ({ checked, label }: { checked: boolean; label: string }) => (
  <View style={s.cbRow}>
    <Text style={s.cbChar}>{checked ? "☑" : "☐"}</Text>
    <Text style={s.cbLabel}>{label}</Text>
  </View>
);

/** Labeled underlined value field */
const UField = ({
  label,
  value,
  width = 80,
}: {
  label: string;
  value: string | null | undefined;
  width?: number;
}) => (
  <View style={{ flexDirection: "row", alignItems: "flex-end", marginRight: 12 }}>
    <Text style={s.label}>{label}: </Text>
    <View style={[s.uline, { width }]}>
      <Text style={s.val}>{v(value)}</Text>
    </View>
  </View>
);

/** Yes / No pair */
const YN = ({ label, value }: { label: string; value: boolean | null | undefined }) => (
  <View style={{ flexDirection: "row", alignItems: "center", marginRight: 14 }}>
    <Text style={[s.label, { marginRight: 4 }]}>{label}</Text>
    <View style={s.cbRow}>
      <Text style={s.cbChar}>{value === true ? "☑" : "☐"}</Text>
      <Text style={s.cbLabel}>YES</Text>
    </View>
    <View style={s.cbRow}>
      <Text style={s.cbChar}>{value === false ? "☑" : "☐"}</Text>
      <Text style={s.cbLabel}>NO</Text>
    </View>
  </View>
);

/** HBLogo SVG rendered via react-pdf primitives */
const LogoSVG = () => (
  <Svg viewBox="0 0 56 56" width={36} height={36}>
    <Defs>
      <LinearGradient id="hbArcGrad" x1="0%" y1="100%" x2="100%" y2="0%">
        <Stop offset="0%" stopColor="#f5a87a" />
        <Stop offset="100%" stopColor="#e85d0a" />
      </LinearGradient>
    </Defs>
    {/* Orange arc */}
    <Path
      d="M 14 44 A 22 22 0 1 1 46 36"
      stroke="url(#hbArcGrad)"
      strokeWidth={2.8}
      strokeLinecap="round"
      fill="none"
    />
    {/* Left tall mountain peak */}
    <Path
      d="M 10 44 L 24 13 L 38 44"
      stroke={NAVY}
      strokeWidth={2.4}
      strokeLinejoin="round"
      strokeLinecap="round"
      fill="none"
    />
    {/* Right shorter mountain peak */}
    <Path
      d="M 22 44 L 32 25 L 42 44"
      stroke={NAVY}
      strokeWidth={2.4}
      strokeLinejoin="round"
      strokeLinecap="round"
      fill="none"
    />
  </Svg>
);

/* ── Component ── */

export function OrderFormPDF({
  order,
  form,
}: {
  order: Record<string, unknown>;
  form: Record<string, unknown> | null;
}) {
  const items = (order.order_items as Record<string, unknown>[] | null) ?? [];
  const symptoms: string[] = Array.isArray(form?.subjective_symptoms)
    ? (form!.subjective_symptoms as string[])
    : [];

  // Patient fields: form-stored values take priority over order relations
  const patientFromOrder = (() => {
    const p = order.patient as Record<string, unknown> | null | undefined;
    return p ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() : "";
  })();
  const patientNameVal = v(form?.patient_name) || patientFromOrder || "—";
  const patientDateVal  = v(form?.patient_date) || v(order.date_of_service);
  const physSig         = v(form?.physician_signature);
  const physSigDate     = v(form?.physician_signature_date);

  // Wound type: map order.wound_type to on-screen checkbox options
  // (screen shows: DFU, Pressure, Venous, Other — no Chronic/Post-Surgical)
  const woundType = v(order.wound_type);
  const isKnownWoundType = ["diabetic_foot_ulcer", "pressure_ulcer", "venous_leg_ulcer"].includes(woundType);
  const isOtherWoundType = !isKnownWoundType && woundType !== "";

  const followupDays = form?.followup_days != null ? Number(form.followup_days) : null;
  const followupWeeks =
    followupDays != null ? Math.round((followupDays / 7) * 10) / 10 : null;

  const grandTotal = items.reduce(
    (sum, i) => sum + Number(i.unit_price ?? 0) * Number(i.quantity ?? 1),
    0,
  );

  return (
    <Document>
      <Page size="LETTER" wrap style={s.page}>

        {/* ── Header ── */}
        <View style={s.headerRow}>
          <View style={s.brandRow}>
            <LogoSVG />
            <View style={s.brandText}>
              <Text style={s.brandName}>MERIDIAN</Text>
              <Text style={s.brandSub}>SURGICAL SUPPLIES</Text>
              <Text style={s.brandTagline}>EMPOWERING PATIENTS FROM THEIR HOME</Text>
            </View>
          </View>
          <View style={s.addrBlock}>
            <Text>235 Singleton Ridge Road Suite 105</Text>
            <Text>Conway, SC 29526</Text>
            <Text>Support@meridiansurgicalsupplies.com</Text>
            <Text>www.meridiansurgicalsupplies.com</Text>
            <Text>(843) 733-9261</Text>
          </View>
        </View>

        <Text style={s.docTitle}>Physicians Order Recommendation</Text>

        {/* ── Patient / Date / Visit # ── */}
        <View style={s.row}>
          <UField label="Patient Name" value={patientNameVal} width={120} />
          <UField label="Date" value={patientDateVal} width={64} />
          <UField label="Wound Visit #" value={v(form?.wound_visit_number)} width={30} />
        </View>

        {/* ── Medicare notice ── */}
        <Text style={s.notice}>
          MEDICARE PT CANNOT BE CURRENTLY RECEIVING HOMECARE (PT, OT, HHA, NURSING)
        </Text>

        {/* ── Chief Complaint + ICD-10 ── */}
        <View style={s.row}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={s.label}>Chief Complaint</Text>
            <View style={[s.uline, { width: "100%" }]}>
              <Text style={s.val}>{v(form?.chief_complaint)}</Text>
            </View>
          </View>
          <UField label="ICD-10" value={v(form?.icd10_code)} width={60} />
        </View>

        {/* ── Surgical Dressing + Symptoms ── */}
        <View style={s.rowWrap}>
          <Text style={[s.label, { marginRight: 4 }]}>Surgical Dressing:</Text>
          {/* Not persisted — always unchecked, matching screen behavior */}
          <CB checked={false} label="Primary" />
          <CB checked={false} label="Secondary" />
          <View style={{ width: 1, backgroundColor: LINE, height: 10, marginHorizontal: 8 }} />
          <Text style={[s.label, { marginRight: 4 }]}>Other Subjective Symptoms:</Text>
          {["Pain", "Numbness", "Fever", "Chills", "Nausea"].map((sym) => (
            <CB key={sym} checked={symptoms.includes(sym)} label={sym} />
          ))}
        </View>

        {/* ── Blood Thinners ── */}
        <View style={s.rowWrap}>
          <Text style={[s.label, { marginRight: 4 }]}>
            Use of Blood Thinners: IE ASA, Plavix, Coumadin, Eliquis, Xarelto, Pradaxa etc.
          </Text>
          <CB checked={!!form?.use_blood_thinners} label="Yes" />
          {form?.use_blood_thinners && form?.blood_thinner_details ? (
            <View style={{ flexDirection: "row", alignItems: "flex-end", marginLeft: 4 }}>
              <Text style={s.label}>Details: </Text>
              <View style={[s.uline, { width: 110 }]}>
                <Text style={s.val}>{v(form.blood_thinner_details)}</Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* ── Medical Conditions ── */}
        <View style={s.rowWrap}>
          <Text style={[s.label, { width: "100%", marginBottom: 2 }]}>
            Combined Medical and Mental Health Conditions:
          </Text>
          <CB checked={!!form?.condition_decreased_mobility} label="Decreased Mobility" />
          <CB checked={!!form?.condition_diabetes} label="Diabetes" />
          <CB checked={!!form?.condition_infection} label="Infection" />
          <CB checked={!!form?.condition_cvd} label="CVD" />
          <CB checked={!!form?.condition_copd} label="COPD" />
          <CB checked={!!form?.condition_chf} label="CHF" />
          <CB checked={!!form?.condition_anemia} label="Anemia" />
        </View>

        {/* ── Wound Type ── */}
        {/* Matches on-screen: DFU / Pressure / Venous / Other (no Chronic/Post-Surgical separate) */}
        <View style={s.rowWrap}>
          <Text style={[s.label, { marginRight: 4 }]}>Type of Wound:</Text>
          <CB checked={woundType === "diabetic_foot_ulcer"} label="Diabetic Foot Ulcers" />
          <CB checked={woundType === "pressure_ulcer"} label="Pressure Ulcers" />
          <CB checked={woundType === "venous_leg_ulcer"} label="Venous Leg Ulcer" />
          <CB checked={isOtherWoundType} label="Other" />
          {isOtherWoundType ? (
            <View style={[s.uline, { width: 70, marginLeft: 2 }]}>
              <Text style={s.val}>
                {woundType === "chronic" ? "Chronic" : woundType === "post_surgical" ? "Post-Surgical" : woundType}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ── Location + Granulation ── */}
        <View style={s.row}>
          <UField label="Location" value={v(form?.wound_site)} width={100} />
          <CB checked={form?.wound_location_side === "RT"} label="RT" />
          <CB checked={form?.wound_location_side === "LT"} label="LT" />
          <View style={{ flex: 1 }} />
          <Text style={s.label}>Percentage Granulation Tissue: </Text>
          <View style={[s.uline, { width: 30 }]}>
            <Text style={s.val}>
              {form?.granulation_tissue_pct != null ? `${form.granulation_tissue_pct}%` : ""}
            </Text>
          </View>
        </View>

        {/* ── Wound Measurements (left) + Burns/Vasculitis/Charcot + Exudate (right) ── */}
        <View style={{ flexDirection: "row", marginBottom: 4, paddingBottom: 4, borderBottom: `0.5pt solid ${LINE}` }}>
          {/* Left column: measurements + yes/no questions */}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: 3 }}>
              <Text style={[s.label, { marginRight: 4 }]}>Wound 1:</Text>
              <UField label="L" value={v(form?.wound_length_cm)} width={22} />
              <Text style={{ fontSize: 8, marginRight: 4 }}>cc (length) ×</Text>
              <UField label="W" value={v(form?.wound_width_cm)} width={22} />
              <Text style={{ fontSize: 8, marginRight: 4 }}>cm (width) ×</Text>
              <UField label="D" value={v(form?.wound_depth_cm)} width={22} />
              <Text style={{ fontSize: 8 }}>cm (depth)</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: 4 }}>
              <Text style={[s.label, { marginRight: 4 }]}>Wound 2:</Text>
              <UField label="L" value={v(form?.wound2_length_cm)} width={22} />
              <Text style={{ fontSize: 8, marginRight: 4 }}>cc (length) ×</Text>
              <UField label="W" value={v(form?.wound2_width_cm)} width={22} />
              <Text style={{ fontSize: 8, marginRight: 4 }}>cm (width) ×</Text>
              <UField label="D" value={v(form?.wound2_depth_cm)} width={22} />
              <Text style={{ fontSize: 8 }}>cm (depth)</Text>
            </View>
            {/* Burns / Vasculitis / Charcot */}
            <View style={{ borderTop: `0.5pt solid ${LINE}`, paddingTop: 4 }}>
              <YN label="Third degree burns?" value={form?.third_degree_burns as boolean} />
              <View style={{ marginTop: 3 }}>
                <YN label="Active Vasculitis?" value={form?.active_vasculitis as boolean} />
              </View>
              <View style={{ marginTop: 3 }}>
                <YN label="Active Charcot Arthropathy?" value={form?.active_charcot as boolean} />
              </View>
            </View>
          </View>

          {/* Right column: Exudate */}
          <View style={{ width: 128, borderLeft: `0.5pt solid ${LINE}`, paddingLeft: 8 }}>
            <Text style={[s.sectionLabel, { marginBottom: 3 }]}>Wound Exudate Amount</Text>
            <CB checked={form?.exudate_amount === "none"} label="None / Scant" />
            <View style={{ marginTop: 3 }}>
              <CB checked={form?.exudate_amount === "minimal"} label="Minimal / Light" />
            </View>
            <View style={{ marginTop: 3 }}>
              <CB checked={form?.exudate_amount === "moderate"} label="Moderate" />
            </View>
            <View style={{ marginTop: 3 }}>
              <CB checked={form?.exudate_amount === "heavy"} label="Heavy" />
            </View>
          </View>
        </View>

        {/* ── Skin Condition ── */}
        <View style={s.rowWrap}>
          <Text style={[s.label, { marginRight: 4 }]}>Skin Condition:</Text>
          <CB checked={form?.skin_condition === "normal"} label="Normal" />
          <CB checked={form?.skin_condition === "thin"} label="Thin" />
          <CB checked={form?.skin_condition === "atrophic"} label="Atrophic" />
          <CB checked={form?.skin_condition === "stasis"} label="Stasis Wound / Venous" />
          <CB checked={form?.skin_condition === "ischemic"} label="Ischemic" />
        </View>

        {/* ── Wound Stage / Classification ── */}
        <View style={{ marginBottom: 4, paddingBottom: 4, borderBottom: `0.5pt solid ${LINE}` }}>
          <Text style={s.sectionLabel}>
            Wound Stage / Grade / Classification{" "}
            <Text style={{ fontSize: 6, color: GRAY, fontFamily: "Helvetica" }}>
              (stage for PUs, Wagner grade for DFUs, CEAP Classification for VLUs)
            </Text>
          </Text>
          <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
            <Text style={[s.label, { marginRight: 4 }]}>Description: </Text>
            <View style={[s.uline, { flex: 1 }]}>
              <Text style={s.val}>{v(form?.wound_stage)}</Text>
            </View>
          </View>
        </View>

        {/* ── Drainage ── */}
        <View style={{ marginBottom: 4, paddingBottom: 4, borderBottom: `0.5pt solid ${LINE}` }}>
          <Text style={s.sectionLabel}>Drainage</Text>
          <Text style={s.textArea}>{v(form?.drainage_description)}</Text>
        </View>

        {/* ── Treatment Plan ── */}
        <View style={{ marginBottom: 4, paddingBottom: 4, borderBottom: `0.5pt solid ${LINE}` }}>
          <Text style={s.sectionLabel}>Treatment Plan to Include Frequency of Dressing Changes</Text>
          <Text style={{ fontSize: 7, color: GRAY, marginBottom: 2, fontFamily: "Helvetica-Oblique" }}>
            All materials and supplies were dispensed per the patient&apos;s needs. Home instructions were reviewed and all questions were answered in detail.
          </Text>
          <Text style={s.textArea}>{v(form?.treatment_plan)}</Text>
        </View>

        {/* ── Clinical Notes ── */}
        <View style={{ marginBottom: 4, paddingBottom: 4, borderBottom: `0.5pt solid ${LINE}` }}>
          <Text style={s.sectionLabel}>Clinical Notes</Text>
          <Text style={s.textArea}>{v(form?.clinical_notes)}</Text>
        </View>

        {/* ── Anticipated Length of Need ── */}
        <View style={s.rowWrap}>
          <Text style={[s.label, { marginRight: 4 }]}>Anticipated Length of Need: </Text>
          <View style={[s.uline, { width: 28 }]}>
            <Text style={s.val}>{followupDays ?? ""}</Text>
          </View>
          <Text style={{ fontSize: 8, marginRight: 10 }}> Days</Text>
          {[15, 21, 30].map((d) => (
            <CB key={d} checked={followupDays === d} label={`${d} days`} />
          ))}
        </View>

        {/* ── Product Dispensed table ── */}
        <View style={{ marginBottom: 4, paddingBottom: 4, borderBottom: `0.5pt solid ${LINE}` }}>
          <Text style={[s.sectionLabel, { marginBottom: 3 }]}>Product Dispensed</Text>
          <Text style={{ fontSize: 7, color: GRAY, marginBottom: 3, fontFamily: "Helvetica-Oblique" }}>
            (Please see attached prescription and patient acknowledgement of receipt)
          </Text>
          {items.length > 0 ? (
            <>
              <View style={s.tableHeader}>
                <Text style={[s.tableCell, { width: 60, fontFamily: "Helvetica-Bold", fontSize: 7 }]}>SKU</Text>
                <Text style={[s.tableCell, { flex: 1, fontFamily: "Helvetica-Bold", fontSize: 7 }]}>Product</Text>
                <Text style={[s.tableCell, { width: 24, fontFamily: "Helvetica-Bold", fontSize: 7, textAlign: "center" }]}>Qty</Text>
                <Text style={[s.tableCell, { width: 54, fontFamily: "Helvetica-Bold", fontSize: 7, textAlign: "right" }]}>Unit Price</Text>
                <Text style={[s.tableCell, { width: 54, fontFamily: "Helvetica-Bold", fontSize: 7, textAlign: "right" }]}>Total</Text>
              </View>
              {items.map((item, idx) => {
                const unitPrice = Number(item.unit_price ?? 0);
                const qty = Number(item.quantity ?? 1);
                return (
                  <View key={idx} style={s.tableRow}>
                    <Text style={[s.tableCell, { width: 60, fontSize: 7.5, color: GRAY, fontFamily: "Courier" }]}>{v(item.product_sku)}</Text>
                    <Text style={[s.tableCell, { flex: 1 }]}>{v(item.product_name)}</Text>
                    <Text style={[s.tableCell, { width: 24, textAlign: "center" }]}>{qty}</Text>
                    <Text style={[s.tableCell, { width: 54, textAlign: "right", fontFamily: "Courier" }]}>${unitPrice.toFixed(2)}</Text>
                    <Text style={[s.tableCell, { width: 54, textAlign: "right", fontFamily: "Helvetica-Bold" }]}>${(unitPrice * qty).toFixed(2)}</Text>
                  </View>
                );
              })}
              <View style={{ flexDirection: "row", borderTop: `1pt solid #333`, paddingTop: 3, marginTop: 2 }}>
                <Text style={[s.tableCell, { flex: 1, fontFamily: "Helvetica-Bold", fontSize: 7.5, textAlign: "right", paddingRight: 4 }]}>
                  Grand Total:
                </Text>
                <Text style={[s.tableCell, { width: 54, fontFamily: "Helvetica-Bold", fontSize: 9, textAlign: "right" }]}>
                  ${grandTotal.toFixed(2)}
                </Text>
              </View>
              <Text style={{ fontSize: 6.5, color: GRAY, marginTop: 2 }}>
                {items.length} item(s) · {items.reduce((sum, i) => sum + Number(i.quantity ?? 1), 0)} unit(s)
              </Text>
            </>
          ) : (
            <Text style={{ fontSize: 7.5, color: GRAY, fontFamily: "Helvetica-Oblique" }}>No products added.</Text>
          )}
        </View>

        {/* ── Follow Up ── */}
        <View style={s.row}>
          <Text style={[s.label, { marginRight: 4 }]}>Follow Up: </Text>
          <View style={[s.uline, { width: 28 }]}>
            <Text style={s.val}>{followupDays ?? ""}</Text>
          </View>
          <Text style={{ fontSize: 8, marginRight: 12 }}> days</Text>
          <View style={[s.uline, { width: 28 }]}>
            <Text style={s.val}>{followupWeeks ?? ""}</Text>
          </View>
          <Text style={{ fontSize: 8 }}> weeks</Text>
        </View>

        {/* ── Signature (2×2 grid matching on-screen layout) ── */}
        {/* Row 1: Physician Sig | Date */}
        <View style={s.sigGrid}>
          <View style={s.sigBlock}>
            <Text style={s.label}>Physicians Signature</Text>
            <View style={s.sigLine} />
            <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold" }}>{physSig}</Text>
            <Text style={{ fontSize: 6, color: GRAY, marginTop: 1 }}>Authorized Provider Signature</Text>
          </View>
          <View style={{ width: 110 }}>
            <Text style={s.label}>Date</Text>
            <View style={s.sigLine} />
            <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold" }}>{physSigDate}</Text>
          </View>
        </View>
        {/* Row 2: Patient Name | Date */}
        <View style={[s.sigGrid, { marginTop: 6 }]}>
          <View style={s.sigBlock}>
            <Text style={s.label}>Patient Name</Text>
            <View style={s.sigLine} />
            <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold" }}>{patientNameVal}</Text>
          </View>
          <View style={{ width: 110 }}>
            <Text style={s.label}>Date</Text>
            <View style={s.sigLine} />
            <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold" }}>{patientDateVal}</Text>
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={s.footer} fixed>
          <Text>Meridian Surgical Supplies — Physicians Order Recommendation</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

      </Page>
    </Document>
  );
}
