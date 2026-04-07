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
    backgroundColor: "#fff",
  },
  title: {
    textAlign: "center",
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  subtitle: {
    textAlign: "center",
    fontSize: 9,
    color: GRAY,
    marginBottom: 16,
  },
  sectionHeader: {
    backgroundColor: DARK,
    color: WHITE,
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    padding: "4 8",
    marginBottom: 0,
    letterSpacing: 0.8,
    textAlign: "center",
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
    fontSize: 7.5,
    color: GRAY,
    width: 130,
    paddingBottom: 1,
  },
  fieldValue: {
    flex: 1,
    fontSize: 9,
    borderBottom: `0.5px solid ${DARK}`,
    paddingBottom: 2,
    minWidth: 80,
  },
  twoCol: {
    flexDirection: "row",
    gap: 12,
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

const f = (v: unknown) =>
  v != null && v !== "" ? String(v) : " ";

const yesNo = (v: boolean | null | undefined) =>
  v === true ? "Yes" : v === false ? "No" : " ";

const money = (v: number | null | undefined) =>
  v != null ? `$${Number(v).toFixed(2)}` : " ";

export function IVRFormPDF({
  order,
  ivr,
  hcfa,
}: {
  order: Record<string, any>;
  ivr: Record<string, any> | null;
  hcfa: Record<string, any> | null;
}) {
  const i = ivr ?? {};
  const patientName = order.patient
    ? `${order.patient.first_name} ${order.patient.last_name}`
    : " ";

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>

        {/* Title */}
        <Text style={styles.title}>INSURANCE VERIFICATION RECORD</Text>
        <Text style={styles.subtitle}>
          Order #{order.order_number}  |  HB Medical Portal  |  Date of Service:{" "}
          {order.date_of_service
            ? new Date(order.date_of_service).toLocaleDateString("en-US")
            : " "}
        </Text>

        {/* Insured Individual Information */}
        <Text style={styles.sectionHeader}>INSURED INDIVIDUAL INFORMATION</Text>
        <View style={styles.sectionBody}>
          <View style={styles.twoCol}>
            <View style={styles.fieldBlock}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Name:</Text>
                <Text style={styles.fieldValue}>{patientName}</Text>
              </View>
            </View>
            <View style={[styles.fieldBlock, { maxWidth: 100 }]}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Sex:</Text>
                <Text style={styles.fieldValue}>{f(hcfa?.patient_sex)}</Text>
              </View>
            </View>
          </View>
          <View style={styles.twoCol}>
            <View style={styles.fieldBlock}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Date of Birth:</Text>
                <Text style={styles.fieldValue}>
                  {order.patient?.date_of_birth
                    ? new Date(order.patient.date_of_birth).toLocaleDateString("en-US")
                    : " "}
                </Text>
              </View>
            </View>
            <View style={styles.fieldBlock}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Social Security Number:</Text>
                <Text style={styles.fieldValue}> </Text>
              </View>
            </View>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Street Address:</Text>
            <Text style={styles.fieldValue}>{f(hcfa?.patient_address)}</Text>
          </View>
          <View style={styles.twoCol}>
            <View style={styles.fieldBlock}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>City:</Text>
                <Text style={styles.fieldValue}>{f(hcfa?.patient_city)}</Text>
              </View>
            </View>
            <View style={[styles.fieldBlock, { maxWidth: 80 }]}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>State:</Text>
                <Text style={styles.fieldValue}>{f(hcfa?.patient_state)}</Text>
              </View>
            </View>
            <View style={[styles.fieldBlock, { maxWidth: 80 }]}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>ZIP:</Text>
                <Text style={styles.fieldValue}>{f(hcfa?.patient_zip)}</Text>
              </View>
            </View>
          </View>
          <View style={styles.twoCol}>
            <View style={styles.fieldBlock}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Phone:</Text>
                <Text style={styles.fieldValue}>{f(hcfa?.patient_phone)}</Text>
              </View>
            </View>
            <View style={styles.fieldBlock}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>E-Mail:</Text>
                <Text style={styles.fieldValue}> </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Insurance Company */}
        <Text style={styles.sectionHeader}>INSURANCE COMPANY</Text>
        <View style={styles.sectionBody}>
          <View style={styles.twoCol}>
            <View style={styles.fieldBlock}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Insurance Company:</Text>
                <Text style={styles.fieldValue}>{f(i.insurance_provider)}</Text>
              </View>
            </View>
            <View style={styles.fieldBlock}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Phone:</Text>
                <Text style={styles.fieldValue}>{f(i.insurance_phone)}</Text>
              </View>
            </View>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Plan Name:</Text>
            <Text style={styles.fieldValue}>{f(i.plan_name)}</Text>
          </View>
          <View style={styles.twoCol}>
            <View style={styles.fieldBlock}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Policy Number:</Text>
                <Text style={styles.fieldValue}>{f(i.member_id)}</Text>
              </View>
            </View>
            <View style={styles.fieldBlock}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Group Number:</Text>
                <Text style={styles.fieldValue}>{f(i.group_number)}</Text>
              </View>
            </View>
          </View>
          <View style={styles.twoCol}>
            <View style={styles.fieldBlock}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Subscriber Name:</Text>
                <Text style={styles.fieldValue}>{f(i.subscriber_name)}</Text>
              </View>
            </View>
            <View style={styles.fieldBlock}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Subscriber DOB:</Text>
                <Text style={styles.fieldValue}>{f(i.subscriber_dob)}</Text>
              </View>
            </View>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Subscriber Relationship to Insured:</Text>
            <Text style={styles.fieldValue}>{f(i.subscriber_relationship)}</Text>
          </View>
        </View>

        {/* Eligibility */}
        <Text style={styles.sectionHeader}>ELIGIBILITY</Text>
        <View style={styles.sectionBody}>
          <View style={styles.twoCol}>
            <View style={styles.fieldBlock}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Coverage Start Date:</Text>
                <Text style={styles.fieldValue}>{f(i.coverage_start_date)}</Text>
              </View>
            </View>
            <View style={styles.fieldBlock}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Coverage End Date:</Text>
                <Text style={styles.fieldValue}>{f(i.coverage_end_date)}</Text>
              </View>
            </View>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Plan Type:</Text>
            <Text style={styles.fieldValue}>{f(i.plan_type)}</Text>
          </View>
          <View style={styles.twoCol}>
            <View style={styles.fieldBlock}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Deductible:</Text>
                <Text style={styles.fieldValue}>{money(i.deductible_amount)}</Text>
              </View>
            </View>
            <View style={styles.fieldBlock}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Deductible Amount Met:</Text>
                <Text style={styles.fieldValue}>{money(i.deductible_met)}</Text>
              </View>
            </View>
          </View>
          <View style={styles.twoCol}>
            <View style={styles.fieldBlock}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Copayment:</Text>
                <Text style={styles.fieldValue}>{money(i.copay_amount)}</Text>
              </View>
            </View>
            <View style={styles.fieldBlock}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Coinsurance:</Text>
                <Text style={styles.fieldValue}>
                  {i.coinsurance_percent != null ? `${i.coinsurance_percent}%` : " "}
                </Text>
              </View>
            </View>
            <View style={styles.fieldBlock}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Out-of-Pocket Limit:</Text>
                <Text style={styles.fieldValue}>{money(i.out_of_pocket_max)}</Text>
              </View>
            </View>
          </View>
          <View style={styles.twoCol}>
            <View style={styles.fieldBlock}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Out-of-Pocket Met:</Text>
                <Text style={styles.fieldValue}>{money(i.out_of_pocket_met)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* DME / Wound Care Coverage */}
        <Text style={styles.sectionHeader}>DME / WOUND CARE COVERAGE</Text>
        <View style={styles.sectionBody}>
          <View style={styles.twoCol}>
            <View style={styles.fieldBlock}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>DME Covered:</Text>
                <Text style={styles.fieldValue}>{yesNo(i.dme_covered)}</Text>
              </View>
            </View>
            <View style={styles.fieldBlock}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Wound Care Covered:</Text>
                <Text style={styles.fieldValue}>{yesNo(i.wound_care_covered)}</Text>
              </View>
            </View>
          </View>
          <View style={styles.twoCol}>
            <View style={styles.fieldBlock}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Prior Auth Required:</Text>
                <Text style={styles.fieldValue}>{yesNo(i.prior_auth_required)}</Text>
              </View>
            </View>
            <View style={styles.fieldBlock}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Prior Auth Number:</Text>
                <Text style={styles.fieldValue}>{f(i.prior_auth_number)}</Text>
              </View>
            </View>
          </View>
          <View style={styles.twoCol}>
            <View style={styles.fieldBlock}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Auth Start:</Text>
                <Text style={styles.fieldValue}>{f(i.prior_auth_start_date)}</Text>
              </View>
            </View>
            <View style={styles.fieldBlock}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Auth End:</Text>
                <Text style={styles.fieldValue}>{f(i.prior_auth_end_date)}</Text>
              </View>
            </View>
            <View style={styles.fieldBlock}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Units Authorized:</Text>
                <Text style={styles.fieldValue}>{f(i.units_authorized)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Verification Details */}
        <Text style={styles.sectionHeader}>VERIFICATION DETAILS</Text>
        <View style={styles.sectionBody}>
          <View style={styles.twoCol}>
            <View style={styles.fieldBlock}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Verified By:</Text>
                <Text style={styles.fieldValue}>{f(i.verified_by)}</Text>
              </View>
            </View>
            <View style={styles.fieldBlock}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Verified Date:</Text>
                <Text style={styles.fieldValue}>{f(i.verified_date)}</Text>
              </View>
            </View>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Reference Number:</Text>
            <Text style={styles.fieldValue}>{f(i.verification_reference)}</Text>
          </View>
          {i.notes && (
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
          )}
        </View>

        {/* Signature */}
        <View
          style={{
            marginTop: 20,
            paddingTop: 12,
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

        <View style={styles.footer} fixed>
          <Text>HB Medical Portal — Insurance Verification Record</Text>
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
