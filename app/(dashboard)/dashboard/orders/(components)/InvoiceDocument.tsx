"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Mail, Globe, Phone } from "lucide-react";
import toast from "react-hot-toast";
import { HBLogo } from "@/app/(components)/HBLogo";
import { FormActionBar } from "./FormActionBar";
import { upsertOrderDeliveryInvoice } from "../(services)/order-delivery-invoice-actions";
import type {
  AcknowledgementMap,
  DashboardOrder,
  DeliveryMethod,
  IDeliveryInvoice,
  IDeliveryInvoiceLineItem,
  RentOrPurchase,
} from "@/utils/interfaces/orders";

const NAVY = "#0f2d4a";
const TEAL = "#0d7a6b";

const DELIVERY_OPTIONS: { value: DeliveryMethod; label: string }[] = [
  { value: "home_delivery",     label: "Home Delivery" },
  { value: "patient_picked_up", label: "Patient Picked-Up" },
  { value: "mail_order",        label: "Mail Order" },
  { value: "return",            label: "Return" },
];

const RENT_OPTIONS: { value: RentOrPurchase; label: string }[] = [
  { value: "rent",     label: "Rent" },
  { value: "purchase", label: "Purchase" },
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
  onDirtyChange?: (dirty: boolean) => void;
}

export function InvoiceDocument({
  order,
  initialInvoice,
  onDirtyChange,
}: InvoiceDocumentProps) {
  // Snapshot baseline state — comparison-based dirty tracking matches the
  // pattern used by OrderFormDocument / IVRFormDocument.
  const [invoice, setInvoice] = useState<IDeliveryInvoice>(initialInvoice);
  const [isPending, setIsPending] = useState(false);
  const baselineRef = useRef<IDeliveryInvoice>(initialInvoice);

  const isDirty = useMemo(
    () => JSON.stringify(invoice) !== JSON.stringify(baselineRef.current),
    [invoice],
  );

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

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
      const res = await upsertOrderDeliveryInvoice(order.id, {
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
        rentOrPurchase:   invoice.rentOrPurchase,
        dueCopay:         invoice.dueCopay,
        totalReceived:    invoice.totalReceived,
        acknowledgements: invoice.acknowledgements,
      });
      if (!res.success || !res.invoice) {
        toast.error(res.error ?? "Failed to save invoice.");
        return;
      }
      baselineRef.current = res.invoice;
      setInvoice(res.invoice);
      toast.success("Invoice saved.");
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

      {/* PAPER DOCUMENT */}
      <div
        className="mx-auto bg-white border border-[#ddd] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
        style={{ maxWidth: 800, padding: "28px 32px", fontFamily: "system-ui, sans-serif" }}
      >
        {/* HEADER (mirrors OrderFormDocument exactly for visual uniformity) */}
        <div className="flex items-start justify-between pb-3 border-b border-[#e5e5e5]">
          <div className="flex items-center gap-3">
            <div className="[&>span>span:last-child]:hidden shrink-0">
              <HBLogo variant="light" size="lg" asLink={false} />
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

        {/* RENT / PURCHASE */}
        <p className="mt-4 text-[10px] italic text-[#777]">
          Medicare allows a rental or purchase of some DME items. Please check one option:
        </p>
        <div className="flex gap-4 mt-1.5">
          {RENT_OPTIONS.map((opt) => (
            <Checkbox
              key={opt.value}
              label={opt.label}
              checked={invoice.rentOrPurchase === opt.value}
              onChange={(v) => update("rentOrPurchase", v ? opt.value : null)}
            />
          ))}
        </div>

        {/* ACKNOWLEDGEMENTS */}
        <h3 className="text-[12px] font-bold mt-5 mb-1" style={{ color: NAVY }}>
          Disclosures Provided
        </h3>
        <p className="text-[10px] text-[#666] mb-2">
          Default-checked: Meridian reviewed the admission package with the patient and left a copy.
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

        {/* SIGNATURE PLACEHOLDER */}
        <div className="mt-6 border-t border-[#e5e5e5] pt-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-[#555] mb-2">
            Signature of Patient
          </div>
          <div className="border border-dashed border-[#ccc] rounded-md p-4 text-center text-[11px] text-[#999]">
            Signature capture flow pending — leave blank for now.
            <br />
            (Printed PDF shows a blank signature line.)
          </div>
        </div>
      </div>
    </div>
  );
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
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`border-b border-[#888] bg-transparent px-1 py-0.5 text-[13px] outline-none focus:border-[var(--navy)] ${className ?? "w-full"}`}
    />
  );
}

function CellInput({
  value,
  onChange,
  placeholder,
  align = "left",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  align?: "left" | "right";
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`px-2 py-1 text-[12px] outline-none border-r border-[#eee] last:border-0 bg-transparent text-${align} placeholder:text-[#bbb]`}
    />
  );
}

function Checkbox({
  label,
  checked,
  onChange,
  size = "md",
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";
  const text = size === "sm" ? "text-[10px]" : "text-[11px]";
  return (
    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
      <span
        className={`${box} border border-[#666] rounded-[2px] flex items-center justify-center bg-white`}
      >
        {checked && <span className="text-[8px] leading-none text-black">✓</span>}
      </span>
      <span className={text}>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="hidden"
      />
    </label>
  );
}
