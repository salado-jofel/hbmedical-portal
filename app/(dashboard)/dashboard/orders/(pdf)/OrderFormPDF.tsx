/** @jsxImportSource react */
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import { PDFHeader } from "./PDFHeader";
import { CB, CBVal, CBArr } from "./PDFComponents";

/* ── Palette ── */
const NAVY  = "#0f2d4a";
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
  section: {
    marginBottom: 4,
    paddingBottom: 4,
    borderBottom: `0.5pt solid ${LINE}`,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
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
  },
  uline: {
    borderBottom: `0.75pt solid #333`,
    minWidth: 40,
    paddingBottom: 1,
    marginRight: 8,
  },
  val: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: BLACK },
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
  sigGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  sigBlock: { flex: 1, marginRight: 20 },
  sigLine: { borderBottom: `0.75pt solid #333`, marginTop: 16, marginBottom: 2 },
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

/* ── Value helper (non-checkbox fields) ── */
const v = (val: unknown, fallback = "") =>
  val != null && val !== "" ? String(val) : fallback;

/* ── Labeled underlined field ── */
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
      <Text style={s.val}>{value ?? ""}</Text>
    </View>
  </View>
);

/* ── cbRow — wrapping flex row for a group of CB components + optional label ── */
const cbRowStyle = { flexDirection: "row" as const, alignItems: "center" as const, flexWrap: "wrap" as const, marginTop: 2 };

/* ── Component ── */

