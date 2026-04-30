"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Mail, Globe, Phone, PenLine, Check, Info } from "lucide-react";
import toast from "react-hot-toast";
import { MeridianLogo } from "@/app/(components)/MeridianLogo";
import { FormActionBar } from "./FormActionBar";
import { CapturePatientSignatureModal } from "./CapturePatientSignatureModal";
import {
  upsertOrderDeliveryInvoice,
  getOrderDeliveryInvoice,
} from "../(services)/order-delivery-invoice-actions";
import { canCapturePatientSignature, isOrderFullyLocked } from "@/utils/constants/orders";
import { useFormCollaboration } from "./useFormCollaboration";
import { FormCollaborationStatus } from "./FormCollaborationStatus";
import type {
  AcknowledgementMap,
  DashboardOrder,
  DeliveryMethod,
  IDeliveryInvoice,
  IDeliveryInvoiceLineItem,
} from "@/utils/interfaces/orders";

const NAVY = "#0f2d4a";
const TEAL = "#0d7a6b";

const DELIVERY_OPTIONS: { value: DeliveryMethod; label: string }[] = [
  { value: "home_delivery",     label: "Home Delivery" },
  { value: "patient_picked_up", label: "Patient Picked-Up" },
  { value: "mail_order",        label: "Mail Order" },
  { value: "return",            label: "Return" },
];

// Three-column grid in the printed form. Order kept identical to the PDF so
// what the user sees here matches what gets generated.
const ACKNOWLEDGEMENTS: Array<{ key: string; label: string }> = [
  { key: "medicare_supplier_standards",    label: "Medicare Supplier Standards" },
  { key: "maintenance_cleaning",           label: "Maintenance & Cleaning" },
  { key: "emergency_preparedness",         label: "Emergency Preparedness" },
  { key: "training_safe_use",              label: "Training on Safe Use" },
  { key: "medical_info_authorization",     label: "Medical Info Authorization" },
  { key: "mission_statement",              label: "Mission Statement" },
  { key: "complaint_grievance",            label: "Complaint / Grievance" },
  { key: "written_instructions",           label: "Written Instructions" },
  { key: "financial_responsibility",       label: "Financial Responsibility" },
  { key: "warranty_information",           label: "Warranty Info" },
  { key: "repair_return_policy",           label: "Repair / Return Policy" },
  { key: "acceptance_of_services",         label: "Acceptance of Services" },
  { key: "rights_responsibilities",        label: "Rights & Responsibilities" },
  { key: "return_demo",                    label: "Return Demo Provided" },
  { key: "participation_plan_of_care",     label: "Participation in Plan of Care" },
  { key: "hipaa_privacy",                  label: "HIPAA Privacy" },
  { key: "capped_rental_info",             label: "Capped Rental Info" },
  { key: "patient_rental_purchase_option", label: "Patient Rental/Purchase Option" },
  { key: "safety_packet",                  label: "Safety Packet & Home Safety" },
];

interface InvoiceDocumentProps {
  order: DashboardOrder;
  initialInvoice: IDeliveryInvoice;
  /** Display name for the current viewer — drives presence chips. */
  currentUserName?: string | null;
  onDirtyChange?: (dirty: boolean) => void;
  isAdmin?: boolean;
  isProvider?: boolean;
  /**
   * `true` for clinical_staff users — provider's staff can also capture
   * the patient signature on the provider's behalf at hand-off.
   */
  isClinicalStaff?: boolean;
  /** Called when the patient-signature capture modal commits a new invoice. */
  onInvoiceUpdated?: (invoice: IDeliveryInvoice) => void;
}

