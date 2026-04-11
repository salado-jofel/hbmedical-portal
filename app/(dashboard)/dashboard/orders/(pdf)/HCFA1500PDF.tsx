/** @jsxImportSource react */
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { CB, CBVal } from "./PDFComponents";
import type { IServiceLine } from "@/utils/interfaces/orders";

/* ── Constants ── */
const RED   = "#cc0000";
const BLACK = "#000000";
const LGRAY = "#fff5f5";
const GRAY  = "#666666";

/* ── Helpers ── */
const f = (v: unknown, fallback = "") =>
  v != null && v !== "" ? String(v) : fallback;

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

  /* Outer form border — red */
  formBorder: {
    border: `0.75px solid ${RED}`,
  },

  /* Horizontal band (full-width row) */
  band: {
    flexDirection: "row",
    borderBottom: `0.5px solid ${RED}`,
  },

  /* A cell inside a band — right border only */
  cell: {
    borderRight: `0.5px solid ${RED}`,
    padding: "2 3",
  },
  cellLast: {
    padding: "2 3",
  },

  /* Box number + caption */
  boxLabel: {
    fontSize: 5.5,
    color: RED,
    marginBottom: 1,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },

  /* Field value text */
  val: {
    fontSize: 8,
    color: BLACK,
  },

  /* Section divider bar */
  sectionBar: {
    backgroundColor: LGRAY,
    borderBottom: `0.5px solid ${RED}`,
    padding: "2 4",
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
    textAlign: "center",
    color: RED,
  },

  /* Box 24 service lines table header */
  tableHeader: {
    flexDirection: "row",
    backgroundColor: LGRAY,
    borderBottom: `0.5px solid ${RED}`,
  },
  thCell: {
    padding: "2 3",
    borderRight: `0.5px solid ${RED}`,
    fontSize: 5.5,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    color: RED,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: `0.5px solid ${RED}`,
    minHeight: 14,
  },
  tdCell: {
    padding: "2 3",
    borderRight: `0.5px solid ${RED}`,
    fontSize: 7,
  },

  /* Signature area */
  sigArea: {
    flexDirection: "row",
    minHeight: 24,
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
    borderTop: `0.5px solid ${GRAY}`,
    paddingTop: 3,
  },
});

/* ── BoxLabel sub-component ── */
function BL({ num, label }: { num: string; label: string }) {
  return (
    <Text style={s.boxLabel}>
      {num}. {label}
    </Text>
  );
}

/* ── YesNo pair ── */
function YN({ checked }: { checked: boolean }) {
  return (
    <View style={{ flexDirection: "row" }}>
      <CB checked={checked} label="YES" />
      <CB checked={!checked} label="NO" />
    </View>
  );
}