export function OrderFormPDF({
  order,
  form,
  signatureImage,
}: {
  order: Record<string, unknown>;
  form: Record<string, unknown> | null;
  /** PNG data URL. Rendered at the signature spot when present. */
  signatureImage?: string;
}) {
  const items = (order.order_items as Record<string, unknown>[] | null) ?? [];

  /* Patient */
  const patientFromOrder = (() => {
    const p = order.patient as Record<string, unknown> | null | undefined;
    return p ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() : "";
  })();
  const patientNameVal = v(form?.patient_name) || patientFromOrder || "—";
  const patientDateVal = v(form?.patient_date) || v(order.date_of_service);
  const physSig        = v(form?.physician_signature);
  const physSigDate    = v(form?.physician_signature_date);

  /* Wound type — `woundType` powers the "Type of Wound" row (subtype the
     provider picks in the form). `isPostSurgical` switches the PDF template
     variant and binds to order.wound_type instead, which is stable across
     subtype edits in the form. */
  const woundType = v(form?.wound_type) || v(order.wound_type);
  const isPostSurgical = v(order.wound_type) === "post_surgical";

  /* Anticipated length & follow-up */
  const ald = form?.anticipated_length_days != null
    ? Number(form.anticipated_length_days)
    : null;
  const followupDays = form?.followup_days != null ? Number(form.followup_days) : null;
  const followupWeeks = form?.followup_weeks != null
    ? Number(form.followup_weeks)
    : (followupDays != null ? Math.round((followupDays / 7) * 10) / 10 : null);

  const grandTotal = items.reduce(
    (sum, i) => sum + Number(i.unit_price ?? 0) * Number(i.quantity ?? 1),
    0,
  );

  return (
    <Document>
      <Page size="LETTER" wrap style={s.page}>

        {/* ── Header ── */}
        <PDFHeader title="Physicians Order Recommendation" />

        {/* ── Patient / Date / Visit # ── */}
        <View style={s.row}>
          <UField label="Patient Name" value={patientNameVal} width={120} />
          <UField label="Date" value={patientDateVal} width={64} />
          <UField label="Wound Visit #" value={v(form?.wound_visit_number)} width={30} />
        </View>

        {/* ── Fortify: Patient identifiers (MRN / MBI / Insurance) ── */}
        <View style={s.row}>
          <UField label="MRN" value={v(form?.patient_mrn)} width={70} />
          <UField label="Medicare ID (MBI)" value={v(form?.patient_mbi)} width={90} />
          <UField label="Insurance" value={v(form?.insurance_type_label)} width={120} />
        </View>

        {/* ── Fortify: Anticipated DOS ── */}
        <View style={s.row}>
          <UField label="Anticipated DOS Start" value={v(form?.anticipated_dos_start)} width={70} />
          <UField label="Anticipated DOS End" value={v(form?.anticipated_dos_end)} width={70} />
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

        {/* ── Surgical Dressing + Subjective Symptoms ── */}
        <View style={s.section}>
          <View style={cbRowStyle}>
            <Text style={[s.label, { marginRight: 6 }]}>Surgical Dressing:</Text>
            <CBVal current={form?.surgical_dressing_type} value="primary" label="Primary" />
            <CBVal current={form?.surgical_dressing_type} value="secondary" label="Secondary" />
          </View>
          <View style={[cbRowStyle, { marginTop: 4 }]}>
            <Text style={[s.label, { marginRight: 6 }]}>Other Subjective Symptoms:</Text>
            <CBArr arr={form?.subjective_symptoms} value="pain" label="Pain" />
            <CBArr arr={form?.subjective_symptoms} value="numbness" label="Numbness" />
            <CBArr arr={form?.subjective_symptoms} value="fever" label="Fever" />
            <CBArr arr={form?.subjective_symptoms} value="chills" label="Chills" />
            <CBArr arr={form?.subjective_symptoms} value="nausea" label="Nausea" />
          </View>
        </View>

        {/* ── Blood Thinners ── */}
        <View style={s.section}>
          <View style={cbRowStyle}>
            <Text style={[s.label, { marginRight: 6 }]}>
              Use of Blood Thinners: IE ASA, Plavix, Coumadin, Eliquis, Xarelto, Pradaxa etc.:
            </Text>
            <CB checked={form?.use_blood_thinners === true} label="Yes" />
            <CB checked={form?.use_blood_thinners !== true} label="No" />
          </View>
          {!isPostSurgical && form?.use_blood_thinners === true && form?.blood_thinner_details ? (
            <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: 2 }}>
              <Text style={s.label}>Details: </Text>
              <View style={[s.uline, { width: 200 }]}>
                <Text style={s.val}>{v(form.blood_thinner_details)}</Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* ── Medical Conditions ── */}
        <View style={s.section}>
          <Text style={s.label}>Combined Medical and Mental Health Conditions:</Text>
          <View style={[cbRowStyle, { marginTop: 3 }]}>
            <CB checked={form?.condition_decreased_mobility === true} label="Decreased Mobility" />
            <CB checked={form?.condition_diabetes === true} label="Diabetes" />
            <CB checked={form?.condition_infection === true} label="Infection" />
            <CB checked={form?.condition_cvd === true} label="CVD" />
            <CB checked={form?.condition_copd === true} label="COPD" />
            <CB checked={form?.condition_chf === true} label="CHF" />
            <CB checked={form?.condition_anemia === true} label="Anemia" />
            {/* ── Fortify: extended comorbidities ── */}
            <CB checked={form?.condition_pad === true} label="PAD / Vasc Insuff" />
            <CB checked={form?.condition_venous_insufficiency === true} label="Venous Insuff" />
            <CB checked={form?.condition_neuropathy === true} label="Neuropathy" />
            <CB checked={form?.condition_immunosuppression === true} label="Immunosuppression" />
            <CB checked={form?.condition_malnutrition === true} label="Malnutrition" />
            <CB checked={form?.condition_smoking === true} label="Active Smoker" />
            <CB checked={form?.condition_renal_disease === true} label="Renal Disease" />
          </View>
          {/* ── Fortify: conditional labs ── */}
          {(form?.condition_diabetes === true ||
            form?.condition_pad === true ||
            form?.condition_immunosuppression === true ||
            form?.condition_malnutrition === true ||
            form?.condition_renal_disease === true) && (
            <View style={[cbRowStyle, { marginTop: 4 }]}>
              {form?.condition_diabetes === true && (
                <>
                  <UField label="A1C" value={v(form?.a1c_value)} width={28} />
                  <UField label="A1C Date" value={v(form?.a1c_date)} width={60} />
                </>
              )}
              {form?.condition_pad === true && (
                <UField label="PAD details" value={v(form?.pad_details)} width={120} />
              )}
              {form?.condition_immunosuppression === true && (
                <UField label="Immunosup." value={v(form?.immunosuppression_details)} width={120} />
              )}
              {form?.condition_malnutrition === true && (
                <UField label="Albumin" value={v(form?.albumin_value)} width={28} />
              )}
              {form?.condition_renal_disease === true && (
                <UField label="eGFR" value={v(form?.egfr_value)} width={28} />
              )}
            </View>
          )}
          {form?.condition_other ? (
            <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: 3 }}>
              <Text style={s.label}>Other Conditions: </Text>
              <View style={[s.uline, { flex: 1 }]}>
                <Text style={s.val}>{v(form?.condition_other)}</Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* ── Wound Type ── */}
        <View style={s.section}>
          <View style={cbRowStyle}>
            <Text style={[s.label, { marginRight: 6 }]}>Type of Wound:</Text>
            <CBVal current={woundType} value="diabetic_foot_ulcer" label="Diabetic Foot Ulcers" />
            <CBVal current={woundType} value="pressure_ulcer" label="Pressure Ulcers" />
            <CBVal current={woundType} value="venous_leg_ulcer" label="Venous Leg Ulcer" />
            <CBVal current={woundType} value="chronic" label="Chronic" />
            <CBVal current={woundType} value="post_surgical" label="Post-Surgical" />
            <CBVal current={woundType} value="other" label="Other" />
          </View>
        </View>

        {/* ── Fortify: Wound Etiology breakdown ── */}
        <View style={s.section}>
          <Text style={s.label}>Wound Etiology (check all that apply):</Text>
          <View style={[cbRowStyle, { marginTop: 3 }]}>
            <CB checked={form?.etiology_dfu === true} label="Diabetic foot ulcer" />
            <CB checked={form?.etiology_venous_stasis === true} label="Venous / stasis" />
            <CB checked={form?.etiology_pressure_ulcer === true} label="Pressure ulcer" />
            {form?.etiology_pressure_ulcer === true && form?.pressure_ulcer_stage ? (
              <Text style={{ fontSize: 7.5, marginLeft: 2, marginRight: 6 }}>
                (Stage: {String(form.pressure_ulcer_stage)})
              </Text>
            ) : null}
            <CB checked={form?.etiology_arterial === true} label="Arterial" />
            <CB checked={form?.etiology_surgical === true} label="Surgical" />
            <CB checked={form?.etiology_traumatic === true} label="Traumatic" />
          </View>
          {form?.etiology_other ? (
            <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: 2 }}>
              <Text style={s.label}>Other etiology: </Text>
              <View style={[s.uline, { flex: 1 }]}>
                <Text style={s.val}>{v(form?.etiology_other)}</Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* ── Fortify: Wound onset / duration ── */}
        {form?.wound_onset_date || form?.wound_duration_text ? (
          <View style={s.row}>
            <UField label="Wound Onset" value={v(form?.wound_onset_date)} width={70} />
            <UField label="Duration" value={v(form?.wound_duration_text)} width={100} />
          </View>
        ) : null}

        {/* ── Location + Granulation ── */}
        <View style={s.section}>
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
            <UField label="Location" value={v(form?.wound_site)} width={110} />
            <CBVal current={form?.wound_location_side} value="RT" label="RT" />
            <CBVal current={form?.wound_location_side} value="LT" label="LT" />
            <CBVal current={form?.wound_location_side} value="bilateral" label="Bilateral" />
            <View style={{ flex: 1 }} />
            <Text style={[s.label, { marginRight: 4 }]}>% Granulation Tissue:</Text>
            <View style={[s.uline, { width: 30 }]}>
              <Text style={s.val}>
                {form?.granulation_tissue_pct != null ? `${form.granulation_tissue_pct}%` : ""}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Wound Measurements (left) + Exudate (right) ── */}
        <View style={{ flexDirection: "row", marginBottom: 4, paddingBottom: 4, borderBottom: `0.5pt solid ${LINE}` }}>

          {/* Left: measurements + Burns/Vasculitis/Charcot */}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: 3 }}>
              <Text style={[s.label, { marginRight: 4 }]}>Wound 1:</Text>
              <UField label="L" value={v(form?.wound_length_cm)} width={22} />
              <Text style={{ fontSize: 8, marginRight: 4 }}>cm (length) ×</Text>
              <UField label="W" value={v(form?.wound_width_cm)} width={22} />
              <Text style={{ fontSize: 8, marginRight: 4 }}>cm (width) ×</Text>
              <UField label="D" value={v(form?.wound_depth_cm)} width={22} />
              <Text style={{ fontSize: 8 }}>cm (depth)</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: 6 }}>
              <Text style={[s.label, { marginRight: 4 }]}>Wound 2:</Text>
              <UField label="L" value={v(form?.wound2_length_cm)} width={22} />
              <Text style={{ fontSize: 8, marginRight: 4 }}>cm (length) ×</Text>
              <UField label="W" value={v(form?.wound2_width_cm)} width={22} />
              <Text style={{ fontSize: 8, marginRight: 4 }}>cm (width) ×</Text>
              <UField label="D" value={v(form?.wound2_depth_cm)} width={22} />
              <Text style={{ fontSize: 8 }}>cm (depth)</Text>
            </View>

            {/* Burns / Vasculitis / Charcot */}
            <View style={{ borderTop: `0.5pt solid ${LINE}`, paddingTop: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
                <Text style={[s.label, { marginRight: 6 }]}>Third Degree Burns?</Text>
                <CB checked={form?.third_degree_burns === true} label="YES" />
                <CB checked={form?.third_degree_burns !== true} label="NO" />
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
                <Text style={[s.label, { marginRight: 6 }]}>Active Vasculitis?</Text>
                <CB checked={form?.active_vasculitis === true} label="YES" />
                <CB checked={form?.active_vasculitis !== true} label="NO" />
              </View>
              {!isPostSurgical && (
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={[s.label, { marginRight: 6 }]}>Active Charcot Arthropathy?</Text>
                  <CB checked={form?.active_charcot === true} label="YES" />
                  <CB checked={form?.active_charcot !== true} label="NO" />
                </View>
              )}
            </View>
          </View>

          {/* Right: Exudate — labels + options vary by variant */}
          <View style={{ width: 128, borderLeft: `0.5pt solid ${LINE}`, paddingLeft: 8 }}>
            <Text style={s.sectionLabel}>
              {isPostSurgical ? "Surgical Site Exudate Amount" : "Wound Exudate Amount"}
            </Text>
            <CBVal current={form?.exudate_amount} value="none"     label="None / Scant" />
            <CBVal current={form?.exudate_amount} value="minimal"  label="Minimal / Light" />
            {!isPostSurgical && (
              <>
                <CBVal current={form?.exudate_amount} value="moderate" label="Moderate" />
                <CBVal current={form?.exudate_amount} value="heavy"    label="Heavy" />
              </>
            )}
          </View>
        </View>

        {/* ── Fortify: Wound bed composition + pain + photo ── */}
        <View style={s.section}>
          <View style={[cbRowStyle]}>
            <Text style={[s.label, { marginRight: 4 }]}>Wound Bed:</Text>
            <UField label="Slough %" value={v(form?.wound_bed_slough_pct)} width={28} />
            <UField label="Eschar %" value={v(form?.wound_bed_eschar_pct)} width={28} />
            <Text style={[s.label, { marginRight: 4 }]}>Pain (0-10):</Text>
            <View style={[s.uline, { width: 22 }]}>
              <Text style={s.val}>{v(form?.pain_level)}</Text>
            </View>
            <View style={{ width: 8 }} />
            <CB checked={form?.wound_photo_taken === true} label="Photo on file" />
          </View>
          {form?.condition_infection === true && form?.infection_signs_describe ? (
            <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: 3 }}>
              <Text style={s.label}>Infection signs: </Text>
              <View style={[s.uline, { flex: 1 }]}>
                <Text style={s.val}>{v(form?.infection_signs_describe)}</Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* ── Skin Condition ── */}
        <View style={s.section}>
          <View style={cbRowStyle}>
            <Text style={[s.label, { marginRight: 6 }]}>Skin Condition:</Text>
            <CBVal current={form?.skin_condition} value="normal"   label="Normal" />
            <CBVal current={form?.skin_condition} value="thin"     label="Thin" />
            <CBVal current={form?.skin_condition} value="atrophic" label="Atrophic" />
            <CBVal current={form?.skin_condition} value="stasis"   label="Stasis Wound / Venous" />
            <CBVal current={form?.skin_condition} value="ischemic" label="Ischemic" />
          </View>
        </View>

        {/* ── Wound Stage / Classification ──
            Chronic: full heading + hint + description.
            Post-surgical: just a bare "Description" field (the chronic-
            specific staging hint is dropped per the post-surgical template). */}
        <View style={s.section}>
          {!isPostSurgical && (
            <Text style={s.sectionLabel}>
              Wound Stage / Grade / Classification{" "}
              <Text style={{ fontSize: 6, color: GRAY, fontFamily: "Helvetica" }}>
                (stage for PUs, Wagner grade for DFUs, CEAP Classification for VLUs)
              </Text>
            </Text>
          )}
          <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
            <Text style={[s.label, { marginRight: 4 }]}>Description: </Text>
            <View style={[s.uline, { flex: 1 }]}>
              <Text style={s.val}>{v(form?.wound_stage)}</Text>
            </View>
          </View>
        </View>

        {/* ── Fortify: Prior Treatments Tried (table) + Advancement Reason ── */}
        {(Array.isArray(form?.prior_treatments) && (form.prior_treatments as unknown[]).length > 0) ||
        form?.advancement_reason ? (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Prior Treatments Tried</Text>
            {Array.isArray(form?.prior_treatments) &&
              (form.prior_treatments as unknown[]).length > 0 && (
                <View style={{ marginTop: 2 }}>
                  <View style={s.tableHeader}>
                    <Text style={[s.tableCell, { flex: 1.2, fontFamily: "Helvetica-Bold" }]}>Treatment / Product</Text>
                    <Text style={[s.tableCell, { flex: 1, fontFamily: "Helvetica-Bold" }]}>Dates Used</Text>
                    <Text style={[s.tableCell, { flex: 1.5, fontFamily: "Helvetica-Bold" }]}>Outcome</Text>
                  </View>
                  {(form.prior_treatments as Array<Record<string, unknown>>).map((row, idx) => (
                    <View key={idx} style={s.tableRow}>
                      <Text style={[s.tableCell, { flex: 1.2 }]}>{v(row.treatment)}</Text>
                      <Text style={[s.tableCell, { flex: 1 }]}>{v(row.dates_used)}</Text>
                      <Text style={[s.tableCell, { flex: 1.5 }]}>{v(row.outcome)}</Text>
                    </View>
                  ))}
                </View>
              )}
            {form?.advancement_reason ? (
              <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: 3 }}>
                <Text style={s.label}>Reason for advancing: </Text>
                <View style={[s.uline, { flex: 1 }]}>
                  <Text style={s.val}>{v(form?.advancement_reason)}</Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ── Fortify: Goal of Therapy + Adjuncts + Consults ── */}
        {form?.goal_of_therapy ||
        form?.adjunct_offloading === true ||
        form?.adjunct_compression === true ||
        form?.adjunct_debridement === true ||
        form?.adjunct_other ||
        form?.specialty_consults ? (
          <View style={s.section}>
            <View style={cbRowStyle}>
              <Text style={[s.label, { marginRight: 4 }]}>Goal of Therapy:</Text>
              <CBVal current={form?.goal_of_therapy} value="complete_healing" label="Complete healing" />
              <CBVal current={form?.goal_of_therapy} value="wound_bed_prep" label="Wound bed prep" />
              <CBVal current={form?.goal_of_therapy} value="palliative" label="Palliative" />
              <CBVal current={form?.goal_of_therapy} value="infection_control" label="Infection control" />
              <CBVal current={form?.goal_of_therapy} value="other" label="Other" />
              {form?.goal_of_therapy === "other" && form?.goal_of_therapy_other ? (
                <Text style={{ fontSize: 7.5, marginLeft: 2 }}>
                  ({String(form.goal_of_therapy_other)})
                </Text>
              ) : null}
            </View>
            <View style={[cbRowStyle, { marginTop: 3 }]}>
              <Text style={[s.label, { marginRight: 4 }]}>Adjuncts:</Text>
              <CB checked={form?.adjunct_offloading === true} label="Offloading" />
              <CB checked={form?.adjunct_compression === true} label="Compression" />
              <CB checked={form?.adjunct_debridement === true} label="Debridement" />
              {form?.adjunct_other ? (
                <Text style={{ fontSize: 7.5, marginLeft: 2 }}>
                  Other: {String(form.adjunct_other)}
                </Text>
              ) : null}
            </View>
            {form?.specialty_consults ? (
              <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: 3 }}>
                <Text style={s.label}>Specialty consults: </Text>
                <View style={[s.uline, { flex: 1 }]}>
                  <Text style={s.val}>{v(form?.specialty_consults)}</Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ── Treatment Plan ── */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Treatment Plan to Include Frequency of Dressing Changes</Text>
          <Text style={{ fontSize: 7, color: GRAY, marginBottom: 2, fontFamily: "Helvetica-Oblique" }}>
            All materials and supplies were dispensed per the patient&apos;s needs. Home instructions were reviewed and all questions were answered in detail.
          </Text>
          <Text style={s.textArea}>{v(form?.treatment_plan)}</Text>
        </View>

        {/* ── Clinical Notes ── */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Clinical Notes</Text>
          <Text style={s.textArea}>{v(form?.clinical_notes)}</Text>
        </View>

        {/* ── Home Health / SNF ──
            Chronic: compact single-row checkboxes.
            Post-surgical: two explicit Yes/No question rows matching the
            provided template ("Is the patient going to home health after
            surgery?" / "Is patient at a SNF?"). */}
        {isPostSurgical ? (
          <View style={s.section}>
            <View style={[cbRowStyle, { marginBottom: 3 }]}>
              <Text style={[s.label, { marginRight: 6 }]}>
                Is the patient going to home health after surgery?
              </Text>
              <CB checked={form?.is_receiving_home_health === true} label="Yes" />
              <CB checked={form?.is_receiving_home_health !== true} label="No" />
            </View>
            <View style={cbRowStyle}>
              <Text style={[s.label, { marginRight: 6 }]}>Is patient at a SNF?</Text>
              <CB checked={form?.is_patient_at_snf === true} label="Yes" />
              <CB checked={form?.is_patient_at_snf !== true} label="No" />
            </View>
          </View>
        ) : (
          <View style={s.section}>
            <View style={cbRowStyle}>
              <CB checked={form?.is_receiving_home_health === true} label="Receiving Home Health (PT/OT/HHA/Nursing)" />
              <CB checked={form?.is_patient_at_snf === true} label="Patient at SNF" />
            </View>
          </View>
        )}

        {/* ── Anticipated Length of Need ── */}
        <View style={s.section}>
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
            <Text style={[s.label, { marginRight: 6 }]}>Anticipated Length of Need:</Text>
            <View style={[s.uline, { width: 28, marginRight: 4 }]}>
              <Text style={s.val}>{ald != null ? String(ald) : ""}</Text>
            </View>
            <Text style={{ fontSize: 8, marginRight: 10 }}>Days</Text>
            <CB checked={ald === 15} label="15 days" />
            <CB checked={ald === 21} label="21 days" />
            <CB checked={ald === 30} label="30 days" />
          </View>
        </View>

        {/* ── Product Dispensed table ── */}
        <View style={s.section}>
          <Text style={[s.sectionLabel, { marginBottom: 3 }]}>Product Dispensed</Text>
          <Text style={{ fontSize: 7, color: GRAY, marginBottom: 3, fontFamily: "Helvetica-Oblique" }}>
            (Please see attached prescription and patient acknowledgement of receipt)
          </Text>
          {items.length > 0 ? (
            <>
              <View style={s.tableHeader}>
                <Text style={[s.tableCell, { width: 92, fontFamily: "Helvetica-Bold", fontSize: 7 }]}>SKU</Text>
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
                    <Text style={[s.tableCell, { width: 92, fontSize: 6.8, color: GRAY, fontFamily: "Courier", paddingRight: 4 }]}>{v(item.product_sku)}</Text>
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

        {/* ── Fortify: Product metadata (frequency / modifiers / prior auth) ── */}
        {form?.application_frequency ||
        form?.special_modifiers ||
        form?.prior_auth_obtained === true ? (
          <View style={s.row}>
            <UField label="Application Frequency" value={v(form?.application_frequency)} width={90} />
            <UField label="Modifiers (KX/GA)" value={v(form?.special_modifiers)} width={70} />
            <CB checked={form?.prior_auth_obtained === true} label="Prior auth obtained" />
          </View>
        ) : null}

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

        {/* ── Fortify: Coverage Self-Check (LCD/NCD) ── */}
        {form?.lcd_reference ||
        form?.wound_meets_lcd != null ||
        form?.conservative_tx_period_met != null ||
        form?.qty_within_lcd_limits != null ||
        form?.kx_criteria_met ||
        form?.pos_eligible != null ||
        form?.coverage_concerns ? (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Coverage Self-Check (LCD/NCD)</Text>
            {form?.lcd_reference ? (
              <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: 2 }}>
                <Text style={s.label}>LCD/NCD ref: </Text>
                <View style={[s.uline, { flex: 1 }]}>
                  <Text style={s.val}>{v(form?.lcd_reference)}</Text>
                </View>
              </View>
            ) : null}
            <View style={[cbRowStyle, { marginTop: 3 }]}>
              <Text style={[s.label, { marginRight: 6 }]}>Wound meets LCD?</Text>
              <CB checked={form?.wound_meets_lcd === true} label="Yes" />
              <CB checked={form?.wound_meets_lcd === false} label="No" />
              <Text style={[s.label, { marginLeft: 8, marginRight: 6 }]}>Conservative tx period met?</Text>
              <CB checked={form?.conservative_tx_period_met === true} label="Yes" />
              <CB checked={form?.conservative_tx_period_met === false} label="No" />
            </View>
            <View style={[cbRowStyle, { marginTop: 3 }]}>
              <Text style={[s.label, { marginRight: 6 }]}>Qty within LCD limits?</Text>
              <CB checked={form?.qty_within_lcd_limits === true} label="Yes" />
              <CB checked={form?.qty_within_lcd_limits === false} label="No" />
              <Text style={[s.label, { marginLeft: 8, marginRight: 6 }]}>KX criteria:</Text>
              <CBVal current={form?.kx_criteria_met} value="yes" label="Yes" />
              <CBVal current={form?.kx_criteria_met} value="no" label="No" />
              <CBVal current={form?.kx_criteria_met} value="na" label="N/A" />
              <Text style={[s.label, { marginLeft: 8, marginRight: 6 }]}>POS eligible?</Text>
              <CB checked={form?.pos_eligible === true} label="Yes" />
              <CB checked={form?.pos_eligible === false} label="No" />
            </View>
            {form?.coverage_concerns ? (
              <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: 3 }}>
                <Text style={s.label}>Concerns: </Text>
                <View style={[s.uline, { flex: 1 }]}>
                  <Text style={s.val}>{v(form?.coverage_concerns)}</Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ── Fortify: Physician 5-point Attestation ── */}
        <View style={s.section} wrap={false}>
          <Text style={s.sectionLabel}>Physician Attestation</Text>
          <Text style={{ fontSize: 7.5, color: BLACK, marginBottom: 3, fontFamily: "Helvetica-Bold" }}>
            I, the undersigned physician, certify that:
          </Text>
          <View style={{ paddingLeft: 6 }}>
            <View style={{ flexDirection: "row", marginBottom: 1.5 }}>
              <CB checked={form?.attest_examined_patient === true} label="" />
              <Text style={{ fontSize: 7.5, color: BLACK, flex: 1 }}>
                1. I have personally examined the patient and assessed the wound described above.
              </Text>
            </View>
            <View style={{ flexDirection: "row", marginBottom: 1.5 }}>
              <CB checked={form?.attest_medically_necessary === true} label="" />
              <Text style={{ fontSize: 7.5, color: BLACK, flex: 1 }}>
                2. The product(s) ordered above are medically necessary for the treatment of this wound.
              </Text>
            </View>
            <View style={{ flexDirection: "row", marginBottom: 1.5 }}>
              <CB checked={form?.attest_conservative_tx_inadequate === true} label="" />
              <Text style={{ fontSize: 7.5, color: BLACK, flex: 1 }}>
                3. Conservative treatments have been tried and are inadequate for this wound.
              </Text>
            </View>
            <View style={{ flexDirection: "row", marginBottom: 1.5 }}>
              <CB checked={form?.attest_freq_qty_clinical_judgment === true} label="" />
              <Text style={{ fontSize: 7.5, color: BLACK, flex: 1 }}>
                4. The frequency and quantity ordered reflect my clinical judgment of what is needed for this patient.
              </Text>
            </View>
            <View style={{ flexDirection: "row", marginBottom: 1.5 }}>
              <CB checked={form?.attest_lcd_supported === true} label="" />
              <Text style={{ fontSize: 7.5, color: BLACK, flex: 1 }}>
                5. To my knowledge, the documentation in this form and the patient&apos;s medical record supports the criteria of the applicable LCD or NCD.
              </Text>
            </View>
          </View>
        </View>

        {/* ── Fortify: Physician NPI ── */}
        {form?.physician_npi ? (
          <View style={s.row}>
            <UField label="Physician NPI" value={v(form?.physician_npi)} width={100} />
          </View>
        ) : null}

        {/* ── Signature + Patient block ──
            Unified layout: each cell has value-above-line, caption-below.
            All four cells share the same cell height so the underlines
            align horizontally across both rows. */}
        {(() => {
          const CELL_HEIGHT = 32;

          const cellBox = {
            height: CELL_HEIGHT,
            justifyContent: "flex-end" as const,
            borderBottom: `0.75pt solid #333`,
            paddingBottom: 1,
          };
          const caption = { fontSize: 6, color: GRAY, marginTop: 2, textTransform: "uppercase" as const, letterSpacing: 0.3 };
          const valueText = { fontSize: 9, fontFamily: "Helvetica-Bold", color: BLACK };

          const signedAt = (form as any)?.physician_signed_at as string | null | undefined;
          const signedDate = signedAt
            ? new Date(signedAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              })
            : v(form?.physician_signature_date, "");

          return (
            <>
              <View style={s.sigGrid}>
                <View style={s.sigBlock}>
                  <View style={[cellBox, { alignItems: "flex-start" }]}>
                    {signatureImage ? (
                      <Image src={signatureImage} style={{ height: CELL_HEIGHT - 4 }} />
                    ) : null}
                  </View>
                  <Text style={caption}>Physicians Signature</Text>
                </View>
                <View style={{ width: 110 }}>
                  <View style={cellBox}>
                    {signedDate ? <Text style={valueText}>{signedDate}</Text> : null}
                  </View>
                  <Text style={caption}>Date Signed</Text>
                </View>
              </View>

              <View style={[s.sigGrid, { marginTop: 10 }]}>
                <View style={s.sigBlock}>
                  <View style={cellBox}>
                    {patientNameVal ? <Text style={valueText}>{patientNameVal}</Text> : null}
                  </View>
                  <Text style={caption}>Patient Name</Text>
                </View>
                <View style={{ width: 110 }}>
                  <View style={cellBox}>
                    {patientDateVal ? <Text style={valueText}>{patientDateVal}</Text> : null}
                  </View>
                  <Text style={caption}>Date of Service</Text>
                </View>
              </View>
            </>
          );
        })()}

        {/* ── Footer ── */}
        <View style={s.footer} fixed>
          <Text>Meridian Surgical Supplies — Physicians Order Recommendation</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

      </Page>
    </Document>
  );
}