export function InvoiceDocument({
  order,
  initialInvoice,
  currentUserName = null,
  onDirtyChange,
  isAdmin = false,
  isProvider = false,
  isClinicalStaff = false,
  onInvoiceUpdated,
}: InvoiceDocumentProps) {
  // Snapshot baseline state — comparison-based dirty tracking matches the
  // pattern used by OrderFormDocument / IVRFormDocument.
  const [invoice, setInvoice] = useState<IDeliveryInvoice>(initialInvoice);
  const [isPending, setIsPending] = useState(false);
  const [reloading, setReloading] = useState(false);
  // Conflict cursor — last `updated_at` we synced with. Drives the
  // ifMatch check on save and equality check on incoming realtime updates.
  const [localUpdatedAt, setLocalUpdatedAt] = useState<string | null>(
    initialInvoice.updatedAt ?? null,
  );
  const baselineRef = useRef<IDeliveryInvoice>(initialInvoice);

  const isDirty = useMemo(
    () => JSON.stringify(invoice) !== JSON.stringify(baselineRef.current),
    [invoice],
  );

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  /* ── Realtime collaboration ── subscribes to UPDATEs on
     order_delivery_invoices for this order and tracks who else is viewing. */
  const collab = useFormCollaboration({
    table: "order_delivery_invoices",
    channelKey: "invoice",
    orderId: order.id,
    userName: currentUserName,
    localUpdatedAt,
  });

  /* ── Invoice PDF regen helper. Mirrors the same `pdf-regenerating` events
     the right-side document card listens for. */
  const regenerateInvoicePdf = useCallback(async (): Promise<{
    ok: boolean;
    error?: string;
  }> => {
    window.dispatchEvent(
      new CustomEvent("pdf-regenerating", {
        detail: { type: "delivery_invoice", status: "start" },
      }),
    );
    try {
      const pdfRes = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, formType: "delivery_invoice" }),
      });
      if (!pdfRes.ok) {
        return { ok: false, error: `PDF generation failed (${pdfRes.status})` };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Unknown" };
    } finally {
      window.dispatchEvent(
        new CustomEvent("pdf-regenerating", {
          detail: { type: "delivery_invoice", status: "done" },
        }),
      );
    }
  }, [order.id]);

  /* ── Reload from server ── refetches the invoice (including the prefill
     heal pass), refreshes the conflict cursor, and triggers PDF regen. */
  const handleReload = useCallback(async () => {
    setReloading(true);
    try {
      const { invoice: fresh } = await getOrderDeliveryInvoice(order.id);
      if (fresh) {
        baselineRef.current = fresh;
        setInvoice(fresh);
        setLocalUpdatedAt(fresh.updatedAt ?? null);
        onInvoiceUpdated?.(fresh);
      }
      collab.acknowledgeRemoteChange();
      void regenerateInvoicePdf();
    } finally {
      setReloading(false);
    }
  }, [order.id, collab, regenerateInvoicePdf, onInvoiceUpdated]);

  // Silent auto-refresh when no local edits are pending.
  useEffect(() => {
    if (collab.remoteChangedSinceLoad && !isDirty) {
      void handleReload();
    }
  }, [collab.remoteChangedSinceLoad, isDirty, handleReload]);

  // Controls the patient-signature capture modal.
  const [captureOpen, setCaptureOpen] = useState(false);

  // Derived lock state for non-admins: after the patient signs, or once the
  // order has progressed past manufacturer_review, the whole invoice (and
  // the rest of the order) becomes read-only. Admin bypasses entirely.
  const orderStatus = (order as unknown as { order_status?: string }).order_status;
  const locked = isOrderFullyLocked(orderStatus, invoice.patientSignedAt, isAdmin);

  // Patient signing is provider/staff territory only — admin (even though
  // they bypass other lock rules) cannot capture the proof-of-delivery
  // signature. See canCapturePatientSignature comments in
  // utils/constants/orders.ts for the reasoning.
  const effectiveRole = isProvider
    ? "clinical_provider"
    : isClinicalStaff
      ? "clinical_staff"
      : null;
  const canCapture = canCapturePatientSignature({
    status: orderStatus,
    role: effectiveRole,
    isAdmin,
  });
  const captureGateMessage =
    orderStatus !== "shipped"
      ? "Available once the order is shipped."
      : !isProvider && !isClinicalStaff
        ? "Only the clinical provider or their staff can capture the patient's signature."
        : null;

  function update<K extends keyof IDeliveryInvoice>(key: K, value: IDeliveryInvoice[K]) {
    setInvoice((prev) => ({ ...prev, [key]: value }));
  }

  function toggleAck(key: string) {
    setInvoice((prev) => ({
      ...prev,
      acknowledgements: { ...prev.acknowledgements, [key]: !prev.acknowledgements[key] },
    }));
  }

  function updateLineItem(idx: number, patch: Partial<IDeliveryInvoiceLineItem>) {
    setInvoice((prev) => {
      const next = [...prev.lineItems];
      while (next.length <= idx) {
        next.push({ date: null, qty: null, hcpc: null, description: null, perEach: null, total: null });
      }
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, lineItems: next };
    });
  }

  function discard() {
    setInvoice(baselineRef.current);
  }

  async function save() {
    setIsPending(true);
    try {
      const res = await upsertOrderDeliveryInvoice(
        order.id,
        {
          invoiceNumber:    invoice.invoiceNumber,
          invoiceDate:      invoice.invoiceDate,
          customerName:     invoice.customerName,
          addressLine1:     invoice.addressLine1,
          addressLine2:     invoice.addressLine2,
          city:             invoice.city,
          state:            invoice.state,
          postalCode:       invoice.postalCode,
          insuranceName:    invoice.insuranceName,
          insuranceNumber:  invoice.insuranceNumber,
          doctorName:       invoice.doctorName,
          deliveryMethod:   invoice.deliveryMethod,
          lineItems:        invoice.lineItems,
          // Rent is no longer offered — we only sell. Always persist "purchase".
          rentOrPurchase:   "purchase",
          dueCopay:         invoice.dueCopay,
          totalReceived:    invoice.totalReceived,
          acknowledgements: invoice.acknowledgements,
        },
        localUpdatedAt,
      );
      if (!res.success || !res.invoice) {
        // Conflict: another user saved while we were editing. Keep local
        // edits and surface the banner via FormCollaborationStatus.
        if (res.conflict) {
          toast.error(
            res.error ?? "Someone else just saved this form. Reload to see their changes.",
          );
        } else {
          toast.error(res.error ?? "Failed to save invoice.");
        }
        return;
      }
      baselineRef.current = res.invoice;
      setInvoice(res.invoice);
      if (res.updatedAt) setLocalUpdatedAt(res.updatedAt);
      toast.success("Invoice saved.");

      // Kick PDF regen via the shared helper — same `pdf-regenerating`
      // events the document card listens for. Fire-and-forget.
      void regenerateInvoicePdf();
    } finally {
      setIsPending(false);
    }
  }

  // Content-adaptive: render exactly the rows the invoice actually has.
  // Zero line items → empty state below the header instead of padded blanks.
  const visibleLineItems = invoice.lineItems;

  // Grand total = sum of filled line-item totals. Derived, not stored —
  // PDF computes the same way so the two never drift.
  const grandTotal = useMemo(
    () =>
      invoice.lineItems.reduce((sum, row) => {
        if (row.total != null) return sum + Number(row.total);
        if (row.perEach != null && row.qty != null) {
          return sum + Number(row.perEach) * Number(row.qty);
        }
        return sum;
      }, 0),
    [invoice.lineItems],
  );

  return (
    <div>
      <FormActionBar
        label="Invoice"
        isDirty={isDirty}
        isPending={isPending}
        onSave={save}
        onDiscard={discard}
      />

      <FormCollaborationStatus
        viewers={collab.viewers}
        conflict={collab.remoteChangedSinceLoad && isDirty}
        reloading={reloading}
        onReload={handleReload}
      />

      {/* PAPER DOCUMENT */}
      <div
        className="mx-auto bg-white border border-[#ddd] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
        style={{ maxWidth: 800, padding: "28px 32px", fontFamily: "system-ui, sans-serif" }}
      >
        {/* HEADER (mirrors OrderFormDocument exactly for visual uniformity) */}
        <div className="flex items-start justify-between pb-3 border-b border-[#e5e5e5]">
          <div className="flex items-center gap-3">
            <div className="[&>span>span:last-child]:hidden shrink-0">
              <MeridianLogo variant="light" size="lg" asLink={false} />
            </div>
            <div>
              <div className="text-[17px] font-bold tracking-widest leading-none" style={{ color: NAVY }}>
                MERIDIAN
              </div>
              <div className="text-[10px] font-semibold tracking-wider leading-tight mt-0.5" style={{ color: TEAL }}>
                SURGICAL SUPPLIES
              </div>
              <div className="text-[9px] font-semibold uppercase tracking-widest mt-0.5 leading-tight" style={{ color: TEAL }}>
                Empowering Patients From Their Home
              </div>
            </div>
          </div>
          <div className="text-right space-y-0.5">
            {[
              { Icon: MapPin, text: "235 Singleton Ridge Road Suite 105, Conway SC 29526" },
              { Icon: Mail,   text: "Support@meridiansurgicalsupplies.com" },
              { Icon: Globe,  text: "www.meridiansurgicalsupplies.com" },
              { Icon: Phone,  text: "(843) 733-9261" },
            ].map(({ Icon, text }) => (
              <div key={text} className="flex items-center justify-end gap-1 text-[10px] text-[#555]">
                <Icon className="w-2.5 h-2.5 shrink-0" />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* TITLE */}
        <div className="text-center py-2.5">
          <h1 className="font-serif text-[18px] font-medium tracking-wide" style={{ color: NAVY }}>
            INVOICE
          </h1>
          <div className="mx-auto mt-1.5 w-28 border-b-2" style={{ borderColor: TEAL }} />
        </div>

        {/* Everything below is field-editable only while the order is not
            yet locked. When locked, inputs go read-only in one shot via the
            fieldset — the signature section (below) is deliberately OUTSIDE
            the fieldset so the Capture button still works in the "shipped"
            window. */}
        <fieldset
          disabled={locked}
          className={`m-0 p-0 border-0 ${locked ? "opacity-85" : ""}`}
        >

        {/* INVOICE # + DATE */}
        <div className="flex justify-end gap-6 mb-3">
          <Field label="Invoice #" wide>
            <Input value={invoice.invoiceNumber} onChange={(v) => update("invoiceNumber", v)} className="w-44" />
          </Field>
          <Field label="Date" wide>
            <Input
              type="date"
              value={invoice.invoiceDate ?? ""}
              onChange={(v) => update("invoiceDate", v || null)}
              className="w-40"
            />
          </Field>
        </div>

        {/* CUSTOMER + INSURANCE */}
        <div className="grid grid-cols-2 gap-5">
          <div className="space-y-2">
            <Field label="Customer Name">
              <Input value={invoice.customerName ?? ""} onChange={(v) => update("customerName", v || null)} />
            </Field>
            <Field label="Address">
              <Input value={invoice.addressLine1 ?? ""} onChange={(v) => update("addressLine1", v || null)} />
            </Field>
            <Field label="Address 2">
              <Input value={invoice.addressLine2 ?? ""} onChange={(v) => update("addressLine2", v || null)} />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="City">
                <Input value={invoice.city ?? ""} onChange={(v) => update("city", v || null)} />
              </Field>
              <Field label="State">
                <Input value={invoice.state ?? ""} onChange={(v) => update("state", v || null)} />
              </Field>
              <Field label="Zip">
                <Input value={invoice.postalCode ?? ""} onChange={(v) => update("postalCode", v || null)} />
              </Field>
            </div>
          </div>
          <div className="space-y-2">
            <Field label="Insurance(s)">
              <Input value={invoice.insuranceName ?? ""} onChange={(v) => update("insuranceName", v || null)} />
            </Field>
            <Field label="Insurance #">
              <Input value={invoice.insuranceNumber ?? ""} onChange={(v) => update("insuranceNumber", v || null)} />
            </Field>
            <Field label="Doctor">
              <Input value={invoice.doctorName ?? ""} onChange={(v) => update("doctorName", v || null)} />
            </Field>
          </div>
        </div>

        {/* DELIVERY METHOD */}
        <div className="flex flex-wrap gap-4 my-4">
          {DELIVERY_OPTIONS.map((opt) => (
            <Checkbox
              key={opt.value}
              label={opt.label}
              checked={invoice.deliveryMethod === opt.value}
              onChange={(v) => update("deliveryMethod", v ? opt.value : null)}
            />
          ))}
        </div>

        {/* LINE ITEMS */}
        <div className="border border-[#ddd] rounded-md overflow-hidden">
          <div className="grid grid-cols-[80px_60px_90px_1fr_90px_90px] bg-[#f7f7f7] border-b border-[#ddd] text-[10px] font-bold uppercase tracking-wide text-[#555]">
            <div className="px-2 py-1.5">Date</div>
            <div className="px-2 py-1.5">QTY</div>
            <div className="px-2 py-1.5">HCPC</div>
            <div className="px-2 py-1.5">Description &amp; Lot/Serial #</div>
            <div className="px-2 py-1.5 text-right">Per Ea.</div>
            <div className="px-2 py-1.5 text-right">Total</div>
          </div>
          {visibleLineItems.length === 0 ? (
            <div className="px-3 py-4 text-center text-[11px] italic text-[#999] border-b border-[#eee]">
              No products on this order.
            </div>
          ) : (
            visibleLineItems.map((row, idx) => (
              <div
                key={idx}
                className="grid grid-cols-[80px_60px_90px_1fr_90px_90px] border-b border-[#eee] last:border-0 text-[12px]"
              >
                <CellInput value={row.date ?? ""} onChange={(v) => updateLineItem(idx, { date: v || null })} placeholder="—" />
                <CellInput value={row.qty?.toString() ?? ""} onChange={(v) => updateLineItem(idx, { qty: v ? Number(v) : null })} placeholder="—" />
                <CellInput value={row.hcpc ?? ""} onChange={(v) => updateLineItem(idx, { hcpc: v || null })} placeholder="—" />
                <CellInput value={row.description ?? ""} onChange={(v) => updateLineItem(idx, { description: v || null })} placeholder="—" />
                <CellInput value={row.perEach?.toString() ?? ""} onChange={(v) => updateLineItem(idx, { perEach: v ? Number(v) : null })} placeholder="—" align="right" />
                <CellInput value={row.total?.toString() ?? ""} onChange={(v) => updateLineItem(idx, { total: v ? Number(v) : null })} placeholder="—" align="right" />
              </div>
            ))
          )}
          {/* GRAND TOTAL — sum of line-item totals, same calc as the PDF */}
          <div className="grid grid-cols-[80px_60px_90px_1fr_90px_90px] bg-[#f7f7f7] border-t-2 border-[#333] text-[12px] font-semibold">
            <div className="col-span-4 px-2 py-2 text-right text-[#555] uppercase tracking-wide text-[10px]">
              Grand Total
            </div>
            <div className="px-2 py-2 text-right text-[var(--navy)]" />
            <div className="px-2 py-2 text-right text-[var(--navy)]">
              {grandTotal.toLocaleString("en-US", { style: "currency", currency: "USD" })}
            </div>
          </div>
        </div>

        {/* TOTALS */}
        <div className="mt-3 flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#555]">Due / Co-pay</span>
            <Input
              type="number"
              value={invoice.dueCopay?.toString() ?? ""}
              onChange={(v) => update("dueCopay", v ? Number(v) : null)}
              className="w-32 text-right"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#555]">Total Received</span>
            <Input
              type="number"
              value={invoice.totalReceived?.toString() ?? ""}
              onChange={(v) => update("totalReceived", v ? Number(v) : null)}
              className="w-32 text-right"
            />
          </div>
        </div>

        {/* PURCHASE — rental is no longer offered, so Purchase is a static,
            pre-checked statement rather than a choice. */}
        <p className="mt-4 text-[10px] italic text-[#777]">
          Medicare allows a rental or purchase of some DME items.
        </p>
        <div className="flex gap-4 mt-1.5">
          <Checkbox label="Purchase" checked={true} onChange={() => {}} />
        </div>

        {/* ACKNOWLEDGEMENTS */}
        <h3 className="text-[12px] font-bold mt-5 mb-1" style={{ color: NAVY }}>
          Disclosures Provided
        </h3>
        <p className="text-[10px] text-[#666] mb-2">
          Default-checked: <span className="font-semibold">{order.facility_name || "The supplier"}</span>
          {" "}reviewed the admission package with the patient and left a copy.
          Toggle off only if a disclosure was specifically not provided.
        </p>
        <div className="grid grid-cols-3 gap-x-3 gap-y-1.5">
          {ACKNOWLEDGEMENTS.map(({ key, label }) => (
            <Checkbox
              key={key}
              label={label}
              checked={invoice.acknowledgements[key] !== false}
              onChange={() => toggleAck(key)}
              size="sm"
            />
          ))}
        </div>

        {/* AUTHORIZATION PARAGRAPH — mirrors DeliveryInvoicePDF so the
            on-screen form matches the generated PDF exactly. */}
        <h3 className="text-[12px] font-bold mt-5 mb-1" style={{ color: NAVY }}>
          Authorization to Assign Benefits to Provider &amp; Release of Medical Information
        </h3>
        <p className="text-[10px] leading-snug text-[#333]">
          I request that payment of authorized Medicare/Medicaid/Medicare
          Supplemental/Other Insurers and other benefits be made on my behalf
          to the above company for products and services that they have
          provided for me. I further authorize a copy of this agreement to be
          used in place of the original and authorize any holder of medical
          information about me to release to the Centers for Medicare and
          Medicaid Services and its agents or others any information needed to
          determine these benefits or compliance with current healthcare
          standards. Meridian Surgical Supplies and/or any of our corporate
          affiliates may obtain medical or other information necessary in
          order to process claims, including determining eligibility and
          seeking reimbursement for medical equipment and supplies provided.
          I agree to pay all amounts that are not covered by my Insurers,
          including applicable co-payments and/or deductibles for which I am
          responsible.
        </p>

        </fieldset>

        {/* SIGNATURE OF PATIENT — live proof-of-delivery capture.
            Renders one of three states depending on data + gating:
              1) signed    → image + metadata (who signed, when, relationship)
              2) capture   → "Capture Patient Signature" button (shipped + provider/admin)
              3) locked    → greyed-out button with tooltip explaining why */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[10px] font-bold uppercase tracking-wide text-[#555]">
              Signature of Patient
            </div>
            {invoice.patientSignedAt && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-green-50 border border-green-200">
                <Check className="w-3 h-3 text-green-600 shrink-0" />
                <span className="text-[10px] font-semibold text-green-700">Captured</span>
              </div>
            )}
          </div>

          {invoice.patientSignedAt && invoice.patientSignatureImage ? (
            <>
              <div className="border-b border-[#333] pb-1 h-12 flex items-end">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={invoice.patientSignatureImage}
                  alt="Patient signature"
                  className="h-10 object-contain object-left"
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[9px] italic text-[#777]">
                  {invoice.relationship && invoice.signerName
                    ? `Signed by ${invoice.signerName} (${relationshipLabel(invoice.relationship)})${invoice.signerReason ? ` — ${invoice.signerReason}` : ""}`
                    : "Signed by patient"}
                </span>
                <div className="flex items-center gap-3">
                  {/* Recapture — only available while the order is still in
                      `shipped` (before admin marks delivered). Provider or
                      admin. Same gate as the initial capture. */}
                  {canCapture && (
                    <button
                      type="button"
                      onClick={() => setCaptureOpen(true)}
                      className="text-[10px] text-[#0f2d4a] hover:text-red-500 underline underline-offset-2 transition-colors"
                    >
                      Recapture
                    </button>
                  )}
                  <span className="text-[9px] italic text-[#777]">
                    {new Date(invoice.patientSignedAt).toLocaleString("en-US", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="border-b border-[#333] h-12 flex items-center">
                <button
                  type="button"
                  onClick={() => setCaptureOpen(true)}
                  disabled={!canCapture}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[11px] font-semibold transition-colors ${
                    canCapture
                      ? "border-[#0f2d4a] text-[#0f2d4a] hover:bg-[#0f2d4a] hover:text-white"
                      : "border-[#ccc] text-[#aaa] bg-[#f7f7f7] cursor-not-allowed"
                  }`}
                >
                  <PenLine className="w-3.5 h-3.5 shrink-0" />
                  Capture Patient Signature
                </button>
                {captureGateMessage && !canCapture && (
                  <span className="ml-3 inline-flex items-center gap-1 text-[10px] italic text-[#888]">
                    <Info className="w-3 h-3 shrink-0" />
                    {captureGateMessage}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[9px] italic text-[#777]">
                  (If signed by caregiver or other, list relationship and reason)
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      <CapturePatientSignatureModal
        open={captureOpen}
        onOpenChange={setCaptureOpen}
        orderId={order.id}
        clinicName={order.facility_name || ""}
        patientName={order.patient_full_name ?? null}
        onCaptured={(nextInvoice) => {
          baselineRef.current = nextInvoice;
          setInvoice(nextInvoice);
          onInvoiceUpdated?.(nextInvoice);
        }}
      />
    </div>
  );
}

function relationshipLabel(r: string): string {
  switch (r) {
    case "spouse_relative": return "Spouse / Relative";
    case "caregiver":       return "Caregiver";
    case "other":           return "Other";
    default: return r;
  }
}

/* ─── Tiny field primitives kept inline to avoid pulling in a new file ─── */

function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`flex ${wide ? "items-center gap-2" : "flex-col gap-0.5"}`}>
      <span className="text-[10px] font-bold uppercase tracking-wide text-[#555]">
        {label}
      </span>
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  className,
  type = "text",
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={`border-b border-[#888] bg-transparent px-1 py-0.5 text-[13px] outline-none focus:border-[var(--navy)] disabled:text-[#777] disabled:cursor-not-allowed ${className ?? "w-full"}`}
    />
  );
}

function CellInput({
  value,
  onChange,
  placeholder,
  align = "left",
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  align?: "left" | "right";
  disabled?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={`px-2 py-1 text-[12px] outline-none border-r border-[#eee] last:border-0 bg-transparent text-${align} placeholder:text-[#bbb] disabled:text-[#777] disabled:cursor-not-allowed`}
    />
  );
}

function Checkbox({
  label,
  checked,
  onChange,
  size = "md",
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  size?: "sm" | "md";
  disabled?: boolean;
}) {
  const box = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";
  const text = size === "sm" ? "text-[10px]" : "text-[11px]";
  return (
    <label className={`inline-flex items-center gap-1.5 select-none ${disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}>
      <span
        className={`${box} border border-[#666] rounded-[2px] flex items-center justify-center bg-white`}
      >
        {checked && <span className="text-[8px] leading-none text-black">✓</span>}
      </span>
      <span className={text}>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="hidden"
      />
    </label>
  );
}
