# Enrollment Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mandatory Enrollment Form step to the `clinical_provider` invite signup wizard that collects ~40 facility billing/shipping/claims fields and inserts them into `facility_enrollment` atomically before account creation finalizes.

**Architecture:** Three file changes — (1) new stateless `EnrollmentFormDocument` component rendering the full-page document form, (2) `InviteSignUpForm` gains an Enroll step (index after Agree), ~40 controlled state fields, full-page layout override, client validation, and all hidden inputs wired to the enrollment form's submit action, (3) `inviteSignUp` server action inserts into `facility_enrollment` after `addFacilityMember` succeeds, rolling back on failure.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5, Tailwind CSS 4, `useActionState`, Supabase admin client

---

## File Map

| File | Type | Responsibility |
|---|---|---|
| `app/(auth)/invite/[token]/signup/(components)/EnrollmentFormDocument.tsx` | **New** | Stateless document-style form, all props, no internal state |
| `app/(auth)/invite/[token]/signup/(sections)/InviteSignUpForm.tsx` | **Modify** | Add Enroll step, 40 state fields, layout override, validation, hidden inputs |
| `app/(auth)/invite/[token]/signup/(services)/actions.ts` | **Modify** | Fatal `facility_enrollment` insert with rollback |

---

## Task 1: Create `EnrollmentFormDocument` component (stateless)

**Files:**
- Create: `app/(auth)/invite/[token]/signup/(components)/EnrollmentFormDocument.tsx`

- [ ] **Step 1: Write the component shell with props interface**

