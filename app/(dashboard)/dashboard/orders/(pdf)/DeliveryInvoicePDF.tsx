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

const NAVY  = "#0f2d4a";
const GRAY  = "#555555";
const BLACK = "#000000";
const LINE  = "#cccccc";

const ACK_LABELS: Array<[string, string]> = [
  ["medicare_supplier_standards", "Medicare Supplier Standards"],
  ["maintenance_cleaning",        "Maintenance & Cleaning Procedures"],
  ["emergency_preparedness",      "Emergency Preparedness"],
  ["training_safe_use",           "Training on Safe Use"],
  ["medical_info_authorization",  "Medical Information Authorization"],
  ["mission_statement",           "Mission Statement"],
  ["complaint_grievance",         "Complaint / Grievance Procedures"],
  ["written_instructions",        "Written Instructions Provided"],
  ["financial_responsibility",    "Financial Responsibility"],
  ["warranty_information",        "Warranty Information Provided"],
  ["repair_return_policy",        "Repair / Return Policy Explained"],
  ["acceptance_of_services",      "Acceptance of Services"],
  ["rights_responsibilities",     "Rights & Responsibilities"],
  ["return_demo",                 "Return Demo Provided"],
  ["participation_plan_of_care",  "Participation in Plan of Care"],
  ["hipaa_privacy",               "HIPAA Privacy Statement"],
  ["capped_rental_info",          "Capped Rental Info"],
  ["patient_rental_purchase_option", "Patient Rental/Purchase Option"],
  ["safety_packet",               "Safety Packet & Home Safety"],
];

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: BLACK,
    paddingTop: 28,
    paddingBottom: 44,
    paddingHorizontal: 36,
    backgroundColor: "#fff",
  },
  invoiceMeta: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 18,
    marginTop: 4,
    marginBottom: 6,
  },
  metaItem: { flexDirection: "row", gap: 4, alignItems: "center" },
  metaLabel: { fontSize: 8, color: GRAY, fontFamily: "Helvetica-Bold" },
  metaVal:   { fontSize: 8, color: BLACK, fontFamily: "Helvetica-Bold", borderBottom: `0.75pt solid #333`, minWidth: 90, paddingBottom: 1 },

  twoCol: { flexDirection: "row", gap: 18 },
  col:    { flex: 1 },

  field:  { marginBottom: 4 },
  label:  { fontSize: 6.5, color: GRAY, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 1 },
  val:    { fontSize: 8.5, color: BLACK, borderBottom: `0.75pt solid #333`, paddingBottom: 1, minHeight: 11 },

  deliveryRow: {
    flexDirection: "row",
    gap: 14,
    marginVertical: 6,
  },
  deliveryItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  // Helvetica at 8pt can't reliably render a single "X" glyph inside a tiny
  // flex-centered box (see PDFComponents.tsx note). Draw the X with two
  // rotated Views in <BoxX> below instead of using a Text element.
  box: { width: 10, height: 10, borderWidth: 0.75, borderColor: BLACK, borderStyle: "solid", position: "relative" },
  xLine: {
    position: "absolute",
    top: 4.25,
    left: -1,
    width: 12,
    height: 1.25,
    backgroundColor: BLACK,
  },
  deliveryLabel: { fontSize: 8, color: BLACK },

  tableHead: {
    flexDirection: "row",
    backgroundColor: "#f3f3f3",
    borderTop: `0.75pt solid #555`,
    borderBottom: `0.75pt solid #555`,
    paddingVertical: 3,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: `0.5pt solid ${LINE}`,
    paddingVertical: 3,
    minHeight: 16,
  },
  th: { fontSize: 7, fontFamily: "Helvetica-Bold", color: NAVY, textAlign: "center" },
  td: { fontSize: 7.5, color: BLACK, textAlign: "center" },
  cDate:  { width: "10%", paddingHorizontal: 2 },
  cQty:   { width: "8%",  paddingHorizontal: 2 },
  cHcpc:  { width: "12%", paddingHorizontal: 2 },
  cDesc:  { flex: 1,      paddingHorizontal: 2, textAlign: "left" },
  cPer:   { width: "12%", paddingHorizontal: 2, textAlign: "right" },
  cTotal: { width: "12%", paddingHorizontal: 2, textAlign: "right" },

  grandTotalRow: {
    flexDirection: "row",
    backgroundColor: "#f3f3f3",
    borderTop: `1pt solid #333`,
    borderBottom: `0.5pt solid ${LINE}`,
    paddingVertical: 4,
  },
  grandTotalLabel: {
    flex: 1,
    paddingHorizontal: 4,
    textAlign: "right",
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: GRAY,
    letterSpacing: 0.4,
  },
  grandTotalVal: {
    width: "12%",
    paddingHorizontal: 2,
    textAlign: "right",
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
  },

  totalsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 18,
    marginTop: 8,
  },
  totalsLabel: { fontSize: 8, color: GRAY, fontFamily: "Helvetica-Bold" },
  totalsVal: { fontSize: 8.5, color: BLACK, fontFamily: "Helvetica-Bold", borderBottom: `0.75pt solid #333`, minWidth: 80, paddingBottom: 1, textAlign: "right" },

  rentRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 6,
    alignItems: "center",
  },
  rentLine: { fontSize: 7, color: GRAY, marginTop: 4, fontStyle: "italic" },

  ackTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: NAVY, marginTop: 10, marginBottom: 3 },
  ackHelp:  { fontSize: 7, color: GRAY, marginBottom: 4 },
  ackGrid:  { flexDirection: "row", flexWrap: "wrap" },
  ackItem:  { flexDirection: "row", alignItems: "center", width: "33.33%", gap: 4, marginBottom: 3 },
  ackLabel: { fontSize: 7, color: BLACK, flexShrink: 1 },

  authTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: NAVY, marginTop: 10, marginBottom: 3 },
  authText:  { fontSize: 7, color: BLACK, lineHeight: 1.45 },

  sigArea: { marginTop: 10 },
  sigLabel: { fontSize: 7, color: GRAY, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.4 },
  sigLine:  { borderBottom: `0.75pt solid #333`, marginTop: 18, marginBottom: 2 },
  sigCaption: { fontSize: 6.5, color: GRAY, fontStyle: "italic" },
  relRow: { flexDirection: "row", gap: 14, marginTop: 6, alignItems: "center" },
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