/* ── Main PDF Component ── */
export function HCFA1500PDF({
  order,
  hcfa,
}: {
  order: Record<string, unknown>;
  hcfa: Record<string, unknown> | null;
}) {
  const h = hcfa ?? {};

  const patientName = h.patient_last_name
    ? `${f(h.patient_last_name)}, ${f(h.patient_first_name)} ${f(h.patient_middle_initial)}`
    : (order.patient as Record<string, unknown>)
      ? `${(order.patient as Record<string, unknown>).last_name ?? ""}, ${(order.patient as Record<string, unknown>).first_name ?? ""}`
      : "";

  const insuredName = h.insured_last_name
    ? `${f(h.insured_last_name)}, ${f(h.insured_first_name)} ${f(h.insured_middle_initial)}`
    : "";

  const patientDob = h.patient_dob
    ?? (order.patient as Record<string, unknown>)?.date_of_birth
    ?? "";

  const lines: Partial<IServiceLine>[] = Array.isArray(h.service_lines)
    ? (h.service_lines as Partial<IServiceLine>[])
    : [];

  const RL = `0.75px solid ${RED}`;

  return (
    <Document>
      <Page size="LETTER" style={s.page}>

        {/* ── CMS-1500 standard header ── */}
        <View style={{ borderBottom: `1pt solid ${RED}`, paddingBottom: 3, marginBottom: 4, alignItems: "center" }}>
          <Text style={{ fontSize: 9, color: RED, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 }}>
            HEALTH INSURANCE CLAIM FORM
          </Text>
          <Text style={{ fontSize: 6, color: GRAY, marginTop: 1 }}>
            APPROVED BY NATIONAL UNIFORM CLAIM COMMITTEE (NUCC) 02/12{"   "}PICA | PICA
          </Text>
        </View>

        {/* ── ROW 1: Box 1 (insurance type) + Box 1a ── */}
        <View style={[s.band, s.formBorder, { borderBottom: "none" }]}>
          <View style={[s.cell, { flex: 3 }]}>
            <BL num="1" label="Medicare  Medicaid  TRICARE  CHAMPVA  Group Health Plan  FECA/Blk Lung  Other" />
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 2 }}>
              <CBVal current={h.insurance_type} value="medicare"          label="MEDICARE"   />
              <CBVal current={h.insurance_type} value="medicaid"          label="MEDICAID"   />
              <CBVal current={h.insurance_type} value="tricare"           label="TRICARE"    />
              <CBVal current={h.insurance_type} value="champva"           label="CHAMPVA"    />
              <CBVal current={h.insurance_type} value="group_health_plan" label="GRP HEALTH" />
              <CBVal current={h.insurance_type} value="feca_blk_lung"     label="FECA"       />
              <CBVal current={h.insurance_type} value="other"             label="OTHER"      />
            </View>
          </View>
          <View style={[s.cellLast, { flex: 2 }]}>
            <BL num="1a" label="Insured's I.D. Number" />
            <Text style={s.val}>{f(h.insured_id_number)}</Text>
          </View>
        </View>

        {/* ── ROW 2: Box 2 + Box 3 + Box 4 ── */}
        <View style={[s.band, { borderLeft: RL, borderRight: RL }]}>
          <View style={[s.cell, { flex: 3 }]}>
            <BL num="2" label="Patient's Name (Last, First, Middle Initial)" />
            <Text style={s.val}>{patientName}</Text>
          </View>
          <View style={[s.cell, { flex: 2 }]}>
            <BL num="3" label="Patient's Birth Date / Sex" />
            <Text style={[s.val, { marginBottom: 2 }]}>{fmtDate(patientDob)}</Text>
            <View style={{ flexDirection: "row" }}>
              <CBVal current={h.patient_sex} value="male"   label="M" />
              <CBVal current={h.patient_sex} value="female" label="F" />
            </View>
          </View>
          <View style={[s.cellLast, { flex: 4 }]}>
            <BL num="4" label="Insured's Name (Last, First, Middle Initial)" />
            <Text style={s.val}>{insuredName}</Text>
          </View>
        </View>

        {/* ── ROW 3a: Box 5 address + Box 6 relationship + Box 7 address ── */}
        <View style={[s.band, { borderLeft: RL, borderRight: RL }]}>
          <View style={[s.cell, { flex: 3 }]}>
            <BL num="5" label="Patient's Address (No., Street)" />
            <Text style={s.val}>{f(h.patient_address)}</Text>
            <View style={{ flexDirection: "row", marginTop: 3, gap: 4 }}>
              <View style={{ flex: 2 }}>
                <Text style={s.boxLabel}>City</Text>
                <Text style={s.val}>{f(h.patient_city)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.boxLabel}>State</Text>
                <Text style={s.val}>{f(h.patient_state)}</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", marginTop: 3, gap: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.boxLabel}>ZIP</Text>
                <Text style={s.val}>{f(h.patient_zip)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.boxLabel}>Telephone</Text>
                <Text style={s.val}>{f(h.patient_phone)}</Text>
              </View>
            </View>
          </View>
          <View style={[s.cell, { flex: 2 }]}>
            <BL num="6" label="Patient Relationship to Insured" />
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 2 }}>
              <CBVal current={h.patient_relationship} value="self"   label="SELF"   />
              <CBVal current={h.patient_relationship} value="spouse" label="SPOUSE" />
              <CBVal current={h.patient_relationship} value="child"  label="CHILD"  />
              <CBVal current={h.patient_relationship} value="other"  label="OTHER"  />
            </View>
            <BL num="8" label="Reserved for NUCC Use" />
          </View>
          <View style={[s.cellLast, { flex: 4 }]}>
            <BL num="7" label="Insured's Address (No., Street)" />
            <Text style={s.val}>{f(h.insured_address)}</Text>
            <View style={{ flexDirection: "row", marginTop: 3, gap: 4 }}>
              <View style={{ flex: 2 }}>
                <Text style={s.boxLabel}>City</Text>
                <Text style={s.val}>{f(h.insured_city)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.boxLabel}>State</Text>
                <Text style={s.val}>{f(h.insured_state)}</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", marginTop: 3, gap: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.boxLabel}>ZIP</Text>
                <Text style={s.val}>{f(h.insured_zip)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.boxLabel}>Telephone</Text>
                <Text style={s.val}>{f(h.insured_phone)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── ROW 4: Box 9 / 9a + Box 10 conditions + Box 11 policy ── */}
        <View style={[s.band, { borderLeft: RL, borderRight: RL }]}>
          {/* Left: 9 / 9a-9d */}
          <View style={[s.cell, { flex: 3 }]}>
            <BL num="9" label="Other Insured's Name (Last, First, MI)" />
            <Text style={s.val}>{f(h.other_insured_name)}</Text>
            <Text style={[s.boxLabel, { marginTop: 3 }]}>9a. Other Insured's Policy or Group Number</Text>
            <Text style={s.val}>{f(h.other_insured_policy)}</Text>
            <Text style={[s.boxLabel, { marginTop: 3 }]}>9d. Insurance Plan Name or Program Name</Text>
            <Text style={s.val}>{f(h.other_insured_plan)}</Text>
          </View>
          {/* Middle: Box 10 */}
          <View style={[s.cell, { flex: 2 }]}>
            <BL num="10" label="Is Patient's Condition Related To:" />
            <Text style={s.boxLabel}>10a. Employment?</Text>
            <YN checked={h.condition_employment === true} />
            <Text style={[s.boxLabel, { marginTop: 3 }]}>10b. Auto Accident?</Text>
            <View style={{ flexDirection: "row" }}>
              <CB checked={h.condition_auto_accident === true}  label="YES" />
              <CB checked={h.condition_auto_accident !== true}  label="NO"  />
              {h.condition_auto_accident === true && h.condition_auto_state
                ? <Text style={[s.val, { marginLeft: 4 }]}>{f(h.condition_auto_state)}</Text>
                : null}
            </View>
            <Text style={[s.boxLabel, { marginTop: 3 }]}>10c. Other Accident?</Text>
            <YN checked={h.condition_other_accident === true} />
          </View>
          {/* Right: Box 11 group + 11a-11d */}
          <View style={[s.cellLast, { flex: 4 }]}>
            <BL num="11" label="Insured's Policy Group or FECA Number" />
            <Text style={s.val}>{f(h.insured_policy_group)}</Text>
            <View style={{ flexDirection: "row", marginTop: 3, gap: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.boxLabel}>11a. Insured's DOB / Sex</Text>
                <Text style={[s.val, { marginBottom: 1 }]}>{fmtDate(h.insured_dob)}</Text>
                <View style={{ flexDirection: "row" }}>
                  <CBVal current={h.insured_sex} value="male"   label="M" />
                  <CBVal current={h.insured_sex} value="female" label="F" />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.boxLabel}>11b. Employer / School Name</Text>
                <Text style={s.val}>{f(h.insured_employer)}</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", marginTop: 3, gap: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.boxLabel}>11c. Insurance Plan Name</Text>
                <Text style={s.val}>{f(h.insured_plan_name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.boxLabel}>11d. Another Health Benefit Plan?</Text>
                <YN checked={h.another_health_benefit === true} />
              </View>
            </View>
          </View>
        </View>

        {/* ── ROW 5: Box 12 + Box 13 ── */}
        <View style={[s.band, { borderLeft: RL, borderRight: RL }]}>
          <View style={[s.cell, { flex: 1 }]}>
            <BL num="12" label="Patient's or Authorized Person's Signature / Date" />
            <Text style={{ fontSize: 6.5, color: GRAY, marginTop: 1 }}>
              I authorize the release of any medical or other information necessary to process this claim.
            </Text>
            <Text style={{ fontSize: 7, marginTop: 4 }}>
              Signed {h.patient_signature ? f(h.patient_signature) : "________________________"}
              {"  "}Date {h.patient_signature_date ? fmtDate(h.patient_signature_date) : "____________"}
            </Text>
          </View>
          <View style={[s.cellLast, { flex: 1 }]}>
            <BL num="13" label="Insured's or Authorized Person's Signature" />
            <Text style={{ fontSize: 6.5, color: GRAY, marginTop: 1 }}>
              I authorize payment of medical benefits to the undersigned physician or supplier.
            </Text>
            <Text style={{ fontSize: 7, marginTop: 4 }}>
              Signed {h.insured_signature ? f(h.insured_signature) : "________________________"}
            </Text>
          </View>
        </View>

        {/* ── Section divider ── */}
        <View style={[s.sectionBar, { borderLeft: RL, borderRight: RL }]}>
          <Text>DATE OF ILLNESS / INJURY — REFERRING PROVIDER — HOSPITALIZATION DATES</Text>
        </View>

        {/* ── ROW 6: Box 14 + Box 15 + Box 16 ── */}
        <View style={[s.band, { borderLeft: RL, borderRight: RL }]}>
          <View style={[s.cell, { flex: 2 }]}>
            <BL num="14" label="Date of Current Illness / Injury / Pregnancy" />
            <View style={{ flexDirection: "row", gap: 4 }}>
              {h.illness_qualifier
                ? <Text style={[s.boxLabel, { marginTop: 1 }]}>{f(h.illness_qualifier)}</Text>
                : null}
              <Text style={s.val}>{fmtDate(h.illness_date)}</Text>
            </View>
          </View>
          <View style={[s.cell, { flex: 2 }]}>
            <BL num="15" label="Other Date" />
            <View style={{ flexDirection: "row", gap: 4 }}>
              {h.other_date_qualifier
                ? <Text style={[s.boxLabel, { marginTop: 1 }]}>{f(h.other_date_qualifier)}</Text>
                : null}
              <Text style={s.val}>{h.other_date ? fmtDate(h.other_date) : " "}</Text>
            </View>
          </View>
          <View style={[s.cellLast, { flex: 4 }]}>
            <BL num="16" label="Dates Patient Unable to Work in Current Occupation" />
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

        {/* ── ROW 7: Box 17 + Box 18 + Box 19 ── */}
        <View style={[s.band, { borderLeft: RL, borderRight: RL }]}>
          <View style={[s.cell, { flex: 3 }]}>
            <BL num="17" label="Name of Referring Provider or Other Source" />
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
            <BL num="18" label="Hospitalization Dates Related to Current Services" />
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
            <BL num="19" label="Additional Claim Information" />
            <Text style={s.val}>{f(h.additional_claim_info)}</Text>
          </View>
        </View>

        {/* ── ROW 8: Box 20 + Box 21 + Box 22 + Box 23 ── */}
        <View style={[s.band, { borderLeft: RL, borderRight: RL }]}>
          <View style={[s.cell, { flex: 1.5 }]}>
            <BL num="20" label="Outside Lab? $ Charges" />
            <YN checked={h.outside_lab === true} />
            {h.outside_lab === true && h.outside_lab_charges != null
              ? <Text style={[s.val, { marginTop: 1 }]}>${String(h.outside_lab_charges)}</Text>
              : null}
          </View>
          <View style={[s.cell, { flex: 4 }]}>
            <BL num="21" label="Diagnosis or Nature of Illness or Injury — ICD-10" />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
              {(["a","b","c","d","e","f","g","h","i","j","k","l"] as const).map((ltr) => (
                <View key={ltr} style={{ flexDirection: "row", gap: 1, width: "23%" }}>
                  <Text style={[s.boxLabel, { marginTop: 1, marginRight: 2 }]}>{ltr.toUpperCase()}.</Text>
                  <Text style={s.val}>{f((h as Record<string, unknown>)[`diagnosis_${ltr}`])}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={[s.cell, { flex: 1.5 }]}>
            <BL num="22" label="Resubmission Code / Original Ref. No." />
            <Text style={s.val}>{f(h.resubmission_code)}</Text>
            {h.original_ref_number
              ? <Text style={[s.val, { marginTop: 1 }]}>{f(h.original_ref_number)}</Text>
              : null}
          </View>
          <View style={[s.cellLast, { flex: 2 }]}>
            <BL num="23" label="Prior Authorization Number" />
            <Text style={s.val}>{f(h.prior_auth_number)}</Text>
          </View>
        </View>

        {/* ── Box 24: Service Lines Table ── */}
        <View style={[{ borderLeft: RL, borderRight: RL, borderBottom: `0.75px solid ${RED}`, flexDirection: "column" }]}>
          <View style={s.sectionBar}>
            <Text>24. SERVICE LINES</Text>
          </View>
          {/* Header */}
          <View style={s.tableHeader}>
            <Text style={[s.thCell, { flex: 2 }]}>A. Date of Service{"\n"}From / To</Text>
            <Text style={[s.thCell, { flex: 0.8 }]}>B.{"\n"}POS</Text>
            <Text style={[s.thCell, { flex: 0.6 }]}>C.{"\n"}EMG</Text>
            <Text style={[s.thCell, { flex: 2.5 }]}>D. CPT/HCPCS / Modifier</Text>
            <Text style={[s.thCell, { flex: 1 }]}>E. Diag{"\n"}Ptr</Text>
            <Text style={[s.thCell, { flex: 1.5 }]}>F. ${"\n"}Charges</Text>
            <Text style={[s.thCell, { flex: 0.8 }]}>G.{"\n"}Units</Text>
            <Text style={[s.thCell, { flex: 0.8 }]}>H.{"\n"}EPSDT</Text>
            <Text style={[s.thCell, { flex: 0.8 }]}>I.{"\n"}ID Qual</Text>
            <Text style={[s.thCell, { flex: 2, borderRight: "none" }]}>J. Rendering{"\n"}Provider NPI</Text>
          </View>
          {/* 6 service line rows */}
          {[0,1,2,3,4,5].map((i) => {
            const line = lines[i] ?? {};
            return (
              <View key={i} style={s.tableRow}>
                <Text style={[s.tdCell, { flex: 2 }]}>
                  {line.dos_from ? fmtDate(line.dos_from) : " "}
                  {line.dos_to ? ` – ${fmtDate(line.dos_to)}` : ""}
                </Text>
                <Text style={[s.tdCell, { flex: 0.8 }]}>{f(line.place_of_service)}</Text>
                <Text style={[s.tdCell, { flex: 0.6 }]}>{line.emg ? "Y" : " "}</Text>
                <Text style={[s.tdCell, { flex: 2.5 }]}>
                  {f(line.cpt_code)}
                  {line.modifier_1 ? ` ${line.modifier_1}` : ""}
                  {line.modifier_2 ? ` ${line.modifier_2}` : ""}
                  {line.modifier_3 ? ` ${line.modifier_3}` : ""}
                  {line.modifier_4 ? ` ${line.modifier_4}` : ""}
                </Text>
                <Text style={[s.tdCell, { flex: 1 }]}>{f(line.diagnosis_pointer)}</Text>
                <Text style={[s.tdCell, { flex: 1.5 }]}>{f(line.charges)}</Text>
                <Text style={[s.tdCell, { flex: 0.8 }]}>{f(line.days_units)}</Text>
                <Text style={[s.tdCell, { flex: 0.8 }]}>{f(line.epsdt)}</Text>
                <Text style={[s.tdCell, { flex: 0.8 }]}>{f(line.id_qualifier)}</Text>
                <Text style={[s.tdCell, { flex: 2, borderRight: "none" }]}>{f(line.rendering_npi)}</Text>
              </View>
            );
          })}
        </View>

        {/* ── ROW 9: Box 25 + 26 + 27 + 28 + 29 + 30 ── */}
        <View style={[s.band, { borderLeft: RL, borderRight: RL }]}>
          <View style={[s.cell, { flex: 2 }]}>
            <BL num="25" label="Federal Tax I.D. Number  SSN / EIN" />
            <Text style={[s.val, { marginBottom: 1 }]}>{f(h.federal_tax_id)}</Text>
            <View style={{ flexDirection: "row" }}>
              <CB checked={h.tax_id_ssn === true}  label="SSN" />
              <CB checked={h.tax_id_ssn !== true}  label="EIN" />
            </View>
          </View>
          <View style={[s.cell, { flex: 2 }]}>
            <BL num="26" label="Patient's Account No." />
            <Text style={s.val}>{f(h.patient_account_number)}</Text>
          </View>
          <View style={[s.cell, { flex: 1.5 }]}>
            <BL num="27" label="Accept Assignment?" />
            <YN checked={h.accept_assignment === true} />
          </View>
          <View style={[s.cell, { flex: 1.5 }]}>
            <BL num="28" label="Total Charge" />
            <Text style={s.val}>{h.total_charge != null ? `$${String(h.total_charge)}` : " "}</Text>
          </View>
          <View style={[s.cell, { flex: 1.5 }]}>
            <BL num="29" label="Amount Paid" />
            <Text style={s.val}>{h.amount_paid != null ? `$${String(h.amount_paid)}` : " "}</Text>
          </View>
          <View style={[s.cellLast, { flex: 1.5 }]}>
            <BL num="30" label="Reserved for NUCC Use" />
            <Text style={s.val}>{f(h.rsvd_nucc)}</Text>
          </View>
        </View>

        {/* ── ROW 10: Box 31 + Box 32 + Box 33 ── */}
        <View style={[s.sigArea, { border: `0.75px solid ${RED}`, borderTop: "none" }]}>
          <View style={[s.cell, { flex: 2 }]}>
            <BL num="31" label="Signature of Physician or Supplier / Date" />
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
            <BL num="32" label="Service Facility Location Information" />
            <Text style={s.val}>{f(h.service_facility_name)}</Text>
            <Text style={s.val}>{f(h.service_facility_address)}</Text>
            <View style={{ flexDirection: "row", marginTop: 3, gap: 6 }}>
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
            <BL num="33" label="Billing Provider Info & Ph #" />
            <Text style={s.val}>{f(h.billing_provider_name)}</Text>
            <Text style={s.val}>{f(h.billing_provider_address)}</Text>
            <Text style={s.val}>{f(h.billing_provider_phone)}</Text>
            <View style={{ flexDirection: "row", marginTop: 3, gap: 6 }}>
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

        {/* ── Footer ── */}
        <View style={s.footer} fixed>
          <Text>NUCC Instruction Manual available at www.nucc.org</Text>
          <Text>Order #{f(order.order_number)}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

      </Page>
    </Document>
  );
}