```tsx
"use client";

import type { InputHTMLAttributes } from "react";
import { cn } from "@/utils/utils";

/* ── Design tokens ── */
const AMBER = "#f59e0b";

/* ── FormInput primitive (bottom-border style, same as IVR doc) ── */
function FormInput({
  value,
  onChange,
  readOnly,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  value: string;
  onChange?: (v: string) => void;
}) {
  return (
    <input
      value={value}
      readOnly={readOnly || !onChange}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      className={cn(
        "border-0 border-b border-[#333] text-[13px] outline-none bg-transparent",
        "focus:border-[#f59e0b] transition-colors px-1 py-0.5 leading-tight text-[#222]",
        "placeholder:text-[#bbb] w-full",
        readOnly && "text-[#555] cursor-default",
        className,
      )}
      {...props}
    />
  );
}

/* ── Section header ── */
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="px-3 py-1.5 font-bold text-[13px] text-black uppercase tracking-wide"
      style={{ backgroundColor: AMBER }}
    >
      {children}
    </div>
  );
}

/* ── Field label ── */
function FL({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-bold uppercase tracking-wide text-[#333] block mb-0.5">
      {children}
    </span>
  );
}

/* ── Props ── */
export interface EnrollmentFormDocumentProps {
  canEdit: boolean;
  // Pre-fills (display-only, not written to enrollment)
  facilityName: string;
  providerName: string;
  providerNpi: string;
  billingAddress: string;
  billingCity: string;
  billingState: string;
  billingZip: string;
  billingPhone: string;
  // Section 1 — Billing (editable)
  facilityEin: string; onFacilityEinChange: (v: string) => void;
  facilityNpi: string; onFacilityNpiChange: (v: string) => void;
  facilityTin: string; onFacilityTinChange: (v: string) => void;
  facilityPtan: string; onFacilityPtanChange: (v: string) => void;
  apContactName: string; onApContactNameChange: (v: string) => void;
  apContactEmail: string; onApContactEmailChange: (v: string) => void;
  billingFax: string; onBillingFaxChange: (v: string) => void;
  dpaContact: string; onDpaContactChange: (v: string) => void;
  dpaContactEmail: string; onDpaContactEmailChange: (v: string) => void;
  // Section 2 — Provider (editable additional providers)
  additionalProvider1Name: string; onAdditionalProvider1NameChange: (v: string) => void;
  additionalProvider1Npi: string; onAdditionalProvider1NpiChange: (v: string) => void;
  additionalProvider2Name: string; onAdditionalProvider2NameChange: (v: string) => void;
  additionalProvider2Npi: string; onAdditionalProvider2NpiChange: (v: string) => void;
  // Section 3 — Shipping 1
  shippingFacilityName: string; onShippingFacilityNameChange: (v: string) => void;
  shippingFacilityNpi: string; onShippingFacilityNpiChange: (v: string) => void;
  shippingFacilityTin: string; onShippingFacilityTinChange: (v: string) => void;
  shippingFacilityPtan: string; onShippingFacilityPtanChange: (v: string) => void;
  shippingContactName: string; onShippingContactNameChange: (v: string) => void;
  shippingContactEmail: string; onShippingContactEmailChange: (v: string) => void;
  shippingAddress: string; onShippingAddressChange: (v: string) => void;
  shippingDaysTimes: string; onShippingDaysTimesChange: (v: string) => void;
  shippingPhone: string; onShippingPhoneChange: (v: string) => void;
  shippingFax: string; onShippingFaxChange: (v: string) => void;
  // Section 4 — Shipping 2
  shipping2FacilityName: string; onShipping2FacilityNameChange: (v: string) => void;
  shipping2FacilityNpi: string; onShipping2FacilityNpiChange: (v: string) => void;
  shipping2FacilityTin: string; onShipping2FacilityTinChange: (v: string) => void;
  shipping2FacilityPtan: string; onShipping2FacilityPtanChange: (v: string) => void;
  shipping2ContactName: string; onShipping2ContactNameChange: (v: string) => void;
  shipping2ContactEmail: string; onShipping2ContactEmailChange: (v: string) => void;
  shipping2Address: string; onShipping2AddressChange: (v: string) => void;
  shipping2DaysTimes: string; onShipping2DaysTimesChange: (v: string) => void;
  shipping2Phone: string; onShipping2PhoneChange: (v: string) => void;
  shipping2Fax: string; onShipping2FaxChange: (v: string) => void;
  // Section 5 — Claims
  claimsContactName: string; onClaimsContactNameChange: (v: string) => void;
  claimsContactPhone: string; onClaimsContactPhoneChange: (v: string) => void;
  claimsContactEmail: string; onClaimsContactEmailChange: (v: string) => void;
  claimsThirdParty: string; onClaimsThirdPartyChange: (v: string) => void;
}

export function EnrollmentFormDocument(props: EnrollmentFormDocumentProps) {
  const { canEdit } = props;
  const ro = !canEdit; // read-only shorthand

  return (
    <div
      className="mx-auto bg-white border border-[#ddd] shadow-sm"
      style={{ maxWidth: 800, padding: "28px 32px" }}
    >
      {/* Header */}
      <div className="text-center mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#888]">HB Medical</p>
        <h1 className="text-xl font-bold text-[#0f2d4a] mt-0.5">Enrollment Form</h1>
      </div>

      {/* Info callout */}
      <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-5 text-[12px] text-amber-800">
        All fields are required and will be used to process your orders.
      </div>

      {/* ── Section 1: Account Billing Information ── */}
      <div className="mb-5">
        <SectionHeader>Account Billing Information</SectionHeader>
        <div className="border border-t-0 border-[#ddd] p-3 space-y-3">
          {/* Row: Facility Name (read-only) */}
          <div>
            <FL>Facility / Account Name</FL>
            <FormInput value={props.facilityName} readOnly />
          </div>

          {/* Row: EIN + NPI */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FL>EIN</FL>
              <FormInput value={props.facilityEin} onChange={ro ? undefined : props.onFacilityEinChange} readOnly={ro} placeholder="00-0000000" />
            </div>
            <div>
              <FL>Facility NPI</FL>
              <FormInput value={props.facilityNpi} onChange={ro ? undefined : props.onFacilityNpiChange} readOnly={ro} placeholder="10 digits" />
            </div>
          </div>

          {/* Row: TIN + PTAN */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FL>TIN</FL>
              <FormInput value={props.facilityTin} onChange={ro ? undefined : props.onFacilityTinChange} readOnly={ro} placeholder="Tax ID" />
            </div>
            <div>
              <FL>PTAN</FL>
              <FormInput value={props.facilityPtan} onChange={ro ? undefined : props.onFacilityPtanChange} readOnly={ro} placeholder="Provider TAN" />
            </div>
          </div>

          {/* Row: AP Contact Name + Email */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FL>AP Contact Name</FL>
              <FormInput value={props.apContactName} onChange={ro ? undefined : props.onApContactNameChange} readOnly={ro} placeholder="Accounts payable contact" />
            </div>
            <div>
              <FL>AP Contact Email</FL>
              <FormInput value={props.apContactEmail} onChange={ro ? undefined : props.onApContactEmailChange} readOnly={ro} placeholder="ap@clinic.com" type="email" />
            </div>
          </div>

          {/* Row: Billing Address (read-only pre-fill) */}
          <div>
            <FL>Billing Address</FL>
            <FormInput value={props.billingAddress} readOnly />
          </div>

          {/* Row: City / State / ZIP */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <FL>City</FL>
              <FormInput value={props.billingCity} readOnly />
            </div>
            <div>
              <FL>State</FL>
              <FormInput value={props.billingState} readOnly />
            </div>
            <div>
              <FL>ZIP</FL>
              <FormInput value={props.billingZip} readOnly />
            </div>
          </div>

          {/* Row: Phone + Fax */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FL>Billing Phone</FL>
              <FormInput value={props.billingPhone} readOnly />
            </div>
            <div>
              <FL>Billing Fax</FL>
              <FormInput value={props.billingFax} onChange={ro ? undefined : props.onBillingFaxChange} readOnly={ro} placeholder="Fax number" />
            </div>
          </div>

          {/* Row: DPA Contact + Email */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FL>DPA Contact</FL>
              <FormInput value={props.dpaContact} onChange={ro ? undefined : props.onDpaContactChange} readOnly={ro} placeholder="Data processing contact" />
            </div>
            <div>
              <FL>DPA Contact Email</FL>
              <FormInput value={props.dpaContactEmail} onChange={ro ? undefined : props.onDpaContactEmailChange} readOnly={ro} placeholder="dpa@clinic.com" type="email" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2: Provider Information ── */}
      <div className="mb-5">
        <SectionHeader>Provider Information</SectionHeader>
        <div className="border border-t-0 border-[#ddd] p-3 space-y-3">
          {/* Provider Name + NPI (read-only) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FL>Provider Name</FL>
              <FormInput value={props.providerName} readOnly />
            </div>
            <div>
              <FL>Provider NPI</FL>
              <FormInput value={props.providerNpi} readOnly />
            </div>
          </div>

          {/* Additional Provider 1 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FL>Additional Provider 1 — Name</FL>
              <FormInput value={props.additionalProvider1Name} onChange={ro ? undefined : props.onAdditionalProvider1NameChange} readOnly={ro} placeholder="Full name" />
            </div>
            <div>
              <FL>Additional Provider 1 — NPI</FL>
              <FormInput value={props.additionalProvider1Npi} onChange={ro ? undefined : props.onAdditionalProvider1NpiChange} readOnly={ro} placeholder="10 digits" />
            </div>
          </div>

          {/* Additional Provider 2 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FL>Additional Provider 2 — Name</FL>
              <FormInput value={props.additionalProvider2Name} onChange={ro ? undefined : props.onAdditionalProvider2NameChange} readOnly={ro} placeholder="Full name" />
            </div>
            <div>
              <FL>Additional Provider 2 — NPI</FL>
              <FormInput value={props.additionalProvider2Npi} onChange={ro ? undefined : props.onAdditionalProvider2NpiChange} readOnly={ro} placeholder="10 digits" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 3: Account Shipping Information ── */}
      <div className="mb-5">
        <SectionHeader>Account Shipping Information</SectionHeader>
        <div className="border border-t-0 border-[#ddd] p-3 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FL>Shipping Facility Name</FL>
              <FormInput value={props.shippingFacilityName} onChange={ro ? undefined : props.onShippingFacilityNameChange} readOnly={ro} placeholder="Facility name" />
            </div>
            <div>
              <FL>Shipping Facility NPI</FL>
              <FormInput value={props.shippingFacilityNpi} onChange={ro ? undefined : props.onShippingFacilityNpiChange} readOnly={ro} placeholder="10 digits" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FL>TIN</FL>
              <FormInput value={props.shippingFacilityTin} onChange={ro ? undefined : props.onShippingFacilityTinChange} readOnly={ro} placeholder="Tax ID" />
            </div>
            <div>
              <FL>PTAN</FL>
              <FormInput value={props.shippingFacilityPtan} onChange={ro ? undefined : props.onShippingFacilityPtanChange} readOnly={ro} placeholder="Provider TAN" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FL>Shipping Contact Name</FL>
              <FormInput value={props.shippingContactName} onChange={ro ? undefined : props.onShippingContactNameChange} readOnly={ro} placeholder="Contact name" />
            </div>
            <div>
              <FL>Shipping Contact Email</FL>
              <FormInput value={props.shippingContactEmail} onChange={ro ? undefined : props.onShippingContactEmailChange} readOnly={ro} placeholder="shipping@clinic.com" type="email" />
            </div>
          </div>
          <div>
            <FL>Shipping Address</FL>
            <FormInput value={props.shippingAddress} onChange={ro ? undefined : props.onShippingAddressChange} readOnly={ro} placeholder="123 Main St, City, State ZIP" />
          </div>
          <div>
            <FL>Shipping Days / Times</FL>
            <FormInput value={props.shippingDaysTimes} onChange={ro ? undefined : props.onShippingDaysTimesChange} readOnly={ro} placeholder="e.g. Mon–Fri 8am–5pm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FL>Shipping Phone</FL>
              <FormInput value={props.shippingPhone} onChange={ro ? undefined : props.onShippingPhoneChange} readOnly={ro} placeholder="Phone" />
            </div>
            <div>
              <FL>Shipping Fax</FL>
              <FormInput value={props.shippingFax} onChange={ro ? undefined : props.onShippingFaxChange} readOnly={ro} placeholder="Fax" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 4: Additional Shipping Information ── */}
      <div className="mb-5">
        <SectionHeader>Additional Shipping Information</SectionHeader>
        <div className="border border-t-0 border-[#ddd] p-3 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FL>Facility Name</FL>
              <FormInput value={props.shipping2FacilityName} onChange={ro ? undefined : props.onShipping2FacilityNameChange} readOnly={ro} placeholder="Facility name" />
            </div>
            <div>
              <FL>Facility NPI</FL>
              <FormInput value={props.shipping2FacilityNpi} onChange={ro ? undefined : props.onShipping2FacilityNpiChange} readOnly={ro} placeholder="10 digits" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FL>TIN</FL>
              <FormInput value={props.shipping2FacilityTin} onChange={ro ? undefined : props.onShipping2FacilityTinChange} readOnly={ro} placeholder="Tax ID" />
            </div>
            <div>
              <FL>PTAN</FL>
              <FormInput value={props.shipping2FacilityPtan} onChange={ro ? undefined : props.onShipping2FacilityPtanChange} readOnly={ro} placeholder="Provider TAN" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FL>Contact Name</FL>
              <FormInput value={props.shipping2ContactName} onChange={ro ? undefined : props.onShipping2ContactNameChange} readOnly={ro} placeholder="Contact name" />
            </div>
            <div>
              <FL>Contact Email</FL>
              <FormInput value={props.shipping2ContactEmail} onChange={ro ? undefined : props.onShipping2ContactEmailChange} readOnly={ro} placeholder="contact@clinic.com" type="email" />
            </div>
          </div>
          <div>
            <FL>Address</FL>
            <FormInput value={props.shipping2Address} onChange={ro ? undefined : props.onShipping2AddressChange} readOnly={ro} placeholder="123 Main St, City, State ZIP" />
          </div>
          <div>
            <FL>Days / Times</FL>
            <FormInput value={props.shipping2DaysTimes} onChange={ro ? undefined : props.onShipping2DaysTimesChange} readOnly={ro} placeholder="e.g. Mon–Fri 8am–5pm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FL>Phone</FL>
              <FormInput value={props.shipping2Phone} onChange={ro ? undefined : props.onShipping2PhoneChange} readOnly={ro} placeholder="Phone" />
            </div>
            <div>
              <FL>Fax</FL>
              <FormInput value={props.shipping2Fax} onChange={ro ? undefined : props.onShipping2FaxChange} readOnly={ro} placeholder="Fax" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 5: Claims Contact Information ── */}
      <div className="mb-5">
        <SectionHeader>Claims Contact Information (Required)</SectionHeader>
        <div className="border border-t-0 border-[#ddd] p-3 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FL>Claims Contact Name</FL>
              <FormInput value={props.claimsContactName} onChange={ro ? undefined : props.onClaimsContactNameChange} readOnly={ro} placeholder="Full name" />
            </div>
            <div>
              <FL>Claims Contact Phone</FL>
              <FormInput value={props.claimsContactPhone} onChange={ro ? undefined : props.onClaimsContactPhoneChange} readOnly={ro} placeholder="Phone" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FL>Claims Contact Email</FL>
              <FormInput value={props.claimsContactEmail} onChange={ro ? undefined : props.onClaimsContactEmailChange} readOnly={ro} placeholder="claims@clinic.com" type="email" />
            </div>
            <div>
              <FL>Third Party Administrator</FL>
              <FormInput value={props.claimsThirdParty} onChange={ro ? undefined : props.onClaimsThirdPartyChange} readOnly={ro} placeholder="TPA name (if applicable)" />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-[#ddd] mt-4 pt-3 text-center text-[11px] text-[#888] space-y-0.5">
        <p>Email completed form to Support@MeridianSurgical.com</p>
        <p>123 Surgical Way, Suite 100 | REV2.0</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the file compiles — run build check**

```bash
npm run build 2>&1 | grep -E "(error|EnrollmentForm)" | head -30
```

Expected: no TypeScript errors for the new file. (Build may fail elsewhere due to other pending changes — focus on errors in `EnrollmentFormDocument.tsx`.)

- [ ] **Step 3: Commit**

```bash
git add app/"(auth)"/invite/\[token\]/signup/"(components)"/EnrollmentFormDocument.tsx
git commit -m "feat: add EnrollmentFormDocument stateless component"
```

---

## Task 2: Wire Enroll step into `InviteSignUpForm.tsx`

**Files:**
- Modify: `app/(auth)/invite/[token]/signup/(sections)/InviteSignUpForm.tsx`

This task is split into three sub-steps: add state + step array, add the enrollment UI, add hidden inputs + navigation fix.

### Sub-task 2a: Add enrollment state fields and update STEPS array

- [ ] **Step 1: Add the `EnrollmentFormDocument` import and Enroll icon**

At the top of `InviteSignUpForm.tsx`, add to the existing import block:

```tsx
import { EnrollmentFormDocument } from "../(components)/EnrollmentFormDocument";
import { ClipboardList } from "lucide-react";
```

- [ ] **Step 2: Update the STEPS arrays to include the Enroll step**

Replace the two STEPS constant blocks (with and without `needsOfficeStep`) with:

```tsx
const STEPS = needsOfficeStep
  ? [
      { label: "Role", icon: UserCheck },
      { label: "Info", icon: User },
      { label: "Office", icon: Building2 },
      { label: "Security", icon: Lock },
      { label: "Agree", icon: FileCheck },
      ...(role === "clinical_provider" ? [{ label: "Enroll", icon: ClipboardList }] : []),
    ]
  : [
      { label: "Role", icon: UserCheck },
      { label: "Info", icon: User },
      { label: "Security", icon: Lock },
      { label: "Agree", icon: FileCheck },
      ...(role === "clinical_provider" ? [{ label: "Enroll", icon: ClipboardList }] : []),
    ];