const v = (val: unknown, fallback = "—") =>
  val != null && val !== "" ? String(val) : fallback;

const fmtMoney = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD" });

// Draws a checkbox, optionally with an X made of two rotated line Views.
// Avoids the react-pdf issue where a single small Text glyph doesn't
// render reliably inside a tiny container.
function BoxX({ checked }: { checked: boolean }) {
  return (
    <View style={s.box}>
      {checked ? (
        <>
          <View style={[s.xLine, { transform: "rotate(45deg)" }]} />
          <View style={[s.xLine, { transform: "rotate(-45deg)" }]} />
        </>
      ) : null}
    </View>
  );
}

interface DeliveryInvoicePDFProps {
  order: any;
  invoice: any;
}

export function DeliveryInvoicePDF({ order, invoice }: DeliveryInvoicePDFProps) {
  const acks: Record<string, boolean> = invoice?.acknowledgements ?? {};

  const lineItems = Array.isArray(invoice?.line_items) ? invoice.line_items : [];

  // Grand total = sum of line totals (or qty × perEach when total is blank).
  // Mirrors the calc in InvoiceDocument so the screen and PDF never drift.
  const grandTotal = lineItems.reduce((sum: number, row: any) => {
    if (row?.total != null) return sum + Number(row.total);
    if (row?.perEach != null && row?.qty != null) {
      return sum + Number(row.perEach) * Number(row.qty);
    }
    return sum;
  }, 0);

  const dm = invoice?.delivery_method as string | null;

  // Clinic name flows in via the order's facility join; falls back to a
  // neutral phrase if missing so the acknowledgement sentence still reads.
  const facility = order?.facility;
  const clinicName: string =
    (Array.isArray(facility) ? facility[0]?.name : facility?.name) ||
    order?.facility_name ||
    "The supplier";

  return (
    <Document>
      <Page size="LETTER" style={s.page} wrap>
        <PDFHeader title="INVOICE" />

        {/* Invoice # + Date */}
        <View style={s.invoiceMeta}>
          <View style={s.metaItem}>
            <Text style={s.metaLabel}>Invoice #</Text>
            <Text style={s.metaVal}>{v(invoice?.invoice_number)}</Text>
          </View>
          <View style={s.metaItem}>
            <Text style={s.metaLabel}>Date</Text>
            <Text style={s.metaVal}>{v(invoice?.invoice_date)}</Text>
          </View>
        </View>

        {/* Customer + Insurance */}
        <View style={s.twoCol}>
          <View style={s.col}>
            <View style={s.field}>
              <Text style={s.label}>Customer Name</Text>
              <Text style={s.val}>{v(invoice?.customer_name)}</Text>
            </View>
            <View style={s.field}>
              <Text style={s.label}>Address</Text>
              <Text style={s.val}>{v(invoice?.address_line_1)}</Text>
            </View>
            <View style={s.field}>
              <Text style={s.label}>Address 2</Text>
              <Text style={s.val}>{v(invoice?.address_line_2)}</Text>
            </View>
            <View style={[s.field, { flexDirection: "row", gap: 6 }]}>
              <View style={{ flex: 2 }}>
                <Text style={s.label}>City</Text>
                <Text style={s.val}>{v(invoice?.city)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>State</Text>
                <Text style={s.val}>{v(invoice?.state)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Zip</Text>
                <Text style={s.val}>{v(invoice?.postal_code)}</Text>
              </View>
            </View>
          </View>

          <View style={s.col}>
            <View style={s.field}>
              <Text style={s.label}>Insurance(s)</Text>
              <Text style={s.val}>{v(invoice?.insurance_name)}</Text>
            </View>
            <View style={s.field}>
              <Text style={s.label}>Insurance #</Text>
              <Text style={s.val}>{v(invoice?.insurance_number)}</Text>
            </View>
            <View style={s.field}>
              <Text style={s.label}>Doctor</Text>
              <Text style={s.val}>{v(invoice?.doctor_name)}</Text>
            </View>
          </View>
        </View>

        {/* Delivery method */}
        <View style={s.deliveryRow}>
          {[
            { v: "home_delivery",     label: "Home Delivery" },
            { v: "patient_picked_up", label: "Patient Picked-Up" },
            { v: "mail_order",        label: "Mail Order" },
            { v: "return",            label: "Return" },
          ].map((opt) => (
            <View key={opt.v} style={s.deliveryItem}>
              <BoxX checked={dm === opt.v} />
              <Text style={s.deliveryLabel}>{opt.label}</Text>
            </View>
          ))}
        </View>

        {/* Line items table */}
        <View style={s.tableHead}>
          <Text style={[s.th, s.cDate]}>Date</Text>
          <Text style={[s.th, s.cQty]}>QTY</Text>
          <Text style={[s.th, s.cHcpc]}>HCPC</Text>
          <Text style={[s.th, s.cDesc, { textAlign: "left" }]}>Description &amp; Lot/Serial Number</Text>
          <Text style={[s.th, s.cPer]}>Per Ea.</Text>
          <Text style={[s.th, s.cTotal]}>Total</Text>
        </View>
        {lineItems.length === 0 ? (
          <View style={s.tableRow}>
            <Text style={[s.td, { flex: 1, fontStyle: "italic", color: GRAY }]}>
              No products on this order.
            </Text>
          </View>
        ) : (
          lineItems.map((row: any, idx: number) => (
            <View key={idx} style={s.tableRow}>
              <Text style={[s.td, s.cDate]}>{v(row.date, "")}</Text>
              <Text style={[s.td, s.cQty]}>{v(row.qty, "")}</Text>
              <Text style={[s.td, s.cHcpc]}>{v(row.hcpc, "")}</Text>
              <Text style={[s.td, s.cDesc]}>{v(row.description, "")}</Text>
              <Text style={[s.td, s.cPer]}>{row.perEach != null ? fmtMoney(row.perEach) : ""}</Text>
              <Text style={[s.td, s.cTotal]}>{row.total != null ? fmtMoney(row.total) : ""}</Text>
            </View>
          ))
        )}

        {/* Grand Total */}
        <View style={s.grandTotalRow}>
          <Text style={s.grandTotalLabel}>GRAND TOTAL</Text>
          <Text style={s.grandTotalVal}>{fmtMoney(grandTotal)}</Text>
        </View>

        {/* Totals */}
        <View style={s.totalsRow}>
          <Text style={s.totalsLabel}>Due / Co-pay</Text>
          <Text style={s.totalsVal}>{fmtMoney(invoice?.due_copay)}</Text>
        </View>
        <View style={s.totalsRow}>
          <Text style={s.totalsLabel}>Total Received</Text>
          <Text style={s.totalsVal}>{fmtMoney(invoice?.total_received)}</Text>
        </View>

        {/* Purchase only — rental is no longer offered, so this is a static,
            pre-checked line rather than a rent-vs-purchase choice. */}
        <Text style={s.rentLine}>
          Medicare allows a rental or purchase of some DME items.
        </Text>
        <View style={s.rentRow}>
          <View style={s.deliveryItem}>
            <BoxX checked={true} />
            <Text style={s.deliveryLabel}>Purchase</Text>
          </View>
        </View>

        {/* Acknowledgements */}
        <Text style={s.ackTitle}>Disclosures Provided</Text>
        <Text style={s.ackHelp}>
          {clinicName} has reviewed the admission package with the
          patient and specifically reviewed and left a copy of the following:
        </Text>
        <View style={s.ackGrid}>
          {ACK_LABELS.map(([key, label]) => (
            <View key={key} style={s.ackItem}>
              <BoxX checked={acks[key] !== false} />
              <Text style={s.ackLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Authorization paragraph */}
        <Text style={s.authTitle}>
          Authorization to Assign Benefits to Provider &amp; Release of Medical Information
        </Text>
        <Text style={s.authText}>
          I request that payment of authorized Medicare/Medicaid/Medicare
          Supplemental/Other Insurers and other benefits be made on my behalf to
          the above company for products and services that they have provided
          for me. I further authorize a copy of this agreement to be used in
          place of the original and authorize any holder of medical information
          about me to release to the Centers for Medicare and Medicaid Services
          and its agents or others any information needed to determine these
          benefits or compliance with current healthcare standards. Meridian
          Surgical Supplies and/or any of our corporate affiliates may obtain
          medical or other information necessary in order to process claims,
          including determining eligibility and seeking reimbursement for
          medical equipment and supplies provided. I agree to pay all amounts
          that are not covered by my Insurers, including applicable co-payments
          and/or deductibles for which I am responsible.
        </Text>

        {/* Signature — embeds the captured patient signature PNG on the
            line when present, formats the signed timestamp, and prints the
            signer name below the line when a caregiver signed on behalf. */}
        {(() => {
          const sigImage = invoice?.patient_signature_image as string | null | undefined;
          const signedAt = invoice?.patient_signed_at as string | null | undefined;
          const signerName = invoice?.signer_name as string | null | undefined;
          const signerReason = invoice?.signer_reason as string | null | undefined;

          const signedAtText = signedAt
            ? new Date(signedAt).toLocaleString("en-US", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "____________________";

          return (
            <View style={s.sigArea}>
              <Text style={s.sigLabel}>Signature of Patient</Text>
              <View
                style={{
                  height: 32,
                  marginTop: 14,
                  justifyContent: "flex-end",
                  alignItems: "flex-start",
                  borderBottom: `0.75pt solid #333`,
                  paddingBottom: 1,
                }}
              >
                {sigImage ? (
                  <Image src={sigImage} style={{ height: 28 }} />
                ) : null}
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
                <Text style={s.sigCaption}>
                  {signerName
                    ? `Signed by ${signerName}${signerReason ? ` — ${signerReason}` : ""}`
                    : "(If signed by caregiver or other, list relationship and reason)"}
                </Text>
                <Text style={s.sigCaption}>Date / Time: {signedAtText}</Text>
              </View>
              <View style={s.relRow}>
                <Text style={s.sigLabel}>Relationship if not patient:</Text>
                {[
                  { v: "spouse_relative", label: "Spouse / Relative" },
                  { v: "caregiver",       label: "Caregiver" },
                  { v: "other",           label: "Other" },
                ].map((opt) => (
                  <View key={opt.v} style={s.deliveryItem}>
                    <BoxX checked={invoice?.relationship === opt.v} />
                    <Text style={s.deliveryLabel}>{opt.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })()}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text>Order #: {v(order?.order_number)}</Text>
          <Text>
            Page <Text render={({ pageNumber, totalPages }) => `${pageNumber} of ${totalPages}`} />
          </Text>
        </View>
      </Page>
    </Document>
  );
}
