# Enrollment Form — Invite Signup Integration

**Date:** 2026-04-11
**Status:** Approved
**Scope:** Add a mandatory Enrollment Form step to the `clinical_provider` invite signup wizard. Collect extended facility billing, shipping, and claims-contact data before account creation is finalized.

---

## 1. Context

When a `clinical_provider` signs up via invite link, they complete a multi-step wizard (Role → Info → Office → Security → Agree). After agreement, a new final step — **Enroll** — collects structured facility data required for order processing (IVR, HCFA-1500 auto-population, claims routing).

The `facility_enrollment` table already exists in the DB with all required columns.

---

## 2. Goals

- Guarantee that every `clinical_provider` account is created with a complete `facility_enrollment` record.
- Collect data in a document-style form matching the existing Enrollment Form PDF.
- Reuse the `EnrollmentFormDocument` component in Settings later (not in scope now).
- Fail the entire signup atomically if the enrollment insert fails — no orphaned accounts.

---

## 3. Non-Goals

- Settings page integration (future task).
- Pre-populating IVR / HCFA forms from enrollment data (future task).
- Enrollment for `clinical_staff` or `sales_representative` roles.

---

## 4. Architecture

### 4.1 New Component

**`app/(auth)/invite/[token]/signup/(components)/EnrollmentFormDocument.tsx`**

- `"use client"` — purely presentational, no internal state.
- Takes all ~40 field values and `onChange` callbacks as props plus `canEdit: boolean`.
- Pre-fill props: `facilityName`, `billingAddress`, `billingCity`, `billingState`, `billingZip`, `billingPhone`, `providerName`, `providerNpi` — wired from earlier wizard steps.
- Styling: white `mx-auto` container, `max-width: 800px`, `border border-[#ddd]`, `shadow-sm`, `padding: 28px 32px`.
- Section headers: amber (`#f59e0b`) background, bold black text — matching the enrollment PDF's orange headers.
- No save/discard bar — submission is handled by the parent wizard.
- Uses bottom-border `FormInput`-style inputs (same as IVR / Order Form documents).
- Info callout at top: *"All fields are required and will be used to process your orders."*

**Sections rendered:**

| # | Section Header | Key Fields |
|---|---|---|
| 1 | Account Billing Information | facility_name (**display-only**, pre-filled from `facilities.name` — not written to enrollment), facility_ein, facility_npi, facility_tin, facility_ptan, ap_contact_name, ap_contact_email, billing_address, billing_city, billing_state, billing_zip, billing_phone, billing_fax, dpa_contact, dpa_contact_email |
| 2 | Provider Information | provider_name (**display-only**, pre-filled from profile — not written to enrollment), provider_npi (**display-only**, pre-filled from provider_credentials — not written to enrollment), additional_provider_1_name, additional_provider_1_npi, additional_provider_2_name, additional_provider_2_npi |
| 3 | Account Shipping Information | shipping_facility_name, shipping_facility_npi, shipping_facility_tin, shipping_facility_ptan, shipping_contact_name, shipping_contact_email, shipping_address, shipping_days_times, shipping_phone, shipping_fax |
| 4 | Additional Shipping Information | shipping2_facility_name, shipping2_facility_npi, shipping2_facility_tin, shipping2_facility_ptan, shipping2_contact_name, shipping2_contact_email, shipping2_address, shipping2_days_times, shipping2_phone, shipping2_fax |
| 5 | Claims Contact Information (Required) | claims_contact_name, claims_contact_phone, claims_contact_email, claims_third_party |

Layout within each section: two-column grid (left: primary fields, right: NPI/TIN/PTAN + fax).

**Footer:** `"Email completed form to Support@MeridianSurgical.com"` + address line + `"REV2.0"`.

---

### 4.2 Step Integration — `InviteSignUpForm.tsx`

**Step arrays** (clinical_provider only gains the Enroll step):

```
WITH needsOfficeStep:    Role(0) → Info(1) → Office(2) → Security(3) → Agree(4) → Enroll(5)
WITHOUT needsOfficeStep: Role(0) → Info(1) → Security(2) → Agree(3) → Enroll(4)
```

Other roles (`sales_representative`, `clinical_staff`) are unchanged.

**New derived index:**
```ts
const enrollStepIndex = role === "clinical_provider"
  ? agreeStepIndex + 1
  : null;
```

**New state (~40 fields, all `string`, initialized `""`):**

Billing group: `facilityEin`, `facilityNpi`, `facilityTin`, `facilityPtan`, `apContactName`, `apContactEmail`, `billingFax`, `dpaContact`, `dpaContactEmail`