```

- [ ] **Step 3: Add `enrollStepIndex` derived value after the existing step index declarations**

After the line `const agreeStepIndex = needsOfficeStep ? 4 : 3;`, add:

```tsx
const enrollStepIndex = role === "clinical_provider" ? agreeStepIndex + 1 : null;
```

- [ ] **Step 4: Add all 40 enrollment state fields after the existing state declarations**

After the `const [clientError, setClientError] = useState("");` line, add:

```tsx
// Enrollment state — clinical_provider only
const [facilityEin, setFacilityEin] = useState("");
const [facilityNpi, setFacilityNpi] = useState("");
const [facilityTin, setFacilityTin] = useState("");
const [facilityPtan, setFacilityPtan] = useState("");
const [apContactName, setApContactName] = useState("");
const [apContactEmail, setApContactEmail] = useState("");
const [billingFax, setBillingFax] = useState("");
const [dpaContact, setDpaContact] = useState("");
const [dpaContactEmail, setDpaContactEmail] = useState("");
const [additionalProvider1Name, setAdditionalProvider1Name] = useState("");
const [additionalProvider1Npi, setAdditionalProvider1Npi] = useState("");
const [additionalProvider2Name, setAdditionalProvider2Name] = useState("");
const [additionalProvider2Npi, setAdditionalProvider2Npi] = useState("");
const [shippingFacilityName, setShippingFacilityName] = useState("");
const [shippingFacilityNpi, setShippingFacilityNpi] = useState("");
const [shippingFacilityTin, setShippingFacilityTin] = useState("");
const [shippingFacilityPtan, setShippingFacilityPtan] = useState("");
const [shippingContactName, setShippingContactName] = useState("");
const [shippingContactEmail, setShippingContactEmail] = useState("");
const [shippingAddress, setShippingAddress] = useState("");
const [shippingDaysTimes, setShippingDaysTimes] = useState("");
const [shippingPhone, setShippingPhone] = useState("");
const [shippingFax, setShippingFax] = useState("");
const [shipping2FacilityName, setShipping2FacilityName] = useState("");
const [shipping2FacilityNpi, setShipping2FacilityNpi] = useState("");
const [shipping2FacilityTin, setShipping2FacilityTin] = useState("");
const [shipping2FacilityPtan, setShipping2FacilityPtan] = useState("");
const [shipping2ContactName, setShipping2ContactName] = useState("");
const [shipping2ContactEmail, setShipping2ContactEmail] = useState("");
const [shipping2Address, setShipping2Address] = useState("");
const [shipping2DaysTimes, setShipping2DaysTimes] = useState("");
const [shipping2Phone, setShipping2Phone] = useState("");
const [shipping2Fax, setShipping2Fax] = useState("");
const [claimsContactName, setClaimsContactName] = useState("");
const [claimsContactPhone, setClaimsContactPhone] = useState("");
const [claimsContactEmail, setClaimsContactEmail] = useState("");
const [claimsThirdParty, setClaimsThirdParty] = useState("");
```

- [ ] **Step 5: Verify no TypeScript errors so far**

```bash
npm run build 2>&1 | grep -E "InviteSignUpForm" | head -20
```

Expected: no errors for this file yet.

---

### Sub-task 2b: Add enrollment step client validation

- [ ] **Step 6: Add enrollment validation inside `goNext()`**

Inside the `goNext()` function, add a new validation block before the final `setDir(1); setStep((s) => s + 1);`. Add it after the `securityStepIndex` block:

```tsx
if (enrollStepIndex !== null && step === enrollStepIndex) {
  const missing: string[] = [];

  // Billing
  if (!facilityEin.trim()) missing.push("EIN");
  if (!facilityNpi.trim()) missing.push("Facility NPI");
  if (!facilityTin.trim()) missing.push("TIN");
  if (!facilityPtan.trim()) missing.push("PTAN");
  if (!apContactName.trim()) missing.push("AP Contact Name");
  if (!apContactEmail.trim()) missing.push("AP Contact Email");
  if (!billingFax.trim()) missing.push("Billing Fax");
  if (!dpaContact.trim()) missing.push("DPA Contact");
  if (!dpaContactEmail.trim()) missing.push("DPA Contact Email");

  // Provider
  if (!additionalProvider1Name.trim()) missing.push("Additional Provider 1 Name");
  if (!additionalProvider1Npi.trim()) missing.push("Additional Provider 1 NPI");
  if (!additionalProvider2Name.trim()) missing.push("Additional Provider 2 Name");
  if (!additionalProvider2Npi.trim()) missing.push("Additional Provider 2 NPI");

  // Shipping 1
  if (!shippingFacilityName.trim()) missing.push("Shipping Facility Name");
  if (!shippingFacilityNpi.trim()) missing.push("Shipping Facility NPI");
  if (!shippingFacilityTin.trim()) missing.push("Shipping TIN");
  if (!shippingFacilityPtan.trim()) missing.push("Shipping PTAN");
  if (!shippingContactName.trim()) missing.push("Shipping Contact Name");
  if (!shippingContactEmail.trim()) missing.push("Shipping Contact Email");
  if (!shippingAddress.trim()) missing.push("Shipping Address");
  if (!shippingDaysTimes.trim()) missing.push("Shipping Days/Times");
  if (!shippingPhone.trim()) missing.push("Shipping Phone");
  if (!shippingFax.trim()) missing.push("Shipping Fax");

  // Shipping 2
  if (!shipping2FacilityName.trim()) missing.push("Shipping 2 Facility Name");
  if (!shipping2FacilityNpi.trim()) missing.push("Shipping 2 Facility NPI");
  if (!shipping2FacilityTin.trim()) missing.push("Shipping 2 TIN");
  if (!shipping2FacilityPtan.trim()) missing.push("Shipping 2 PTAN");
  if (!shipping2ContactName.trim()) missing.push("Shipping 2 Contact Name");
  if (!shipping2ContactEmail.trim()) missing.push("Shipping 2 Contact Email");
  if (!shipping2Address.trim()) missing.push("Shipping 2 Address");
  if (!shipping2DaysTimes.trim()) missing.push("Shipping 2 Days/Times");
  if (!shipping2Phone.trim()) missing.push("Shipping 2 Phone");
  if (!shipping2Fax.trim()) missing.push("Shipping 2 Fax");

  // Claims
  if (!claimsContactName.trim()) missing.push("Claims Contact Name");
  if (!claimsContactPhone.trim()) missing.push("Claims Contact Phone");
  if (!claimsContactEmail.trim()) missing.push("Claims Contact Email");
  if (!claimsThirdParty.trim()) missing.push("Third Party Administrator");

  if (missing.length > 0) {
    setClientError(`Please complete all required fields: ${missing.join(", ")}.`);
    return;
  }
}
```

> **Note:** The enrollment step IS the final step — `goNext()` is NOT called from enrollment. Validation runs because the submit button (inside the form) calls `goNext()` first — see Sub-task 2c below for the actual submit flow. The form action fires only after this validation passes.

> **Correction:** The enrollment step submits via the `<form action={formAction}>`. Its submit button does NOT call `goNext()`. Validation for the enrollment step is handled inline before the form submits using a `handleEnrollSubmit` wrapper defined in Sub-task 2c.

---

### Sub-task 2c: Add enrollment step JSX, form, and navigation

- [ ] **Step 7: Add the enrollment step JSX inside `AnimatePresence`**

Inside the `<motion.div>` that wraps all step content, after the closing `}` of the `step === agreeStepIndex` block (before `</motion.div>`), add:

```tsx
{enrollStepIndex !== null && step === enrollStepIndex && null /* rendered outside AuthCard — see below */}
```

- [ ] **Step 8: Replace the outer return with a conditional full-page layout**

The current component returns a single `<AuthCard>` wrapper. Replace the entire `return (...)` with:

```tsx
// Enrollment step renders full-page, outside AuthCard
if (enrollStepIndex !== null && step === enrollStepIndex) {
  function handleEnrollSubmit(e: React.FormEvent<HTMLFormElement>) {
    setClientError("");
    const missing: string[] = [];
    if (!facilityEin.trim()) missing.push("EIN");
    if (!facilityNpi.trim()) missing.push("Facility NPI");
    if (!facilityTin.trim()) missing.push("TIN");
    if (!facilityPtan.trim()) missing.push("PTAN");
    if (!apContactName.trim()) missing.push("AP Contact Name");
    if (!apContactEmail.trim()) missing.push("AP Contact Email");
    if (!billingFax.trim()) missing.push("Billing Fax");
    if (!dpaContact.trim()) missing.push("DPA Contact");
    if (!dpaContactEmail.trim()) missing.push("DPA Contact Email");
    if (!additionalProvider1Name.trim()) missing.push("Additional Provider 1 Name");
    if (!additionalProvider1Npi.trim()) missing.push("Additional Provider 1 NPI");
    if (!additionalProvider2Name.trim()) missing.push("Additional Provider 2 Name");
    if (!additionalProvider2Npi.trim()) missing.push("Additional Provider 2 NPI");
    if (!shippingFacilityName.trim()) missing.push("Shipping Facility Name");
    if (!shippingFacilityNpi.trim()) missing.push("Shipping Facility NPI");
    if (!shippingFacilityTin.trim()) missing.push("Shipping TIN");
    if (!shippingFacilityPtan.trim()) missing.push("Shipping PTAN");
    if (!shippingContactName.trim()) missing.push("Shipping Contact Name");
    if (!shippingContactEmail.trim()) missing.push("Shipping Contact Email");
    if (!shippingAddress.trim()) missing.push("Shipping Address");
    if (!shippingDaysTimes.trim()) missing.push("Shipping Days/Times");
    if (!shippingPhone.trim()) missing.push("Shipping Phone");
    if (!shippingFax.trim()) missing.push("Shipping Fax");
    if (!shipping2FacilityName.trim()) missing.push("Shipping 2 Facility Name");
    if (!shipping2FacilityNpi.trim()) missing.push("Shipping 2 Facility NPI");
    if (!shipping2FacilityTin.trim()) missing.push("Shipping 2 TIN");
    if (!shipping2FacilityPtan.trim()) missing.push("Shipping 2 PTAN");
    if (!shipping2ContactName.trim()) missing.push("Shipping 2 Contact Name");
    if (!shipping2ContactEmail.trim()) missing.push("Shipping 2 Contact Email");
    if (!shipping2Address.trim()) missing.push("Shipping 2 Address");
    if (!shipping2DaysTimes.trim()) missing.push("Shipping 2 Days/Times");
    if (!shipping2Phone.trim()) missing.push("Shipping 2 Phone");
    if (!shipping2Fax.trim()) missing.push("Shipping 2 Fax");
    if (!claimsContactName.trim()) missing.push("Claims Contact Name");
    if (!claimsContactPhone.trim()) missing.push("Claims Contact Phone");
    if (!claimsContactEmail.trim()) missing.push("Claims Contact Email");
    if (!claimsThirdParty.trim()) missing.push("Third Party Administrator");

    if (missing.length > 0) {
      e.preventDefault();
      setClientError(`Please complete all required fields: ${missing.join(", ")}.`);
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-6 px-4">
      {/* Top bar */}
      <div className="max-w-[900px] mx-auto mb-4 flex items-center justify-between">
        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.label} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  i < step
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : i === step
                      ? "bg-[#EFF6FF] text-[var(--navy)] border border-[var(--navy)]/30"
                      : "bg-[#F8FAFC] text-[#94A3B8] border border-[#E2E8F0]"
                }`}
              >
                {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-6 h-px ${i < step ? "bg-emerald-200" : "bg-[#E2E8F0]"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Back button */}
        <button
          type="button"
          onClick={goBack}
          className="flex items-center gap-1 text-sm text-[#64748B] hover:text-[#0F172A] transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
      </div>

      {/* Document */}
      <EnrollmentFormDocument
        canEdit
        facilityName={officeName || facilityName || ""}
        providerName={`${firstName} ${lastName}`.trim()}
        providerNpi={npiNumber}
        billingAddress={officeAddress}
        billingCity={officeCity}
        billingState={officeState}
        billingZip={officePostalCode}
        billingPhone={officePhone}
        facilityEin={facilityEin} onFacilityEinChange={setFacilityEin}
        facilityNpi={facilityNpi} onFacilityNpiChange={setFacilityNpi}
        facilityTin={facilityTin} onFacilityTinChange={setFacilityTin}
        facilityPtan={facilityPtan} onFacilityPtanChange={setFacilityPtan}
        apContactName={apContactName} onApContactNameChange={setApContactName}
        apContactEmail={apContactEmail} onApContactEmailChange={setApContactEmail}
        billingFax={billingFax} onBillingFaxChange={setBillingFax}
        dpaContact={dpaContact} onDpaContactChange={setDpaContact}
        dpaContactEmail={dpaContactEmail} onDpaContactEmailChange={setDpaContactEmail}
        additionalProvider1Name={additionalProvider1Name} onAdditionalProvider1NameChange={setAdditionalProvider1Name}
        additionalProvider1Npi={additionalProvider1Npi} onAdditionalProvider1NpiChange={setAdditionalProvider1Npi}
        additionalProvider2Name={additionalProvider2Name} onAdditionalProvider2NameChange={setAdditionalProvider2Name}
        additionalProvider2Npi={additionalProvider2Npi} onAdditionalProvider2NpiChange={setAdditionalProvider2Npi}
        shippingFacilityName={shippingFacilityName} onShippingFacilityNameChange={setShippingFacilityName}
        shippingFacilityNpi={shippingFacilityNpi} onShippingFacilityNpiChange={setShippingFacilityNpi}
        shippingFacilityTin={shippingFacilityTin} onShippingFacilityTinChange={setShippingFacilityTin}
        shippingFacilityPtan={shippingFacilityPtan} onShippingFacilityPtanChange={setShippingFacilityPtan}
        shippingContactName={shippingContactName} onShippingContactNameChange={setShippingContactName}
        shippingContactEmail={shippingContactEmail} onShippingContactEmailChange={setShippingContactEmail}
        shippingAddress={shippingAddress} onShippingAddressChange={setShippingAddress}
        shippingDaysTimes={shippingDaysTimes} onShippingDaysTimesChange={setShippingDaysTimes}
        shippingPhone={shippingPhone} onShippingPhoneChange={setShippingPhone}
        shippingFax={shippingFax} onShippingFaxChange={setShippingFax}
        shipping2FacilityName={shipping2FacilityName} onShipping2FacilityNameChange={setShipping2FacilityName}
        shipping2FacilityNpi={shipping2FacilityNpi} onShipping2FacilityNpiChange={setShipping2FacilityNpi}
        shipping2FacilityTin={shipping2FacilityTin} onShipping2FacilityTinChange={setShipping2FacilityTin}
        shipping2FacilityPtan={shipping2FacilityPtan} onShipping2FacilityPtanChange={setShipping2FacilityPtan}
        shipping2ContactName={shipping2ContactName} onShipping2ContactNameChange={setShipping2ContactName}
        shipping2ContactEmail={shipping2ContactEmail} onShipping2ContactEmailChange={setShipping2ContactEmail}
        shipping2Address={shipping2Address} onShipping2AddressChange={setShipping2Address}
        shipping2DaysTimes={shipping2DaysTimes} onShipping2DaysTimesChange={setShipping2DaysTimes}
        shipping2Phone={shipping2Phone} onShipping2PhoneChange={setShipping2Phone}
        shipping2Fax={shipping2Fax} onShipping2FaxChange={setShipping2Fax}
        claimsContactName={claimsContactName} onClaimsContactNameChange={setClaimsContactName}
        claimsContactPhone={claimsContactPhone} onClaimsContactPhoneChange={setClaimsContactPhone}
        claimsContactEmail={claimsContactEmail} onClaimsContactEmailChange={setClaimsContactEmail}
        claimsThirdParty={claimsThirdParty} onClaimsThirdPartyChange={setClaimsThirdParty}
      />

      {/* Bottom: error + submit */}
      <div className="max-w-[800px] mx-auto mt-6 space-y-3">
        {(clientError || state?.error) && (
          <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3">
            <p className="text-xs text-red-600">{clientError || state?.error}</p>
          </div>
        )}

        <form action={formAction} onSubmit={handleEnrollSubmit}>
          {/* All prior-step hidden inputs */}
          <input type="hidden" name="first_name" value={firstName} />
          <input type="hidden" name="last_name" value={lastName} />
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="phone" value={phone} />
          <input type="hidden" name="password" value={password} />
          <input type="hidden" name="agreed" value="true" />
          {needsPin && <input type="hidden" name="pin" value={pin} />}
          {needsPin && <input type="hidden" name="npi_number" value={npiNumber} />}
          {needsPin && <input type="hidden" name="credential" value={credential} />}
          {needsOfficeStep && (
            <>
              <input type="hidden" name="office_name" value={officeName} />
              <input type="hidden" name="office_phone" value={officePhone} />
              <input type="hidden" name="office_address" value={officeAddress} />
              <input type="hidden" name="office_city" value={officeCity} />
              <input type="hidden" name="office_state" value={officeState} />
              <input type="hidden" name="office_postal_code" value={officePostalCode} />
            </>
          )}
          {/* Enrollment hidden inputs */}
          <input type="hidden" name="facility_ein" value={facilityEin} />
          <input type="hidden" name="facility_npi" value={facilityNpi} />
          <input type="hidden" name="facility_tin" value={facilityTin} />
          <input type="hidden" name="facility_ptan" value={facilityPtan} />
          <input type="hidden" name="ap_contact_name" value={apContactName} />
          <input type="hidden" name="ap_contact_email" value={apContactEmail} />
          <input type="hidden" name="billing_address" value={officeAddress} />
          <input type="hidden" name="billing_city" value={officeCity} />
          <input type="hidden" name="billing_state" value={officeState} />
          <input type="hidden" name="billing_zip" value={officePostalCode} />
          <input type="hidden" name="billing_phone" value={officePhone} />
          <input type="hidden" name="billing_fax" value={billingFax} />
          <input type="hidden" name="dpa_contact" value={dpaContact} />
          <input type="hidden" name="dpa_contact_email" value={dpaContactEmail} />
          <input type="hidden" name="additional_provider_1_name" value={additionalProvider1Name} />
          <input type="hidden" name="additional_provider_1_npi" value={additionalProvider1Npi} />
          <input type="hidden" name="additional_provider_2_name" value={additionalProvider2Name} />
          <input type="hidden" name="additional_provider_2_npi" value={additionalProvider2Npi} />
          <input type="hidden" name="shipping_facility_name" value={shippingFacilityName} />
          <input type="hidden" name="shipping_facility_npi" value={shippingFacilityNpi} />
          <input type="hidden" name="shipping_facility_tin" value={shippingFacilityTin} />
          <input type="hidden" name="shipping_facility_ptan" value={shippingFacilityPtan} />
          <input type="hidden" name="shipping_contact_name" value={shippingContactName} />
          <input type="hidden" name="shipping_contact_email" value={shippingContactEmail} />
          <input type="hidden" name="shipping_address" value={shippingAddress} />
          <input type="hidden" name="shipping_days_times" value={shippingDaysTimes} />
          <input type="hidden" name="shipping_phone" value={shippingPhone} />
          <input type="hidden" name="shipping_fax" value={shippingFax} />
          <input type="hidden" name="shipping2_facility_name" value={shipping2FacilityName} />
          <input type="hidden" name="shipping2_facility_npi" value={shipping2FacilityNpi} />
          <input type="hidden" name="shipping2_facility_tin" value={shipping2FacilityTin} />
          <input type="hidden" name="shipping2_facility_ptan" value={shipping2FacilityPtan} />
          <input type="hidden" name="shipping2_contact_name" value={shipping2ContactName} />
          <input type="hidden" name="shipping2_contact_email" value={shipping2ContactEmail} />
          <input type="hidden" name="shipping2_address" value={shipping2Address} />
          <input type="hidden" name="shipping2_days_times" value={shipping2DaysTimes} />
          <input type="hidden" name="shipping2_phone" value={shipping2Phone} />
          <input type="hidden" name="shipping2_fax" value={shipping2Fax} />
          <input type="hidden" name="claims_contact_name" value={claimsContactName} />
          <input type="hidden" name="claims_contact_phone" value={claimsContactPhone} />
          <input type="hidden" name="claims_contact_email" value={claimsContactEmail} />
          <input type="hidden" name="claims_third_party" value={claimsThirdParty} />

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-[var(--navy)] hover:bg-[var(--navy)]/80 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium h-9 text-sm transition-colors flex items-center justify-center gap-2 shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Complete Enrollment
          </button>
        </form>
      </div>
    </div>
  );
}

return (
  // ... existing AuthCard return below (unchanged)
```

> **Important:** The enrollment `return` exits the function early, so the rest of the component (starting with `return (<AuthCard ...>`) is unchanged — it only renders for steps 0–agreeStepIndex.

- [ ] **Step 9: Update the navigation `step < agreeStepIndex` guard**

In the navigation section at the bottom, the "Next" button condition is:

```tsx
{step < agreeStepIndex && (
```

This is correct — the enrollment step uses its own submit button, not the Next button. No change needed here.

However, the agree step currently has its "Next" button hidden (it's the last step). With the new Enroll step, the agree step should show "Next" to advance to Enroll. Update the condition:

```tsx
{step < (enrollStepIndex ?? agreeStepIndex) && (
```

And remove the `<form>` block that was previously rendered at `step === agreeStepIndex` (it is now moved to the enrollment step's early return). The agree step becomes a "Next" step only.

The old form block:
```tsx
{step === agreeStepIndex && (
  <form action={formAction}>
    ...
    <button type="submit" ...>Create Account</button>
  </form>
)}
```

**Delete this entire block** — the form has moved to the enrollment step's early return above.

- [ ] **Step 10: Run build and fix all TypeScript errors**

```bash
npm run build 2>&1 | grep -E "(error TS|Error)" | head -40
```

Fix any errors. Common ones to expect:
- `facilityName` prop conflict: the component prop is `facilityName` (passed to the invite page from the invite token) — use `facilityName || ""` in the pre-fill. The state variable `officeName` holds the user-entered practice name if `needsOfficeStep`; otherwise use the pre-assigned `facilityName` prop.
- Missing `Check` import: already imported in the existing file.

- [ ] **Step 11: Commit**

```bash
git add app/"(auth)"/invite/\[token\]/signup/"(sections)"/InviteSignUpForm.tsx
git commit -m "feat: add Enroll step to clinical_provider invite signup wizard"
```

---

## Task 3: Add `facility_enrollment` insert to `inviteSignUp` server action

**Files:**
- Modify: `app/(auth)/invite/[token]/signup/(services)/actions.ts`

- [ ] **Step 1: Add the enrollment insert block after `addFacilityMember` and before `has_completed_setup` update**

In `actions.ts`, find this line:
```ts
await addFacilityMember(clinicId, createdUserId, "clinical_provider", {
  isPrimary: true,
  invitedBy: inviteToken.created_by,
});
```

Immediately **after** that `await addFacilityMember(...)` call and **before** the `await supabaseAdmin.from("profiles").update({ has_completed_setup: true })` call, insert:

```ts
// Insert facility_enrollment — fatal; roll back auth user on failure
const { error: enrollError } = await supabaseAdmin
  .from("facility_enrollment")
  .insert({
    facility_id: clinicId,
    facility_npi:               (formData.get("facility_npi") as string)?.trim() || null,
    facility_ein:               (formData.get("facility_ein") as string)?.trim() || null,
    facility_tin:               (formData.get("facility_tin") as string)?.trim() || null,
    facility_ptan:              (formData.get("facility_ptan") as string)?.trim() || null,
    ap_contact_name:            (formData.get("ap_contact_name") as string)?.trim() || null,
    ap_contact_email:           (formData.get("ap_contact_email") as string)?.trim() || null,
    billing_address:            (formData.get("billing_address") as string)?.trim() || null,
    billing_city:               (formData.get("billing_city") as string)?.trim() || null,
    billing_state:              (formData.get("billing_state") as string)?.trim() || null,
    billing_zip:                (formData.get("billing_zip") as string)?.trim() || null,
    billing_phone:              (formData.get("billing_phone") as string)?.trim() || null,
    billing_fax:                (formData.get("billing_fax") as string)?.trim() || null,
    dpa_contact:                (formData.get("dpa_contact") as string)?.trim() || null,
    dpa_contact_email:          (formData.get("dpa_contact_email") as string)?.trim() || null,
    additional_provider_1_name: (formData.get("additional_provider_1_name") as string)?.trim() || null,
    additional_provider_1_npi:  (formData.get("additional_provider_1_npi") as string)?.trim() || null,
    additional_provider_2_name: (formData.get("additional_provider_2_name") as string)?.trim() || null,
    additional_provider_2_npi:  (formData.get("additional_provider_2_npi") as string)?.trim() || null,
    shipping_facility_name:     (formData.get("shipping_facility_name") as string)?.trim() || null,
    shipping_facility_npi:      (formData.get("shipping_facility_npi") as string)?.trim() || null,
    shipping_facility_tin:      (formData.get("shipping_facility_tin") as string)?.trim() || null,
    shipping_facility_ptan:     (formData.get("shipping_facility_ptan") as string)?.trim() || null,
    shipping_contact_name:      (formData.get("shipping_contact_name") as string)?.trim() || null,
    shipping_contact_email:     (formData.get("shipping_contact_email") as string)?.trim() || null,
    shipping_address:           (formData.get("shipping_address") as string)?.trim() || null,
    shipping_days_times:        (formData.get("shipping_days_times") as string)?.trim() || null,
    shipping_phone:             (formData.get("shipping_phone") as string)?.trim() || null,
    shipping_fax:               (formData.get("shipping_fax") as string)?.trim() || null,
    shipping2_facility_name:    (formData.get("shipping2_facility_name") as string)?.trim() || null,
    shipping2_facility_npi:     (formData.get("shipping2_facility_npi") as string)?.trim() || null,
    shipping2_facility_tin:     (formData.get("shipping2_facility_tin") as string)?.trim() || null,
    shipping2_facility_ptan:    (formData.get("shipping2_facility_ptan") as string)?.trim() || null,
    shipping2_contact_name:     (formData.get("shipping2_contact_name") as string)?.trim() || null,
    shipping2_contact_email:    (formData.get("shipping2_contact_email") as string)?.trim() || null,
    shipping2_address:          (formData.get("shipping2_address") as string)?.trim() || null,
    shipping2_days_times:       (formData.get("shipping2_days_times") as string)?.trim() || null,
    shipping2_phone:            (formData.get("shipping2_phone") as string)?.trim() || null,
    shipping2_fax:              (formData.get("shipping2_fax") as string)?.trim() || null,
    claims_contact_name:        (formData.get("claims_contact_name") as string)?.trim() || null,
    claims_contact_phone:       (formData.get("claims_contact_phone") as string)?.trim() || null,
    claims_contact_email:       (formData.get("claims_contact_email") as string)?.trim() || null,
    claims_third_party:         (formData.get("claims_third_party") as string)?.trim() || null,
    completed_at:               new Date().toISOString(),
  });

if (enrollError) {
  console.error("[inviteSignUp] facility_enrollment error:", JSON.stringify(enrollError));
  await supabaseAdmin.auth.admin.deleteUser(createdUserId);
  return { error: "Failed to save enrollment data. Please try again." };
}
```

- [ ] **Step 2: Run build to verify no TypeScript errors**

```bash
npm run build 2>&1 | grep -E "(error TS|Error)" | head -20
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add app/"(auth)"/invite/\[token\]/signup/"(services)"/actions.ts
git commit -m "feat: insert facility_enrollment atomically on clinical_provider signup"
```

---

## Task 4: End-to-end smoke test

- [ ] **Step 1: Run full build**

```bash
npm run build
```

Expected: `✓ Compiled successfully` with zero TypeScript errors.

- [ ] **Step 2: Manual test checklist (dev server)**

Start dev server: `npm run dev`

1. Navigate to an active clinical_provider invite link.
2. Complete steps: Role → Info → Office → Security → Agree.
3. Verify the Agree step's "Create Account" button is gone and a "Next" button appears instead.
4. Click "Next" — should advance to the Enroll full-page layout.
5. Verify the step indicator shows 6 steps with step 6 active.
6. Verify pre-fills: Facility Name, Provider Name, Provider NPI, billing address fields are read-only and pre-populated.
7. Try submitting empty — verify error lists missing fields.
8. Fill all fields and submit.
9. Verify redirect to `/verify-email`.
10. Check Supabase `facility_enrollment` table — verify a row was inserted with the correct `facility_id`.
11. Check Supabase `auth.users` — verify the user was created.
12. Repeat test with a clinical_staff invite — verify they skip the Enroll step entirely (no EnrollmentFormDocument shown).

- [ ] **Step 3: Final commit (if any fixes were needed during smoke test)**

```bash
git add -p
git commit -m "fix: enrollment form smoke test corrections"
```
