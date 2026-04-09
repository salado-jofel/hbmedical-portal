import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

const BLUE  = "#0f2d4a";
const GRAY  = "#6B7280";
const LGRAY = "#F3F4F6";
const BLACK = "#111827";
const LINE  = "#E5E7EB";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: BLACK,
    padding: 40,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    paddingBottom: 12,
    borderBottom: `2px solid ${BLUE}`,
  },
  brandName: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: BLUE,
  },
  formTitle: {
    fontSize: 11,
    color: GRAY,
    marginTop: 2,
  },
  orderMeta: {
    fontSize: 8,
    color: GRAY,
    textAlign: "right",
  },
  section: {
    marginBottom: 14,
  },
  sectionHeader: {
    backgroundColor: BLUE,
    color: "#fff",
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    padding: "4 8",
    marginBottom: 6,
    letterSpacing: 0.8,
  },
  row: {
    flexDirection: "row",
    marginBottom: 5,
    paddingBottom: 4,
    borderBottom: `0.5px solid ${LINE}`,
  },
  label: {
    width: 140,
    fontSize: 7.5,
    color: GRAY,
    fontFamily: "Helvetica-Bold",
    paddingTop: 1,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  value: {
    flex: 1,
    fontSize: 9,
    color: BLACK,
  },
  textBlock: {
    backgroundColor: LGRAY,
    padding: 8,
    borderRadius: 2,
    marginTop: 4,
    fontSize: 8.5,
    lineHeight: 1.5,
  },
  symptomPill: {
    backgroundColor: "#DBEAFE",
    color: BLUE,
    fontSize: 8,
    padding: "3 8",
    borderRadius: 10,
    marginRight: 5,
    marginBottom: 4,
  },
  symptomsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
  },
  signatureSection: {
    marginTop: 30,
    paddingTop: 16,
    borderTop: `1px solid ${LINE}`,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signatureLine: {
    borderBottom: `1px solid ${BLACK}`,
    width: 200,
    marginTop: 20,
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
});

const val = (v: unknown, fallback = "—") =>
  v != null && v !== "" ? String(v) : fallback;

const yesNo = (v: boolean | null | undefined) =>
  v === true ? "Yes" : v === false ? "No" : "—";

export function OrderFormPDF({
  order,
  form,
}: {
  order: Record<string, any>;
  form: Record<string, any> | null;
}) {
  const patientName = order.patient
    ? `${order.patient.first_name} ${order.patient.last_name}`
    : "—";

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandName}>HB MEDICAL</Text>
            <Text style={styles.formTitle}>CLINICAL ORDER FORM</Text>
          </View>
          <View style={styles.orderMeta}>
            <Text>Order #: {val(order.order_number)}</Text>
            <Text style={{ marginTop: 3 }}>
              Date of Service:{" "}
              {order.date_of_service
                ? new Date(order.date_of_service).toLocaleDateString("en-US")
                : "—"}
            </Text>
            <Text style={{ marginTop: 3 }}>
              Facility: {order.facility?.name ?? "—"}
            </Text>
          </View>
        </View>

        {/* Patient Information */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>PATIENT INFORMATION</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Patient Name</Text>
            <Text style={styles.value}>{patientName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Date of Birth</Text>
            <Text style={styles.value}>
              {order.patient?.date_of_birth
                ? new Date(order.patient.date_of_birth).toLocaleDateString("en-US")
                : "—"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Wound Type</Text>
            <Text style={styles.value}>
              {order.wound_type === "chronic"
                ? "Chronic Wound"
                : order.wound_type === "post_surgical"
                  ? "Post-Surgical Wound"
                  : val(order.wound_type)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Wound Visit #</Text>
            <Text style={styles.value}>
              {form?.wound_visit_number ? `#${form.wound_visit_number}` : "—"}
            </Text>
          </View>
        </View>

        {/* Clinical Assessment */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>CLINICAL ASSESSMENT</Text>
          <View style={styles.row}>
            <Text style={styles.label}>ICD-10 Code</Text>
            <Text style={styles.value}>{val(form?.icd10_code)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Wound Site</Text>
            <Text style={styles.value}>{val(form?.wound_site)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Wound Stage</Text>
            <Text style={styles.value}>{val(form?.wound_stage)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Wound Measurements</Text>
            <Text style={styles.value}>
              {form?.wound_length_cm
                ? `L: ${form.wound_length_cm}cm  ×  W: ${form.wound_width_cm}cm  ×  D: ${form.wound_depth_cm}cm`
                : "—"}
            </Text>
          </View>
          <View style={{ marginTop: 6 }}>
            <Text style={[styles.label, { marginBottom: 4 }]}>Chief Complaint</Text>
            <View style={styles.textBlock}>
              <Text>{val(form?.chief_complaint, "Not provided")}</Text>
            </View>
          </View>
        </View>

        {/* Clinical Questions */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>CLINICAL QUESTIONS</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Vasculitis / Burns</Text>
            <Text style={styles.value}>{yesNo(form?.has_vasculitis_or_burns)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Receiving Home Health</Text>
            <Text style={styles.value}>{yesNo(form?.is_receiving_home_health)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Patient at SNF</Text>
            <Text style={styles.value}>{yesNo(form?.is_patient_at_snf)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Follow-up</Text>
            <Text style={styles.value}>
              {form?.followup_days ? `${form.followup_days} days` : "—"}
            </Text>
          </View>
        </View>

        {/* Subjective Symptoms */}
        {form != null && (form.subjective_symptoms as string[])?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>SUBJECTIVE SYMPTOMS</Text>
            <View style={styles.symptomsRow}>
              {(form.subjective_symptoms as string[]).map((s, i) => (
                <View key={i} style={styles.symptomPill}>
                  <Text>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Clinical Notes */}
        {form?.clinical_notes && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>CLINICAL NOTES</Text>
            <View style={styles.textBlock}>
              <Text>{form.clinical_notes}</Text>
            </View>
          </View>
        )}

        {/* Signature */}
        <View style={styles.signatureSection}>
          <View>
            <Text style={{ fontSize: 8, color: GRAY, marginBottom: 4 }}>
              Provider Signature
            </Text>
            <View style={styles.signatureLine} />
            <Text style={{ fontSize: 7, color: GRAY, marginTop: 4 }}>
              Authorized Provider Signature
            </Text>
          </View>
          <View>
            <Text style={{ fontSize: 8, color: GRAY, marginBottom: 4 }}>Date</Text>
            <View style={[styles.signatureLine, { width: 120 }]} />
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>HB Medical Portal — Clinical Order Form</Text>
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