Shipping 1: `shippingFacilityName`, `shippingFacilityNpi`, `shippingFacilityTin`, `shippingFacilityPtan`, `shippingContactName`, `shippingContactEmail`, `shippingAddress`, `shippingDaysTimes`, `shippingPhone`, `shippingFax`

Shipping 2: same prefix `shipping2*`

Claims: `claimsContactName`, `claimsContactPhone`, `claimsContactEmail`, `claimsThirdParty`

**Pre-fills wired on render:**
- `officeName` → billing facility name display (passed as prop)
- `officeAddress`, `officeCity`, `officeState`, `officePostalCode` → billing address props
- `officePhone` → billing phone prop
- `${firstName} ${lastName}` → provider name prop
- `npiNumber` → provider NPI prop

**Layout for enrollment step:**

When `step === enrollStepIndex`, the component renders a full-page layout instead of `AuthCard`:

```tsx
<div className="min-h-screen bg-[#F8FAFC] py-6 px-4">
  {/* Top bar: step indicator + Back button */}
  <div className="max-w-[900px] mx-auto mb-4 flex items-center justify-between">
    <StepIndicator ... />
    <BackButton />
  </div>
  {/* Document */}
  <EnrollmentFormDocument ... />
  {/* Bottom: info callout + Submit button */}
  <div className="max-w-[800px] mx-auto mt-6">
    <form action={formAction}>
      {/* all hidden inputs */}
      <SubmitButton />
    </form>
  </div>
</div>
```

**Validation on submit (enrollment step):**

Before the form submits, `goNext` / inline submit validation checks every enrollment field is non-empty (`.trim() !== ""`). If any are missing, `clientError` lists them grouped by section:

```
Billing: Facility NPI, Billing Fax
Shipping: Shipping Contact Email
```

The submit button is disabled while `isPending`.

**`<form>` placement:** Moves from rendering at `step === agreeStepIndex` to `step === enrollStepIndex`. The agree step's "Next" button advances to enrollment (no form action on agree step anymore). All existing hidden inputs (`first_name`, `password`, `office_name`, etc.) plus all new enrollment hidden inputs are rendered on the enrollment step's form.

---

### 4.3 Server Action — `inviteSignUp`

**Location in the action:** Immediately after `createdFacilityId = clinicId` is set and `addFacilityMember` succeeds, before `consumeInviteToken`.

```ts
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

**Rollback:** Uses the existing `createdFacilityId` / `createdUserId` cleanup in the outer `catch`. The explicit error path above also deletes the auth user directly (the facility delete happens in the catch block).

---

## 5. Validation Rules

All enrollment fields must be non-empty strings. Validation runs client-side before submit. The server action does **not** re-validate enrollment completeness — it trusts the client validation (fields are nullable in DB for future Settings edits).

**Required field list by section:**

- **Billing (Section 1):** facility_ein, facility_npi, facility_tin, facility_ptan, ap_contact_name, ap_contact_email, billing_address, billing_city, billing_state, billing_zip, billing_phone, billing_fax, dpa_contact, dpa_contact_email *(facility_name is shown but not validated here — already stored in facilities)*
- **Provider (Section 2):** additional_provider_1_name, additional_provider_1_npi, additional_provider_2_name, additional_provider_2_npi *(provider_name and provider_npi are shown read-only — already stored in profiles / provider_credentials)*
- **Shipping 1 (Section 3):** all 10 shipping fields
- **Shipping 2 (Section 4):** all 10 shipping2 fields
- **Claims (Section 5):** claims_contact_name, claims_contact_phone, claims_contact_email, claims_third_party

---

## 6. File Changes Summary

| File | Type | Change |
|---|---|---|
| `app/(auth)/invite/[token]/signup/(components)/EnrollmentFormDocument.tsx` | **New** | Document-style enrollment form, stateless |
| `app/(auth)/invite/[token]/signup/(sections)/InviteSignUpForm.tsx` | **Modify** | Add Enroll step, ~40 state fields, full-page layout, validation, hidden inputs |
| `app/(auth)/invite/[token]/signup/(services)/actions.ts` | **Modify** | Insert into `facility_enrollment` (fatal), rollback on failure |

No new DB migrations required — `facility_enrollment` table already exists with all needed columns.

---

## 7. Future Work

- **Settings → Enrollment tab:** Reuse `EnrollmentFormDocument` with a `saveEnrollmentData` server action for post-signup edits.
- **Auto-populate IVR/HCFA:** Wire `facility_enrollment` columns into `getOrderIVR` and `getForm1500` to pre-fill facility fields on new orders.
