import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { IServiceLine } from "@/utils/interfaces/orders";

/* ── Constants ── */
const BLACK  = "#000000";
const RED    = "#CC0000";
const LGRAY  = "#F5F5F5";
const GRAY   = "#666666";

/* ── Helper ── */
const f = (v: unknown, fallback = "") =>
  v != null && v !== "" ? String(v) : fallback;

const check = (active: boolean) => (active ? "(X)" : "( )");

function fmtDate(v: unknown): string {
  if (!v) return "";
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return String(v);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}  ${dd}  ${yy}`;
}

/* ── Styles ── */
const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 7,
    color: BLACK,
    paddingTop: 12,
    paddingHorizontal: 18,
    paddingBottom: 30,
    backgroundColor: "#fff",
  },

  /* Red top bar */
  redBar: {
    borderTop: `3px solid ${RED}`,
    marginBottom: 3,
  },

  /* Form title row */
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  titleLeft: {
    fontSize: 6,
    color: GRAY,
    flex: 1,
  },
  titleCenter: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    flex: 2,
  },
  titleRight: {
    fontSize: 6,
    color: GRAY,
    flex: 1,
    textAlign: "right",
  },

  /* Generic outer border */
  formBorder: {
    border: `0.75px solid ${BLACK}`,
  },

  /* Horizontal band (full width) */
  band: {
    flexDirection: "row",
    borderBottom: `0.5px solid ${BLACK}`,
  },

  /* A single cell inside a band */
  cell: {
    borderRight: `0.5px solid ${BLACK}`,
    padding: "2 3",
  },
  cellLast: {
    padding: "2 3",
  },

  /* Box label (number + caption) */
  boxLabel: {
    fontSize: 5.5,
    color: GRAY,
    marginBottom: 1,
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },

  /* Value text */
  val: {
    fontSize: 8,
    color: BLACK,
  },

  /* Section header inside form */
  sectionBar: {
    backgroundColor: LGRAY,
    borderBottom: `0.5px solid ${BLACK}`,
    padding: "2 4",
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
    textAlign: "center",
  },

  /* Service-line table header */
  tableHeader: {
    flexDirection: "row",
    backgroundColor: LGRAY,
    borderBottom: `0.5px solid ${BLACK}`,
  },
  thCell: {
    padding: "2 3",
    borderRight: `0.5px solid ${BLACK}`,
    fontSize: 5.5,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    color: GRAY,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: `0.5px solid ${BLACK}`,
    minHeight: 14,
  },
  tdCell: {
    padding: "2 3",
    borderRight: `0.5px solid ${BLACK}`,
    fontSize: 7,
  },

  /* Signature area */
  sigArea: {
    flexDirection: "row",
    minHeight: 20,
  },

  footer: {
    position: "absolute",
    bottom: 12,
    left: 18,
    right: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 6,
    color: GRAY,
    borderTop: `0.5px solid ${BLACK}`,
    paddingTop: 3,
  },
});

/* ── Sub-components ── */

function BoxLabel({ num, label }: { num: string; label: string }) {
  return (
    <Text style={s.boxLabel}>
      {num}. {label}
    </Text>
  );
}

/* ── Main Component ── */

export function HCFA1500PDF({
  order,
  hcfa,
}: {
  order: Record<string, any>;
  hcfa: Record<string, any> | null;
}) {
  const h = hcfa ?? {};
  const insType = f(h.insurance_type, "").toLowerCase();

  const patientName = h.patient_last_name
    ? `${f(h.patient_last_name)}, ${f(h.patient_first_name)} ${f(h.patient_middle_initial)}`
    : order.patient
      ? `${order.patient.last_name ?? ""}, ${order.patient.first_name ?? ""}`
      : "";

  const insuredName = h.insured_last_name
    ? `${f(h.insured_last_name)}, ${f(h.insured_first_name)} ${f(h.insured_middle_initial)}`
    : "";

  const patientDob = h.patient_dob ?? order.patient?.date_of_birth ?? "";
  const dos = order.date_of_service ?? "";

  return (
    <Document>
      <Page size="LETTER" style={s.page}>

        {/* Red top bar */}
        <View style={s.redBar} />

        {/* Form title */}
        <View style={s.titleRow}>
          <Text style={s.titleLeft}>
            APPROVED BY NATIONAL UNIFORM CLAIM COMMITTEE (NUCC) 02/12
          </Text>
          <Text style={s.titleCenter}>HEALTH INSURANCE CLAIM FORM</Text>
          <Text style={s.titleRight}>OMB APPROVAL PENDING</Text>
        </View>

        {/* ── CARRIER block placeholder ── */}
        <View
          style={{
            border: `0.5px solid ${BLACK}`,
            padding: "3 4",
            marginBottom: 0,
            minHeight: 30,
            flexDirection: "row",
            justifyContent: "flex-end",
          }}
        >
          <Text style={{ fontSize: 6, color: GRAY }}>CARRIER</Text>
        </View>

        {/* ── ROW 1: Box 1 (insurance type) + Box 1a ── */}
        <View style={[s.band, s.formBorder, { borderBottom: "none" }]}>
          {/* Box 1 */}
          <View style={[s.cell, { flex: 3 }]}>
            <BoxLabel num="1" label="Medicare  Medicaid  Tricare  CHAMPVA  Group Health Plan  FECA  Other" />
            <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
              {(["medicare","medicaid","tricare","champva","group_health_plan","feca","other"] as const).map(t => (
                <Text key={t} style={{ fontSize: 7 }}>
                  {check(insType === t)}{" "}
                  <Text style={{ fontSize: 6, color: GRAY }}>
                    {t === "group_health_plan" ? "Group" : t === "feca" ? "FECA" : t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </Text>
              ))}
            </View>
          </View>
          {/* Box 1a */}
          <View style={[s.cellLast, { flex: 2 }]}>
            <BoxLabel num="1a" label="Insured's ID Number" />
            <Text style={s.val}>{f(h.insured_id_number)}</Text>
          </View>
        </View>

        {/* ── ROW 2: Box 2 + Box 3 + Box 4 ── */}
        <View style={[s.band, { borderLeft: `0.75px solid ${BLACK}`, borderRight: `0.75px solid ${BLACK}` }]}>
          {/* Box 2 */}
          <View style={[s.cell, { flex: 3 }]}>
            <BoxLabel num="2" label="Patient's Name (Last, First, Middle Initial)" />
            <Text style={s.val}>{patientName}</Text>
          </View>
          {/* Box 3 */}
          <View style={[s.cell, { flex: 2 }]}>
            <BoxLabel num="3" label="Patient's Birth Date / Sex" />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Text style={s.val}>{fmtDate(patientDob)}</Text>
              <Text style={{ fontSize: 7 }}>
                {check(f(h.patient_sex) === "male")} M{" "}
                {check(f(h.patient_sex) === "female")} F
              </Text>
            </View>
          </View>
          {/* Box 4 */}
          <View style={[s.cellLast, { flex: 3 }]}>
            <BoxLabel num="4" label="Insured's Name (Last, First, Middle Initial)" />
            <Text style={s.val}>{insuredName}</Text>
          </View>
        </View>

        {/* ── ROW 3: Box 5 + Box 6 + Box 7 ── */}
        <View style={[s.band, { borderLeft: `0.75px solid ${BLACK}`, borderRight: `0.75px solid ${BLACK}` }]}>
          {/* Box 5 */}
          <View style={[s.cell, { flex: 3 }]}>
            <BoxLabel num="5" label="Patient's Address (No., Street)" />
            <Text style={s.val}>{f(h.patient_address)}</Text>
            <View style={{ flexDirection: "row", marginTop: 2, gap: 6 }}>
              <View style={{ flex: 2 }}>
                <Text style={s.boxLabel}>City</Text>
                <Text style={s.val}>{f(h.patient_city)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.boxLabel}>State</Text>
                <Text style={s.val}>{f(h.patient_state)}</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", marginTop: 2, gap: 6 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.boxLabel}>Zip Code</Text>
                <Text style={s.val}>{f(h.patient_zip)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.boxLabel}>Telephone</Text>
                <Text style={s.val}>{f(h.patient_phone)}</Text>
              </View>
            </View>
          </View>
          {/* Box 6 */}
          <View style={[s.cell, { flex: 2 }]}>
            <BoxLabel num="6" label="Patient Relationship to Insured" />
            <View style={{ flexDirection: "row", gap: 4, flexWrap: "wrap", marginTop: 2 }}>
              {(["self","spouse","child","other"] as const).map(r => (
                <Text key={r} style={{ fontSize: 7 }}>
                  {check(f(h.patient_relationship) === r)}{" "}
                  <Text style={{ fontSize: 6, color: GRAY }}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </Text>
                </Text>
              ))}
            </View>
          </View>
          {/* Box 7 */}
          <View style={[s.cellLast, { flex: 3 }]}>
            <BoxLabel num="7" label="Insured's Address (No., Street)" />
            <Text style={s.val}>{f(h.insured_address)}</Text>
            <View style={{ flexDirection: "row", marginTop: 2, gap: 6 }}>
              <View style={{ flex: 2 }}>
                <Text style={s.boxLabel}>City</Text>
                <Text style={s.val}>{f(h.insured_city)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.boxLabel}>State</Text>
                <Text style={s.val}>{f(h.insured_state)}</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", marginTop: 2, gap: 6 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.boxLabel}>Zip Code</Text>
                <Text style={s.val}>{f(h.insured_zip)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.boxLabel}>Telephone</Text>
                <Text style={s.val}>{f(h.insured_phone)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── ROW 4: Box 8 (reserved) + Box 9 + Box 9a ── */}
        <View style={[s.band, { borderLeft: `0.75px solid ${BLACK}`, borderRight: `0.75px solid ${BLACK}` }]}>
          <View style={[s.cell, { flex: 2 }]}>
            <BoxLabel num="8" label="Reserved for NUCC Use" />
            <Text style={s.val}> </Text>
          </View>
          <View style={[s.cell, { flex: 3 }]}>
            <BoxLabel num="9" label="Other Insured's Name" />
            <Text style={s.val}>{f(h.other_insured_name)}</Text>
          </View>
          <View style={[s.cellLast, { flex: 3 }]}>
            <BoxLabel num="9a" label="Other Insured's Policy or Group Number" />
            <Text style={s.val}>{f(h.other_insured_policy)}</Text>
          </View>
        </View>

        {/* ── ROW 5: Box 10 (conditions) + Box 11 (insured policy) ── */}
        <View style={[s.band, { borderLeft: `0.75px solid ${BLACK}`, borderRight: `0.75px solid ${BLACK}` }]}>
          <View style={[s.cell, { flex: 3 }]}>
            <BoxLabel num="10" label="Is Patient's Condition Related To:" />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 2 }}>
              <Text style={{ fontSize: 7 }}>{check(h.condition_employment === true)} Employment</Text>
              <Text style={{ fontSize: 7 }}>
                {check(h.condition_auto_accident === true)} Auto Accident
                {h.condition_auto_accident === true && h.condition_auto_state
                  ? ` (${String(h.condition_auto_state)})`
                  : ""}
              </Text>
              <Text style={{ fontSize: 7 }}>{check(h.condition_other_accident === true)} Other Accident</Text>
            </View>
          </View>
          <View style={[s.cellLast, { flex: 5 }]}>
            <BoxLabel num="11" label="Insured's Policy Group or FECA Number" />
            <Text style={s.val}>{f(h.insured_policy_group)}</Text>
            <View style={{ flexDirection: "row", marginTop: 3, gap: 6 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.boxLabel}>11a. Insured's DOB / Sex</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Text style={s.val}>{fmtDate(h.insured_dob)}</Text>
                  <Text style={{ fontSize: 7 }}>
                    {check(f(h.insured_sex) === "male")} M{" "}
                    {check(f(h.insured_sex) === "female")} F
                  </Text>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.boxLabel}>11b. Employer's Name or School Name</Text>
                <Text style={s.val}>{f(h.insured_employer)}</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", marginTop: 3, gap: 6 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.boxLabel}>11c. Insurance Plan Name</Text>
                <Text style={s.val}>{f(h.insured_plan_name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.boxLabel}>11d. Another Health Benefit Plan?</Text>
                <Text style={{ fontSize: 7 }}>
                  {check(h.another_health_benefit === true)} Yes{" "}
                  {check(h.another_health_benefit !== true)} No
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── ROW 6: Box 12 + Box 13 ── */}
        <View style={[s.band, { borderLeft: `0.75px solid ${BLACK}`, borderRight: `0.75px solid ${BLACK}` }]}>
          <View style={[s.cell, { flex: 1 }]}>
            <BoxLabel num="12" label="Patient's or Authorized Person's Signature" />
            <Text style={{ fontSize: 7, marginTop: 2 }}>
              I authorize the release of any medical or other information necessary to process this claim.
            </Text>
            <Text style={{ fontSize: 7, marginTop: 4 }}>
              Signed {h.patient_signature ? f(h.patient_signature) : "________________________"}
              {"  "}Date {h.patient_signature_date ? fmtDate(h.patient_signature_date) : "____________"}
            </Text>
          </View>
          <View style={[s.cellLast, { flex: 1 }]}>
            <BoxLabel num="13" label="Insured's or Authorized Person's Signature" />
            <Text style={{ fontSize: 7, marginTop: 2 }}>
              I authorize payment of medical benefits to the undersigned physician or supplier.
            </Text>
            <Text style={{ fontSize: 7, marginTop: 4 }}>
              Signed {h.insured_signature ? f(h.insured_signature) : "________________________"}
            </Text>
          </View>
        </View>

        {/* ── Section divider ── */}
        <View
          style={[
            s.sectionBar,
            { borderLeft: `0.75px solid ${BLACK}`, borderRight: `0.75px solid ${BLACK}` },
          ]}
        >
          <Text>
            DATE OF CURRENT ILLNESS/INJURY/PREGNANCY  |  REFERRING PROVIDER  |  HOSPITALIZATION DATES
          </Text>
        </View>

        {/* ── ROW 7: Box 14 + Box 15 + Box 16 ── */}
        <View style={[s.band, { borderLeft: `0.75px solid ${BLACK}`, borderRight: `0.75px solid ${BLACK}` }]}>
          <View style={[s.cell, { flex: 2 }]}>
            <BoxLabel num="14" label="Date of Current Illness / Injury / Pregnancy" />
            <View style={{ flexDirection: "row", gap: 4 }}>
              {h.illness_qualifier ? (
                <Text style={[s.val, { fontSize: 6, color: GRAY }]}>{f(h.illness_qualifier)}</Text>
              ) : null}
              <Text style={s.val}>{fmtDate(h.illness_date || dos)}</Text>
            </View>
          </View>
          <View style={[s.cell, { flex: 2 }]}>
            <BoxLabel num="15" label="Other Date" />
            <View style={{ flexDirection: "row", gap: 4 }}>
              {h.other_date_qualifier ? (
                <Text style={[s.val, { fontSize: 6, color: GRAY }]}>{f(h.other_date_qualifier)}</Text>
              ) : null}
              <Text style={s.val}>{h.other_date ? fmtDate(h.other_date) : " "}</Text>
            </View>
          </View>
          <View style={[s.cellLast, { flex: 4 }]}>
            <BoxLabel num="16" label="Dates Patient Unable to Work in Current Occupation" />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View>
                <Text style={s.boxLabel}>From</Text>
                <Text style={s.val}>{h.unable_work_from ? fmtDate(h.unable_work_from) : " "}</Text>
              </View>
              <View>
                <Text style={s.boxLabel}>To</Text>
                <Text style={s.val}>{h.unable_work_to ? fmtDate(h.unable_work_to) : " "}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── ROW 8: Box 17 + Box 18 + Box 19 ── */}
        <View style={[s.band, { borderLeft: `0.75px solid ${BLACK}`, borderRight: `0.75px solid ${BLACK}` }]}>
          <View style={[s.cell, { flex: 3 }]}>
            <BoxLabel num="17" label="Name of Referring Provider or Other Source" />
            <Text style={s.val}>{f(h.referring_provider_name)}</Text>
            <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.boxLabel}>17a. Other ID</Text>
                <Text style={s.val}>{f(h.referring_provider_qual)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.boxLabel}>17b. NPI</Text>
                <Text style={s.val}>{f(h.referring_provider_npi)}</Text>
              </View>
            </View>
          </View>
          <View style={[s.cell, { flex: 2 }]}>
            <BoxLabel num="18" label="Hospitalization Dates Related to Current Services" />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View>
                <Text style={s.boxLabel}>From</Text>
                <Text style={s.val}>{h.hospitalization_from ? fmtDate(h.hospitalization_from) : " "}</Text>
              </View>
              <View>
                <Text style={s.boxLabel}>To</Text>
                <Text style={s.val}>{h.hospitalization_to ? fmtDate(h.hospitalization_to) : " "}</Text>
              </View>
            </View>
          </View>
          <View style={[s.cellLast, { flex: 3 }]}>
            <BoxLabel num="19" label="Additional Claim Information" />
            <Text style={s.val}>{f(h.additional_claim_info)}</Text>
          </View>
        </View>

        {/* ── ROW 9: Box 20 + Box 21 + Box 22 + Box 23 ── */}
        <View style={[s.band, { borderLeft: `0.75px solid ${BLACK}`, borderRight: `0.75px solid ${BLACK}` }]}>
          <View style={[s.cell, { flex: 1.5 }]}>
            <BoxLabel num="20" label="Outside Lab?" />
            <Text style={{ fontSize: 7 }}>
              {check(h.outside_lab === true)} Yes{"  "}
              {check(h.outside_lab !== true)} No
            </Text>
            {h.outside_lab === true && h.outside_lab_charges != null ? (
              <Text style={[s.val, { marginTop: 1 }]}>${String(h.outside_lab_charges)}</Text>
            ) : null}
          </View>
          <View style={[s.cell, { flex: 4 }]}>
            <BoxLabel num="21" label="Diagnosis or Nature of Illness or Injury (ICD-10)" />
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              {(["a","b","c","d","e","f","g","h","i","j","k","l"] as const).map((ltr) => (
                <View key={ltr} style={{ flexDirection: "row", gap: 2, marginBottom: 2 }}>
                  <Text style={{ fontSize: 6, color: GRAY }}>{ltr.toUpperCase()}.</Text>
                  <Text style={s.val}>{f(h[`diagnosis_${ltr}`] ?? "")}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={[s.cell, { flex: 1.5 }]}>
            <BoxLabel num="22" label="Resubmission Code" />
            <Text style={s.val}>{f(h.resubmission_code)}</Text>
            {h.original_ref_number ? (
              <Text style={[s.val, { marginTop: 1 }]}>{f(h.original_ref_number)}</Text>
            ) : null}
          </View>
          <View style={[s.cellLast, { flex: 2 }]}>
            <BoxLabel num="23" label="Prior Authorization Number" />
            <Text style={s.val}>{f(h.prior_auth_number)}</Text>
          </View>
        </View>

        {/* ── Box 24: Service Lines Table ── */}
        <View style={[s.band, { borderLeft: `0.75px solid ${BLACK}`, borderRight: `0.75px solid ${BLACK}`, flexDirection: "column" }]}>
          {/* Section label */}
          <View style={s.sectionBar}>
            <Text>24. SERVICE LINES</Text>
          </View>
          {/* Table header */}
          <View style={s.tableHeader}>
            <Text style={[s.thCell, { flex: 2 }]}>A. Date of Service{"\n"}From / To</Text>
            <Text style={[s.thCell, { flex: 0.8 }]}>B. POS</Text>
            <Text style={[s.thCell, { flex: 0.8 }]}>C. EMG</Text>
            <Text style={[s.thCell, { flex: 2 }]}>D. CPT/HCPCS{"\n"}Modifier</Text>
            <Text style={[s.thCell, { flex: 1.5 }]}>E. Diagnosis{"\n"}Pointer</Text>
            <Text style={[s.thCell, { flex: 1.5 }]}>F. $ Charges</Text>
            <Text style={[s.thCell, { flex: 1 }]}>G. Days/Units</Text>
            <Text style={[s.thCell, { flex: 1 }]}>H. EPSDT</Text>
            <Text style={[s.thCell, { flex: 1 }]}>I. ID Qual</Text>
            <Text style={[s.thCell, { flex: 2, borderRight: "none" }]}>J. Rendering{"\n"}Provider NPI</Text>
          </View>
          {/* Service lines — up to 6, padded with blanks */}
          {((): React.ReactElement[] => {
            const rawLines = (h.service_lines as IServiceLine[] | null) ?? [];
            const padded: (Partial<IServiceLine> | null)[] = [
              ...rawLines,
              ...Array(Math.max(0, 6 - rawLines.length)).fill(null),
            ].slice(0, 6);
            return padded.map((line, n) => (
              <View key={n} style={s.tableRow}>
                <Text style={[s.tdCell, { flex: 2 }]}>
                  {line?.dos_from ? fmtDate(line.dos_from) : " "}
                  {line?.dos_to ? ` – ${fmtDate(line.dos_to)}` : ""}
                </Text>
                <Text style={[s.tdCell, { flex: 0.8 }]}>{f(line?.place_of_service)}</Text>
                <Text style={[s.tdCell, { flex: 0.8 }]}>{line?.emg ? "Y" : " "}</Text>
                <Text style={[s.tdCell, { flex: 2 }]}>
                  {f(line?.cpt_code)}
                  {line?.modifier_1 ? ` ${line.modifier_1}` : ""}
                  {line?.modifier_2 ? ` ${line.modifier_2}` : ""}
                  {line?.modifier_3 ? ` ${line.modifier_3}` : ""}
                  {line?.modifier_4 ? ` ${line.modifier_4}` : ""}
                </Text>
                <Text style={[s.tdCell, { flex: 1.5 }]}>{f(line?.diagnosis_pointer)}</Text>
                <Text style={[s.tdCell, { flex: 1.5 }]}>{f(line?.charges)}</Text>
                <Text style={[s.tdCell, { flex: 1 }]}>{f(line?.days_units)}</Text>
                <Text style={[s.tdCell, { flex: 1 }]}>{f(line?.epsdt)}</Text>
                <Text style={[s.tdCell, { flex: 1 }]}>{f(line?.id_qualifier)}</Text>
                <Text style={[s.tdCell, { flex: 2, borderRight: "none" }]}>{f(line?.rendering_npi)}</Text>
              </View>
            ));
          })()}
        </View>

        {/* ── ROW 10: Box 25 + Box 26 + Box 27 + Box 28 + Box 29 + Box 30 ── */}
        <View style={[s.band, { borderLeft: `0.75px solid ${BLACK}`, borderRight: `0.75px solid ${BLACK}` }]}>
          <View style={[s.cell, { flex: 2 }]}>
            <BoxLabel num="25" label="Federal Tax ID Number  SSN / EIN" />
            <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
              <Text style={s.val}>{f(h.federal_tax_id)}</Text>
              <Text style={{ fontSize: 6 }}>
                {check(h.tax_id_ssn === true)} SSN{" "}
                {check(h.tax_id_ssn !== true)} EIN
              </Text>
            </View>
          </View>
          <View style={[s.cell, { flex: 2 }]}>
            <BoxLabel num="26" label="Patient's Account No." />
            <Text style={s.val}>{f(h.patient_account_number)}</Text>
          </View>
          <View style={[s.cell, { flex: 1.5 }]}>
            <BoxLabel num="27" label="Accept Assignment?" />
            <Text style={{ fontSize: 7 }}>
              {check(h.accept_assignment === true)} Yes{" "}
              {check(h.accept_assignment !== true)} No
            </Text>
          </View>
          <View style={[s.cell, { flex: 1.5 }]}>
            <BoxLabel num="28" label="Total Charge" />
            <Text style={s.val}>{h.total_charge != null ? `$${String(h.total_charge)}` : " "}</Text>
          </View>
          <View style={[s.cell, { flex: 1.5 }]}>
            <BoxLabel num="29" label="Amount Paid" />
            <Text style={s.val}>{h.amount_paid != null ? `$${String(h.amount_paid)}` : " "}</Text>
          </View>
          <View style={[s.cellLast, { flex: 1.5 }]}>
            <BoxLabel num="30" label="Reserved for NUCC Use" />
            <Text style={s.val}>{f(h.rsvd_nucc)}</Text>
          </View>
        </View>

        {/* ── ROW 11: Box 31 + Box 32 + Box 33 ── */}
        <View
          style={[
            s.sigArea,
            {
              border: `0.75px solid ${BLACK}`,
              borderTop: "none",
            },
          ]}
        >
          <View style={[s.cell, { flex: 2 }]}>
            <BoxLabel num="31" label="Signature of Physician or Supplier" />
            <Text style={{ fontSize: 6, color: GRAY, marginTop: 1 }}>
              I certify that the statements on the reverse apply to this bill and are made a part hereof.
            </Text>
            <Text style={{ fontSize: 7, marginTop: 4 }}>
              Signed {h.physician_signature ? f(h.physician_signature) : "Signature on File"}
            </Text>
            <Text style={{ fontSize: 7, marginTop: 2 }}>
              Date {h.physician_signature_date
                ? fmtDate(h.physician_signature_date)
                : fmtDate(new Date().toISOString())}
            </Text>
          </View>
          <View style={[s.cell, { flex: 3 }]}>
            <BoxLabel num="32" label="Service Facility Location Information" />
            <Text style={s.val}>{f(h.service_facility_name)}</Text>
            <Text style={s.val}>{f(h.service_facility_address)}</Text>
            <View style={{ flexDirection: "row", marginTop: 2, gap: 6 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.boxLabel}>32a. NPI</Text>
                <Text style={s.val}>{f(h.service_facility_npi)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.boxLabel}>32b. Other ID</Text>
                <Text style={s.val}> </Text>
              </View>
            </View>
          </View>
          <View style={[s.cellLast, { flex: 3 }]}>
            <BoxLabel num="33" label="Billing Provider Info & Ph #" />
            <Text style={s.val}>{f(h.billing_provider_name)}</Text>
            <Text style={s.val}>{f(h.billing_provider_address)}</Text>
            <Text style={s.val}>{f(h.billing_provider_phone)}</Text>
            <View style={{ flexDirection: "row", marginTop: 2, gap: 6 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.boxLabel}>33a. NPI</Text>
                <Text style={s.val}>{f(h.billing_provider_npi)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.boxLabel}>33b. Other ID</Text>
                <Text style={s.val}>{f(h.billing_provider_tax_id)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text>NUCC Instruction Manual at www.nucc.org  |  HB Medical Portal</Text>
          <Text>Order #{f(order.order_number)}</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>

      </Page>
    </Document>
  );
}
