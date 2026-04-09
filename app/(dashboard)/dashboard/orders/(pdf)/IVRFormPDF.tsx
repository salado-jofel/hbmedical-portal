import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

const DARK  = "#1F2937";
const GRAY  = "#6B7280";
const LGRAY = "#F9FAFB";
const LINE  = "#D1D5DB";
const WHITE = "#FFFFFF";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    padding: 40,
    paddingBottom: 60,
    backgroundColor: "#fff",
  },
  title: {
    textAlign: "center",
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginBottom: 3,
  },
  subtitle: {
    textAlign: "center",
    fontSize: 8,
    color: GRAY,
    marginBottom: 14,
  },
  sectionHeader: {
    backgroundColor: DARK,
    color: WHITE,
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    padding: "4 8",
    marginBottom: 0,
    letterSpacing: 0.8,
    marginTop: 10,
  },
  sectionBody: {
    border: `1px solid ${LINE}`,
    padding: "8 10",
    backgroundColor: LGRAY,
  },
  fieldRow: {
    flexDirection: "row",
    marginBottom: 6,
    alignItems: "flex-end",
  },
  fieldLabel: {
    fontSize: 7,
    color: GRAY,
    width: 120,
    paddingBottom: 1,
    flexShrink: 0,
  },
  fieldValue: {
    flex: 1,
    fontSize: 8.5,
    borderBottom: `0.5px solid ${DARK}`,
    paddingBottom: 2,
    minWidth: 60,
  },
  twoCol: {
    flexDirection: "row",
    gap: 10,
  },
  fieldBlock: {
    flex: 1,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: GRAY,
    borderTop: `0.5px solid ${LINE}`,
    paddingTop: 6,
  },
  signatureLine: {
    borderBottom: `1px solid ${DARK}`,
    marginTop: 20,
    width: 200,
  },
});

/* ---------- helpers ---------- */

const f = (v: unknown): string =>
  v != null && v !== "" ? String(v) : "—";

const yesNo = (v: boolean | null | undefined): string =>
  v === true ? "Yes" : v === false ? "No" : "—";

const money = (v: number | null | undefined): string =>
  v != null ? `$${Number(v).toFixed(2)}` : "—";

const pct = (v: number | null | undefined): string =>
  v != null ? `${v}%` : "—";

const fmtDate = (v: string | null | undefined): string => {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString("en-US");
  } catch {
    return v;
  }
};

/* ---------- building blocks ---------- */

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}:</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

function TwoColRows({
  left,
  right,
}: {
  left: { label: string; value: string };
  right: { label: string; value: string };
}) {
  return (
    <View style={styles.twoCol}>
      <View style={styles.fieldBlock}>
        <Row label={left.label} value={left.value} />
      </View>
      <View style={styles.fieldBlock}>
        <Row label={right.label} value={right.value} />
      </View>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title.toUpperCase()}</Text>;
}

/* ---------- PDF component ---------- */

