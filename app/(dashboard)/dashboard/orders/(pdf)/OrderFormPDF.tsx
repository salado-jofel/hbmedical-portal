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
          </View>
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

        {/* ── Drainage ── */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Drainage</Text>
          <Text style={s.textArea}>{v(form?.drainage_description)}</Text>
        </View>

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