export function IVRFormPDF({
  order,
  ivr,
  form,
  physicianName,
}: {
  order: Record<string, any>;
  ivr: Record<string, any> | null;
  form: Record<string, any> | null;
  physicianName?: string | null;
}) {
  const i = ivr ?? {};
  const orderForm = form ?? {};

  const patientFirst  = order.patient?.first_name ?? "";
  const patientLast   = order.patient?.last_name  ?? "";
  const fallbackPatientName = patientFirst || patientLast
    ? `${patientFirst} ${patientLast}`.trim()
    : null;

  // Override fields: prefer ivr DB values, fall back to source table values
  const displayFacilityName  = i.facility_name   || order.facility?.name || "—";
  const displayPhysicianName = i.physician_name  || physicianName || "—";
  const displayPatientName   = i.patient_name    || fallbackPatientName || "—";
  const displayPatientDob    = i.patient_dob
    ? fmtDate(i.patient_dob)
    : order.patient?.date_of_birth
      ? fmtDate(order.patient.date_of_birth)
      : "—";

  const dateOfService = order.date_of_service
    ? fmtDate(order.date_of_service)
    : "—";

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>

        {/* ── Header ── */}
        <Text style={styles.title}>Patient Insurance Support Form</Text>
        <Text style={styles.subtitle}>
          HB Medical Portal  |  Order #{order.order_number ?? "—"}  |  Date of Service: {dateOfService}
        </Text>

        {/* ── 1. Facility Information ── */}
        <SectionHeader title="Facility Information" />
        <View style={styles.sectionBody}>
          <TwoColRows
            left={{ label: "Place of Service",           value: f(i.place_of_service) }}
            right={{ label: "Facility Name",              value: displayFacilityName }}
          />
          <TwoColRows
            left={{ label: "Medicare Admin Contractor",   value: f(i.medicare_admin_contractor) }}
            right={{ label: "NPI",                        value: f(i.facility_npi) }}
          />
          <TwoColRows
            left={{ label: "TIN",                         value: f(i.facility_tin) }}
            right={{ label: "PTAN",                       value: f(i.facility_ptan) }}
          />
          <TwoColRows
            left={{ label: "Fax",                         value: f(i.facility_fax) }}
            right={{ label: "",                           value: "" }}
          />
        </View>

        {/* ── 2. Physician Information ── */}
        <SectionHeader title="Physician Information" />
        <View style={styles.sectionBody}>
          <TwoColRows
            left={{ label: "Physician Name",   value: displayPhysicianName }}
            right={{ label: "TIN",             value: f(i.physician_tin) }}
          />
          <TwoColRows
            left={{ label: "Fax",             value: f(i.physician_fax) }}
            right={{ label: "Address",         value: f(i.physician_address) }}
          />
        </View>

        {/* ── 3. Patient Information ── */}
        <SectionHeader title="Patient Information" />
        <View style={styles.sectionBody}>
          <TwoColRows
            left={{ label: "Patient Name",       value: displayPatientName }}
            right={{ label: "Date of Birth",      value: displayPatientDob }}
          />
          <TwoColRows
            left={{ label: "Phone",              value: f(i.patient_phone) }}
            right={{ label: "Address",            value: f(i.patient_address) }}
          />
          <Row label="OK to Contact Patient" value={yesNo(i.ok_to_contact_patient)} />
        </View>

        {/* ── 4. Primary Insurance ── */}
        <SectionHeader title="Primary Insurance" />
        <View style={styles.sectionBody}>
          <TwoColRows
            left={{ label: "Insurance Provider",         value: f(i.insurance_provider) }}
            right={{ label: "Insurance Phone",           value: f(i.insurance_phone) }}
          />
          <TwoColRows
            left={{ label: "Subscriber Name",            value: f(i.subscriber_name) }}
            right={{ label: "Policy / Member ID",        value: f(i.member_id) }}
          />
          <TwoColRows
            left={{ label: "Subscriber DOB",             value: f(i.subscriber_dob) }}
            right={{ label: "Group Number",              value: f(i.group_number) }}
          />
          <TwoColRows
            left={{ label: "Plan Type",                  value: f(i.plan_type) }}
            right={{ label: "Plan Name",                 value: f(i.plan_name) }}
          />
          <TwoColRows
            left={{ label: "Subscriber Relationship",    value: f(i.subscriber_relationship) }}
            right={{ label: "Provider Participates",     value: f(i.provider_participates_primary) }}
          />
          <TwoColRows
            left={{ label: "Coverage Start Date",        value: f(i.coverage_start_date) }}
            right={{ label: "Coverage End Date",         value: f(i.coverage_end_date) }}
          />
        </View>

        {/* ── 5. Secondary Insurance ── */}
        <SectionHeader title="Secondary Insurance" />
        <View style={styles.sectionBody}>
          <TwoColRows
            left={{ label: "Insurance Provider",         value: f(i.secondary_insurance_provider) }}
            right={{ label: "Insurance Phone",           value: f(i.secondary_insurance_phone) }}
          />
          <TwoColRows
            left={{ label: "Subscriber Name",            value: f(i.secondary_subscriber_name) }}
            right={{ label: "Policy Number",             value: f(i.secondary_policy_number) }}
          />
          <TwoColRows
            left={{ label: "Subscriber DOB",             value: f(i.secondary_subscriber_dob) }}
            right={{ label: "Group Number",              value: f(i.secondary_group_number) }}
          />
          <TwoColRows
            left={{ label: "Plan Type",                  value: f(i.secondary_plan_type) }}
            right={{ label: "Subscriber Relationship",   value: f(i.secondary_subscriber_relationship) }}
          />
          <Row label="Provider Participates" value={f(i.provider_participates_secondary)} />
        </View>

        {/* ── 6. Benefits & Coverage ── */}
        <SectionHeader title="Benefits & Coverage" />
        <View style={styles.sectionBody}>
          <TwoColRows
            left={{ label: "Deductible Amount",   value: money(i.deductible_amount) }}
            right={{ label: "Deductible Met",     value: money(i.deductible_met) }}
          />
          <TwoColRows
            left={{ label: "Out of Pocket Max",   value: money(i.out_of_pocket_max) }}
            right={{ label: "Out of Pocket Met",  value: money(i.out_of_pocket_met) }}
          />
          <TwoColRows
            left={{ label: "Copay",               value: money(i.copay_amount) }}
            right={{ label: "Coinsurance",        value: pct(i.coinsurance_percent) }}
          />
          <TwoColRows
            left={{ label: "DME Covered",         value: yesNo(i.dme_covered) }}
            right={{ label: "Wound Care Covered", value: yesNo(i.wound_care_covered) }}
          />
        </View>

        {/* ── 7. Prior Authorization ── */}
        <SectionHeader title="Prior Authorization" />
        <View style={styles.sectionBody}>
          <TwoColRows
            left={{ label: "Prior Auth Required",           value: yesNo(i.prior_auth_required) }}
            right={{ label: "Auth Number",                  value: f(i.prior_auth_number) }}
          />
          <TwoColRows
            left={{ label: "Auth Start Date",               value: f(i.prior_auth_start_date) }}
            right={{ label: "Auth End Date",                value: f(i.prior_auth_end_date) }}
          />
          <TwoColRows
            left={{ label: "Units Authorized",              value: f(i.units_authorized) }}
            right={{ label: "Permission to Work with Payer", value: yesNo(i.prior_auth_permission) }}
          />
        </View>

        {/* ── 8. Wound & Procedure ── */}
        <SectionHeader title="Wound & Procedure" />
        <View style={styles.sectionBody}>
          <TwoColRows
            left={{ label: "Wound Type",              value: f(order.wound_type) }}
            right={{ label: "Date of Procedure",      value: dateOfService }}
          />
          <TwoColRows
            left={{ label: "ICD-10 Code(s)",          value: f(orderForm.icd10_code) }}
            right={{ label: "Application CPTs",       value: f(i.application_cpts) }}
          />
          <TwoColRows
            left={{ label: "Surgical Global Period",  value: yesNo(i.surgical_global_period) }}
            right={{ label: "Global Period CPT",      value: f(i.global_period_cpt) }}
          />
        </View>

        {/* ── 9. Additional Information ── */}
        <SectionHeader title="Additional Information" />
        <View style={styles.sectionBody}>
          <TwoColRows
            left={{ label: "Patient in SNF",          value: yesNo(orderForm.is_patient_at_snf) }}
            right={{ label: "Specialty Site Name",    value: f(i.specialty_site_name) }}
          />
        </View>

        {/* ── 10. Verification ── */}
        <SectionHeader title="Verification" />
        <View style={styles.sectionBody}>
          <TwoColRows
            left={{ label: "Verified By",             value: f(i.verified_by) }}
            right={{ label: "Verified Date",          value: f(i.verified_date) }}
          />
          <Row label="Reference Number" value={f(i.verification_reference)} />
          {i.notes ? (
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Notes:</Text>
              <Text
                style={[
                  styles.fieldValue,
                  { borderBottom: "none", backgroundColor: "#F3F4F6", padding: 4 },
                ]}
              >
                {i.notes}
              </Text>
            </View>
          ) : (
            <Row label="Notes" value="—" />
          )}
        </View>

        {/* ── Signature ── */}
        <View
          style={{
            marginTop: 16,
            paddingTop: 10,
            borderTop: `1px solid ${LINE}`,
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          <View>
            <View style={styles.signatureLine} />
            <Text style={{ fontSize: 7, color: GRAY, marginTop: 3 }}>Signature</Text>
            <View style={[styles.signatureLine, { marginTop: 8 }]} />
            <Text style={{ fontSize: 7, color: GRAY, marginTop: 3 }}>Print Name</Text>
          </View>
          <View>
            <View style={[styles.signatureLine, { width: 120 }]} />
            <Text style={{ fontSize: 7, color: GRAY, marginTop: 3 }}>Date</Text>
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer} fixed>
          <Text>HB Medical Portal — Patient Insurance Support Form</Text>
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
