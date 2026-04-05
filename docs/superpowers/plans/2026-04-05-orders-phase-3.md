# Orders Phase 3 — AI Extraction, IVR Form, 6-Tab Detail Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the Orders feature: replace the 3-step wizard with a single-screen CreateOrderModal, add 6-tab OrderDetailSheet (including read-only AI Order Form + editable IVR Form), wire product adding via the Overview tab, add Order Completion Guide, and update all type definitions to include AI extraction fields.

**Architecture:** Types updated first (interfaces/orders.ts), then server actions simplified/extended, then UI components replaced. DashboardOrder is the primary working type used by Redux + UI. The IVR form auto-saves on blur with debounce. The completion guide intercepts "Edit and Submit Order" if the order is missing required data.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Supabase (postgres + storage), shadcn/ui, Tailwind CSS, React Hot Toast, Zod, Redux Toolkit

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `utils/interfaces/orders.ts` | Modify | Add AI fields to IOrder/DashboardOrder/RawOrderRecord; add IOrderIVR; add order_form to documentTypeSchema; update mapOrder |
| `utils/constants/orders.ts` | Modify | Update ORDER_WITH_RELATIONS_SELECT to include new AI columns |
| `app/(dashboard)/dashboard/orders/(services)/actions.ts` | Modify | Simplify createOrder; add getOrderIVR, upsertOrderIVR, addOrderItems; fix requireClinicRole |
| `app/(dashboard)/dashboard/orders/(components)/CreateOrderModal.tsx` | Rewrite | Single-screen modal: wound type + date + 3 upload zones |
| `app/(dashboard)/dashboard/orders/(components)/OrderDetailSheet.tsx` | Rewrite | 6-tab sheet: Overview, Order Form, IVR Form, Documents, Conversation, History |
| `app/(dashboard)/dashboard/orders/(components)/OrderIVRForm.tsx` | Create | Editable IVR form with auto-save on blur (debounce 800ms) |
| `app/(dashboard)/dashboard/orders/(components)/OrderCompletionGuide.tsx` | Create | Completion check modal shown before submitForSignature |
| `app/(dashboard)/dashboard/orders/(components)/OrderCard.tsx` | Modify | Update Draft button label + flow; keep other statuses |
| `app/(dashboard)/dashboard/orders/(sections)/OrdersPageClient.tsx` | Modify | Pass isSupport + canSign to OrderDetailSheet |

---

## Task 1: Update interfaces/orders.ts — types, AI fields, IOrderIVR

**Files:**
- Modify: `utils/interfaces/orders.ts`

- [ ] **Step 1.1: Add `order_form` to documentTypeSchema**

In `utils/interfaces/orders.ts`, find `documentTypeSchema` and add `"order_form"`:

```typescript
export const documentTypeSchema = z.enum([
  "facesheet",
  "clinical_docs",
  "wound_pictures",
  "order_form",
  "form_1500",
  "additional_ivr",
  "other",
]);
```

- [ ] **Step 1.2: Add AI fields to IOrder**

Find `export interface IOrder {` and add after the existing `assignedProviderId` line:

```typescript
  // AI extraction fields
  aiExtracted: boolean;
  aiExtractedAt: string | null;
  orderFormLocked: boolean;
  woundVisitNumber: number | null;
  chiefComplaint: string | null;
  hasVasculitisOrBurns: boolean;
  isReceivingHomeHealth: boolean;
  isPatientAtSnf: boolean;
  icd10Code: string | null;
  followupDays: number | null;
```

- [ ] **Step 1.3: Add IOrderIVR interface**

After `IOrderHistory` definition, add:

```typescript
export interface IOrderIVR {
  id: string;
  orderId: string;
  insuranceProvider: string | null;
  insurancePhone: string | null;
  memberId: string | null;
  groupNumber: string | null;
  planName: string | null;
  planType: string | null;
  subscriberName: string | null;
  subscriberDob: string | null;
  subscriberRelationship: string | null;
  coverageStartDate: string | null;
  coverageEndDate: string | null;
  deductibleAmount: number | null;
  deductibleMet: number | null;
  outOfPocketMax: number | null;
  outOfPocketMet: number | null;
  copayAmount: number | null;
  coinsurancePercent: number | null;
  dmeCovered: boolean;
  woundCareCovered: boolean;
  priorAuthRequired: boolean;
  priorAuthNumber: string | null;
  priorAuthStartDate: string | null;
  priorAuthEndDate: string | null;
  unitsAuthorized: number | null;
  verifiedBy: string | null;
  verifiedDate: string | null;
  verificationReference: string | null;
  notes: string | null;
  aiExtracted: boolean;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 1.4: Add AI fields to DashboardOrder type**

Find `export type DashboardOrder = {` and add after `assigned_provider_id` line (before the `// from order_items` comment):

```typescript
  // AI extraction
  ai_extracted: boolean;
  ai_extracted_at: string | null;
  order_form_locked: boolean;
  wound_visit_number: number | null;
  chief_complaint: string | null;
  has_vasculitis_or_burns: boolean;
  is_receiving_home_health: boolean;
  is_patient_at_snf: boolean;
  icd10_code: string | null;
  followup_days: number | null;
```

- [ ] **Step 1.5: Add AI fields to RawOrderRecord**

Find `export type RawOrderRecord = {` and add after `assigned_provider_id` line:

```typescript
  // AI extraction
  wound_visit_number: number | null;
  chief_complaint: string | null;
  has_vasculitis_or_burns: boolean | null;
  is_receiving_home_health: boolean | null;
  is_patient_at_snf: boolean | null;
  icd10_code: string | null;
  followup_days: number | null;
  ai_extracted: boolean | null;
  ai_extracted_at: string | null;
  order_form_locked: boolean | null;
```

- [ ] **Step 1.6: Update mapOrder to map AI fields**

In the `mapOrder` function, after `assigned_provider_id: raw.assigned_provider_id,` add:

```typescript
    // AI extraction
    ai_extracted: raw.ai_extracted ?? false,
    ai_extracted_at: raw.ai_extracted_at ?? null,
    order_form_locked: raw.order_form_locked ?? false,
    wound_visit_number: raw.wound_visit_number ?? null,
    chief_complaint: raw.chief_complaint ?? null,
    has_vasculitis_or_burns: raw.has_vasculitis_or_burns ?? false,
    is_receiving_home_health: raw.is_receiving_home_health ?? false,
    is_patient_at_snf: raw.is_patient_at_snf ?? false,
    icd10_code: raw.icd10_code ?? null,
    followup_days: raw.followup_days ?? null,
```

- [ ] **Step 1.7: Commit**

```bash
git add utils/interfaces/orders.ts
git commit -m "feat(orders): add AI extraction fields + IOrderIVR interface + order_form doc type"
```

---

## Task 2: Update actions.ts — ORDER_WITH_RELATIONS_SELECT + query columns

**Files:**
- Modify: `app/(dashboard)/dashboard/orders/(services)/actions.ts` (lines ~101-111)

- [ ] **Step 2.1: Update the local ORDER_WITH_RELATIONS_SELECT constant**

Find the `const ORDER_WITH_RELATIONS_SELECT = \`` block (around line 101) and replace the entire constant value to add AI fields:

```typescript
const ORDER_WITH_RELATIONS_SELECT = `
  id, order_number, facility_id, order_status,
  payment_method, payment_status, invoice_status,
  fulfillment_status, delivery_status, tracking_number,
  notes, placed_at, paid_at, delivered_at, created_at, updated_at,
  created_by, signed_by, signed_at, wound_type, date_of_service,
  patient_id, assigned_provider_id,
  wound_visit_number, chief_complaint,
  has_vasculitis_or_burns, is_receiving_home_health,
  is_patient_at_snf, icd10_code, followup_days,
  ai_extracted, ai_extracted_at, order_form_locked,
  patients (id, facility_id, first_name, last_name, date_of_birth, patient_ref, notes, is_active, created_at, updated_at),
  order_items (id, order_id, product_id, product_name, product_sku, unit_price, quantity, shipping_amount, tax_amount, subtotal, total_amount, created_at, updated_at),
  facilities (id, name)
`;
```

- [ ] **Step 2.2: Update requireClinicRole to also accept support_staff for IVR actions**

Add a new helper below `requireClinicRole`:

```typescript
async function requireIVREditRole(): Promise<{
  userId: string;
  role: string;
}> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const role = await getUserRole(supabase);

  const allowed =
    isClinicSide(role) ||
    role === "support_staff";
  if (!allowed) {
    throw new Error("Only clinical staff, providers, or support staff can edit IVR records.");
  }

  return { userId: user.id, role: role! };
}
```

- [ ] **Step 2.3: Commit**

```bash
git add app/(dashboard)/dashboard/orders/(services)/actions.ts
git commit -m "feat(orders): update SELECT query with AI columns + add requireIVREditRole"
```

---

## Task 3: Simplify createOrder server action

**Files:**
- Modify: `app/(dashboard)/dashboard/orders/(services)/actions.ts`

The current `createOrder` takes `FormData` with patient_id + items. Replace with plain-args signature that only needs wound_type, date_of_service, notes.

- [ ] **Step 3.1: Replace createOrder function**

Find and replace the entire `createOrder` function (from `export async function createOrder(` to its closing `}`). Replace with:

```typescript
export async function createOrder(data: {
  wound_type: "chronic" | "post_surgical";
  date_of_service: string;
  notes?: string | null;
}): Promise<IOrderFormState> {
  try {
    const { userId, facilityId } = await requireClinicRole();

    if (!data.wound_type) return { success: false, error: "Wound type is required." };
    if (!data.date_of_service) return { success: false, error: "Date of service is required." };

    const adminClient = createAdminClient();
    const orderNumber = generateOrderNumber();

    const { data: orderRow, error: orderErr } = await adminClient
      .from("orders")
      .insert({
        order_number: orderNumber,
        facility_id: facilityId,
        order_status: "draft",
        payment_method: null,
        payment_status: "pending",
        invoice_status: "not_applicable",
        fulfillment_status: "pending",
        delivery_status: "not_shipped",
        tracking_number: null,
        notes: data.notes?.trim() || null,
        placed_at: new Date().toISOString(),
        paid_at: null,
        delivered_at: null,
        created_by: userId,
        wound_type: data.wound_type,
        date_of_service: data.date_of_service,
        patient_id: null,
        assigned_provider_id: null,
        ai_extracted: false,
        order_form_locked: false,
      })
      .select("id")
      .single();

    if (orderErr || !orderRow) {
      console.error("[createOrder] order insert:", JSON.stringify(orderErr));
      return { success: false, error: "Failed to create order." };
    }

    const orderId = orderRow.id;
    await insertOrderHistory(adminClient, orderId, "Order created as draft", null, "draft", userId);

    revalidatePath(ORDERS_PATH);
    return { success: true, error: null, orderId };
  } catch (err) {
    console.error("[createOrder] unexpected:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}
```

- [ ] **Step 3.2: Commit**

```bash
git add app/(dashboard)/dashboard/orders/(services)/actions.ts
git commit -m "feat(orders): simplify createOrder — no patient/items required, plain args"
```

---

## Task 4: Add IVR server actions

**Files:**
- Modify: `app/(dashboard)/dashboard/orders/(services)/actions.ts`

Add two new exports at the end of actions.ts.

- [ ] **Step 4.1: Add getOrderIVR action**

Append to the end of actions.ts:

```typescript
/* -------------------------------------------------------------------------- */
/* getOrderIVR                                                                 */
/* -------------------------------------------------------------------------- */

export async function getOrderIVR(
  orderId: string,
): Promise<IOrderIVR | null> {
  try {
    const supabase = await createClient();
    await getCurrentUserOrThrow(supabase);

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from("order_ivr")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();

    if (error) {
      console.error("[getOrderIVR]", JSON.stringify(error));
      return null;
    }
    if (!data) return null;

    return {
      id: data.id,
      orderId: data.order_id,
      insuranceProvider: data.insurance_provider,
      insurancePhone: data.insurance_phone,
      memberId: data.member_id,
      groupNumber: data.group_number,
      planName: data.plan_name,
      planType: data.plan_type,
      subscriberName: data.subscriber_name,
      subscriberDob: data.subscriber_dob,
      subscriberRelationship: data.subscriber_relationship,
      coverageStartDate: data.coverage_start_date,
      coverageEndDate: data.coverage_end_date,
      deductibleAmount: data.deductible_amount != null ? Number(data.deductible_amount) : null,
      deductibleMet: data.deductible_met != null ? Number(data.deductible_met) : null,
      outOfPocketMax: data.out_of_pocket_max != null ? Number(data.out_of_pocket_max) : null,
      outOfPocketMet: data.out_of_pocket_met != null ? Number(data.out_of_pocket_met) : null,
      copayAmount: data.copay_amount != null ? Number(data.copay_amount) : null,
      coinsurancePercent: data.coinsurance_percent != null ? Number(data.coinsurance_percent) : null,
      dmeCovered: data.dme_covered ?? false,
      woundCareCovered: data.wound_care_covered ?? false,
      priorAuthRequired: data.prior_auth_required ?? false,
      priorAuthNumber: data.prior_auth_number,
      priorAuthStartDate: data.prior_auth_start_date,
      priorAuthEndDate: data.prior_auth_end_date,
      unitsAuthorized: data.units_authorized,
      verifiedBy: data.verified_by,
      verifiedDate: data.verified_date,
      verificationReference: data.verification_reference,
      notes: data.notes,
      aiExtracted: data.ai_extracted ?? false,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (err) {
    console.error("[getOrderIVR] unexpected:", err);
    return null;
  }
}
```

Note: `IOrderIVR` must be imported at the top of actions.ts. Add it to the import from `@/utils/interfaces/orders`.

- [ ] **Step 4.2: Add upsertOrderIVR action**

Append to end of actions.ts:

```typescript
/* -------------------------------------------------------------------------- */
/* upsertOrderIVR                                                              */
/* -------------------------------------------------------------------------- */

export async function upsertOrderIVR(
  orderId: string,
  data: Partial<IOrderIVR>,
): Promise<{ success: boolean; error: string | null }> {
  try {
    await requireIVREditRole();
    const adminClient = createAdminClient();

    const payload: Record<string, unknown> = { order_id: orderId };
    if (data.insuranceProvider !== undefined) payload.insurance_provider = data.insuranceProvider;
    if (data.insurancePhone !== undefined) payload.insurance_phone = data.insurancePhone;
    if (data.memberId !== undefined) payload.member_id = data.memberId;
    if (data.groupNumber !== undefined) payload.group_number = data.groupNumber;
    if (data.planName !== undefined) payload.plan_name = data.planName;
    if (data.planType !== undefined) payload.plan_type = data.planType;
    if (data.subscriberName !== undefined) payload.subscriber_name = data.subscriberName;
    if (data.subscriberDob !== undefined) payload.subscriber_dob = data.subscriberDob;
    if (data.subscriberRelationship !== undefined) payload.subscriber_relationship = data.subscriberRelationship;
    if (data.coverageStartDate !== undefined) payload.coverage_start_date = data.coverageStartDate;
    if (data.coverageEndDate !== undefined) payload.coverage_end_date = data.coverageEndDate;
    if (data.deductibleAmount !== undefined) payload.deductible_amount = data.deductibleAmount;
    if (data.deductibleMet !== undefined) payload.deductible_met = data.deductibleMet;
    if (data.outOfPocketMax !== undefined) payload.out_of_pocket_max = data.outOfPocketMax;
    if (data.outOfPocketMet !== undefined) payload.out_of_pocket_met = data.outOfPocketMet;
    if (data.copayAmount !== undefined) payload.copay_amount = data.copayAmount;
    if (data.coinsurancePercent !== undefined) payload.coinsurance_percent = data.coinsurancePercent;
    if (data.dmeCovered !== undefined) payload.dme_covered = data.dmeCovered;
    if (data.woundCareCovered !== undefined) payload.wound_care_covered = data.woundCareCovered;
    if (data.priorAuthRequired !== undefined) payload.prior_auth_required = data.priorAuthRequired;
    if (data.priorAuthNumber !== undefined) payload.prior_auth_number = data.priorAuthNumber;
    if (data.priorAuthStartDate !== undefined) payload.prior_auth_start_date = data.priorAuthStartDate;
    if (data.priorAuthEndDate !== undefined) payload.prior_auth_end_date = data.priorAuthEndDate;
    if (data.unitsAuthorized !== undefined) payload.units_authorized = data.unitsAuthorized;
    if (data.verifiedBy !== undefined) payload.verified_by = data.verifiedBy;
    if (data.verifiedDate !== undefined) payload.verified_date = data.verifiedDate;
    if (data.verificationReference !== undefined) payload.verification_reference = data.verificationReference;
    if (data.notes !== undefined) payload.notes = data.notes;

    const { error } = await adminClient
      .from("order_ivr")
      .upsert(payload, { onConflict: "order_id" });

    if (error) {
      console.error("[upsertOrderIVR]", JSON.stringify(error));
      return { success: false, error: error.message ?? "Failed to save IVR." };
    }

    revalidatePath(ORDERS_PATH);
    return { success: true, error: null };
  } catch (err) {
    console.error("[upsertOrderIVR] unexpected:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}
```

- [ ] **Step 4.3: Add IOrderIVR to actions.ts import**

Find the import line near the top of actions.ts:
```typescript
import type {
  DashboardOrder,
  IOrderDocument,
  IOrderHistory,
  IOrderMessage,
  IPatient,
  IOrderFormState,
  InsertOrderPayload,
  InsertOrderItemPayload,
  ProductRecord,
  RawOrderRecord,
  WoundType,
  OrderStatus,
} from "@/utils/interfaces/orders";
```

Add `IOrderIVR` to the list.

- [ ] **Step 4.4: Commit**

```bash
git add app/(dashboard)/dashboard/orders/(services)/actions.ts
git commit -m "feat(orders): add getOrderIVR + upsertOrderIVR server actions"
```

---

## Task 5: Add addOrderItems server action

**Files:**
- Modify: `app/(dashboard)/dashboard/orders/(services)/actions.ts`

- [ ] **Step 5.1: Add addOrderItems action**

Append to end of actions.ts:

```typescript
/* -------------------------------------------------------------------------- */
/* addOrderItems                                                               */
/* -------------------------------------------------------------------------- */

export async function addOrderItems(
  orderId: string,
  items: Array<{
    product_id: string;
    product_name: string;
    product_sku: string;
    unit_price: number;
    quantity: number;
  }>,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { userId } = await requireClinicRole();
    const adminClient = createAdminClient();

    // Verify order exists and is draft
    const { data: order } = await adminClient
      .from("orders")
      .select("id, order_status")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) return { success: false, error: "Order not found." };
    if (order.order_status !== "draft") {
      return { success: false, error: "Products can only be added to draft orders." };
    }

    const itemPayloads = items.map((item) => ({
      order_id: orderId,
      product_id: item.product_id,
      product_name: item.product_name,
      product_sku: item.product_sku,
      unit_price: item.unit_price,
      quantity: item.quantity,
      shipping_amount: 0,
      tax_amount: 0,
    }));

    const { error } = await adminClient.from("order_items").insert(itemPayloads);

    if (error) {
      console.error("[addOrderItems]", JSON.stringify(error));
      return { success: false, error: "Failed to add products." };
    }

    await insertOrderHistory(adminClient, orderId, "Products added to order", null, null, userId);
    revalidatePath(ORDERS_PATH);
    return { success: true, error: null };
  } catch (err) {
    console.error("[addOrderItems] unexpected:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}
```

- [ ] **Step 5.2: Commit**

```bash
git add app/(dashboard)/dashboard/orders/(services)/actions.ts
git commit -m "feat(orders): add addOrderItems server action"
```

---

## Task 6: Rewrite CreateOrderModal as single-screen

**Files:**
- Modify: `app/(dashboard)/dashboard/orders/(components)/CreateOrderModal.tsx`

Replace the entire file content. The new modal is a single screen (no stepper), with three sections: Clinical Info, Documents (3 upload zones), and a footer with Cancel + Submit.

- [ ] **Step 6.1: Replace CreateOrderModal.tsx**

```typescript
"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2, Upload, X, FileText } from "lucide-react";
import { createOrder, uploadOrderDocument } from "../(services)/actions";
import { useAppDispatch } from "@/store/hooks";
import { addOrderToStore } from "../(redux)/orders-slice";
import toast from "react-hot-toast";
import { cn } from "@/utils/utils";

type DocFile = { file: File; type: string };

const WOUND_TYPES = [
  { value: "chronic" as const, label: "Chronic" },
  { value: "post_surgical" as const, label: "Post-Surgical" },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.heic,image/*";

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface UploadZoneProps {
  label: string;
  description: string;
  docType: string;
  required: boolean;
  multiple?: boolean;
  files: DocFile[];
  onAdd: (files: File[], type: string) => void;
  onRemove: (idx: number) => void;
  error?: boolean;
}

function UploadZone({
  label,
  description,
  docType,
  required,
  multiple,
  files,
  onAdd,
  onRemove,
  error,
}: UploadZoneProps) {
  const typeFiles = files.filter((f) => f.type === docType);
  const globalIdx = (localIdx: number) => {
    let count = 0;
    for (let i = 0; i < files.length; i++) {
      if (files[i].type === docType) {
        if (count === localIdx) return i;
        count++;
      }
    }
    return -1;
  };

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1 mb-1.5">
        <span className="text-xs font-semibold text-slate-700">{label}</span>
        {required && <span className="text-red-500 text-xs">*</span>}
      </div>
      <p className="text-[11px] text-slate-400 mb-2">{description}</p>

      {typeFiles.length === 0 ? (
        <label
          className={cn(
            "flex flex-col items-center justify-center border-2 border-dashed rounded-xl px-3 py-4 cursor-pointer transition-all text-center",
            error
              ? "border-red-300 bg-red-50"
              : "border-slate-200 bg-slate-50 hover:border-[#15689E]/50 hover:bg-blue-50/30"
          )}
        >
          <Upload className="w-5 h-5 text-slate-300 mb-1.5" />
          <span className="text-xs text-slate-500">
            Drag & drop or{" "}
            <span className="text-[#15689E] font-medium">browse</span>
          </span>
          <span className="text-[11px] text-slate-400 mt-1">PDF, JPG, PNG, HEIC · max 10 MB</span>
          <input
            type="file"
            className="hidden"
            accept={ACCEPT}
            multiple={multiple}
            onChange={(e) => {
              const selected = Array.from(e.target.files ?? []);
              const valid = selected.filter((f) => {
                if (f.size > MAX_FILE_SIZE) {
                  toast.error(`${f.name} exceeds 10 MB.`);
                  return false;
                }
                return true;
              });
              if (valid.length) onAdd(valid, docType);
              e.target.value = "";
            }}
          />
        </label>
      ) : (
        <div className="space-y-1">
          {typeFiles.map((df, localIdx) => (
            <div
              key={localIdx}
              className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-xs text-slate-700 flex-1 truncate">{df.file.name}</span>
              <span className="text-[11px] text-slate-400 shrink-0">{formatSize(df.file.size)}</span>
              <button
                type="button"
                onClick={() => onRemove(globalIdx(localIdx))}
                className="text-slate-300 hover:text-red-400 transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <label className="flex items-center gap-1 text-[11px] text-[#15689E] hover:underline cursor-pointer mt-1">
            <Plus className="w-3 h-3" />
            Add more
            <input
              type="file"
              className="hidden"
              accept={ACCEPT}
              multiple={multiple}
              onChange={(e) => {
                const selected = Array.from(e.target.files ?? []);
                const valid = selected.filter((f) => {
                  if (f.size > MAX_FILE_SIZE) {
                    toast.error(`${f.name} exceeds 10 MB.`);
                    return false;
                  }
                  return true;
                });
                if (valid.length) onAdd(valid, docType);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
}

export function CreateOrderModal() {
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const [woundType, setWoundType] = useState<"chronic" | "post_surgical">("chronic");
  const [dateOfService, setDateOfService] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");
  const [docs, setDocs] = useState<DocFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  function reset() {
    setWoundType("chronic");
    setDateOfService(new Date().toISOString().split("T")[0]);
    setNotes("");
    setDocs([]);
    setUploadProgress(null);
    setSubmitted(false);
  }

  function addDocs(files: File[], type: string) {
    setDocs((prev) => [...prev, ...files.map((f) => ({ file: f, type }))]);
  }

  function removeDoc(idx: number) {
    setDocs((prev) => prev.filter((_, i) => i !== idx));
  }

  const hasFacesheet = docs.some((d) => d.type === "facesheet");
  const needsWoundPics = woundType === "chronic";
  const hasWoundPics = docs.some((d) => d.type === "wound_pictures");

  const canSubmit =
    !!woundType &&
    !!dateOfService &&
    hasFacesheet &&
    (!needsWoundPics || hasWoundPics);

  function handleClose() {
    if (!isPending) {
      setOpen(false);
      reset();
    }
  }

  function handleSubmit() {
    setSubmitted(true);
    if (!canSubmit) return;

    startTransition(async () => {
      const result = await createOrder({
        wound_type: woundType,
        date_of_service: dateOfService,
        notes: notes.trim() || null,
      });

      if (!result.success || !result.orderId) {
        toast.error(result.error ?? "Failed to create order.");
        return;
      }

      const orderId = result.orderId;

      // Upload documents
      for (let i = 0; i < docs.length; i++) {
        const d = docs[i];
        setUploadProgress(`Uploading ${i + 1}/${docs.length}: ${d.file.name}`);
        const docFd = new FormData();
        docFd.set("file", d.file);
        const res = await uploadOrderDocument(orderId, d.type as import("@/utils/interfaces/orders").DocumentType, docFd);
        if (!res.success) {
          toast.error(`Failed to upload ${d.file.name}: ${res.error}`);
        }
      }

      setUploadProgress(null);
      toast.success("Order created. Upload confirmed.");
      setOpen(false);
      reset();
    });
  }

  const facesheetError = submitted && !hasFacesheet;
  const woundPicsError = submitted && needsWoundPics && !hasWoundPics;

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-[#15689E] hover:bg-[#125d8e] text-white cursor-pointer rounded-lg shadow-sm"
      >
        <Plus className="w-4 h-4 mr-2" />
        New Order
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-2xl border-[#E2E8F0] shadow-2xl p-0">
          {/* Header */}
          <div className="sticky top-0 bg-white z-10 px-6 pt-5 pb-4 border-b border-[#E2E8F0]">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-[#0F172A]">
                Create Order
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-6">
            {/* Section 1 — Clinical Info */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Clinical Info
              </h3>

              {/* Wound Type */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Wound Type <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-3">
                  {WOUND_TYPES.map((wt) => (
                    <button
                      key={wt.value}
                      type="button"
                      onClick={() => setWoundType(wt.value)}
                      className={cn(
                        "flex-1 py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all",
                        woundType === wt.value
                          ? "border-[#15689E] bg-blue-50 text-[#15689E]"
                          : "border-slate-200 text-slate-600 hover:border-slate-300"
                      )}
                    >
                      {wt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date of Service */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Date of Service <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={dateOfService}
                    max={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setDateOfService(e.target.value)}
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#15689E]/20 focus:border-[#15689E]"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-slate-200 text-slate-600 text-xs shrink-0"
                    onClick={() =>
                      setDateOfService(new Date().toISOString().split("T")[0])
                    }
                  >
                    Today
                  </Button>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Notes (optional)</label>
                <Textarea
                  placeholder="Clinical notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>
            </div>

            {/* Section 2 — Documents */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Documents
              </h3>

              {/* Facesheet + Clinical Docs side by side */}
              <div className="flex gap-3">
                <UploadZone
                  label="Patient Facesheet"
                  description="Insurance & demographics"
                  docType="facesheet"
                  required
                  files={docs}
                  onAdd={addDocs}
                  onRemove={removeDoc}
                  error={facesheetError}
                />
                <UploadZone
                  label="Clinical Documentation"
                  description="Doctor's notes, records"
                  docType="clinical_docs"
                  required={false}
                  multiple
                  files={docs}
                  onAdd={addDocs}
                  onRemove={removeDoc}
                />
              </div>

              {/* Facesheet error */}
              {facesheetError && (
                <p className="text-xs text-red-500">Patient facesheet is required.</p>
              )}

              {/* Wound Pictures */}
              <UploadZone
                label="Wound Pictures"
                description="Multiple images allowed"
                docType="wound_pictures"
                required={needsWoundPics}
                multiple
                files={docs}
                onAdd={addDocs}
                onRemove={removeDoc}
                error={woundPicsError}
              />
              {woundPicsError && (
                <p className="text-xs text-red-500">Wound pictures are required for chronic wounds.</p>
              )}
            </div>

            {/* Upload progress */}
            {uploadProgress && (
              <div className="flex items-center gap-2 text-sm text-slate-600 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500 shrink-0" />
                {uploadProgress}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white border-t border-[#E2E8F0] px-6 py-4 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              className="border-[#E2E8F0]"
              disabled={isPending}
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isPending}
              onClick={handleSubmit}
              className="bg-[#15689E] hover:bg-[#125d8e] text-white"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                "Submit →"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 6.2: Commit**

```bash
git add app/(dashboard)/dashboard/orders/(components)/CreateOrderModal.tsx
git commit -m "feat(orders): rewrite CreateOrderModal as single-screen (no wizard, no patient/products)"
```

---

## Task 7: Create OrderIVRForm component

**Files:**
- Create: `app/(dashboard)/dashboard/orders/(components)/OrderIVRForm.tsx`

- [ ] **Step 7.1: Create OrderIVRForm.tsx**

```typescript
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle } from "lucide-react";
import { getOrderIVR, upsertOrderIVR } from "../(services)/actions";
import type { IOrderIVR } from "@/utils/interfaces/orders";
import { cn } from "@/utils/utils";

interface OrderIVRFormProps {
  orderId: string;
  canEdit: boolean;
}

type IVRField = keyof Omit<IOrderIVR, "id" | "orderId" | "aiExtracted" | "createdAt" | "updatedAt">;

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function OrderIVRForm({ orderId, canEdit }: OrderIVRFormProps) {
  const [ivr, setIvr] = useState<Partial<IOrderIVR>>({});
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getOrderIVR(orderId).then((data) => {
      if (data) setIvr(data);
      setLoading(false);
    });
  }, [orderId]);

  const scheduleSave = useCallback(
    (field: IVRField, value: unknown) => {
      if (!canEdit) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setSaveStatus("saving");
        const result = await upsertOrderIVR(orderId, { [field]: value });
        if (result.success) {
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);
        } else {
          setSaveStatus("error");
          setTimeout(() => setSaveStatus("idle"), 3000);
        }
      }, 800);
    },
    [orderId, canEdit]
  );

  function handleChange(field: IVRField, value: string | number | boolean | null) {
    setIvr((prev) => ({ ...prev, [field]: value }));
    scheduleSave(field, value);
  }

  function textInput(field: IVRField, placeholder?: string) {
    return (
      <Input
        value={(ivr[field] as string) ?? ""}
        placeholder={placeholder}
        disabled={!canEdit}
        className="text-sm"
        onChange={(e) => handleChange(field, e.target.value || null)}
      />
    );
  }

  function numberInput(field: IVRField, prefix?: string) {
    return (
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
            {prefix}
          </span>
        )}
        <Input
          type="number"
          value={(ivr[field] as number) ?? ""}
          disabled={!canEdit}
          className={cn("text-sm", prefix ? "pl-7" : "")}
          onChange={(e) =>
            handleChange(field, e.target.value ? Number(e.target.value) : null)
          }
        />
      </div>
    );
  }

  function dateInput(field: IVRField) {
    return (
      <Input
        type="date"
        value={(ivr[field] as string) ?? ""}
        disabled={!canEdit}
        className="text-sm"
        onChange={(e) => handleChange(field, e.target.value || null)}
      />
    );
  }

  function yesNoRadio(field: IVRField) {
    const val = ivr[field] as boolean | undefined;
    return (
      <div className="flex gap-3">
        {([true, false] as const).map((v) => (
          <button
            key={String(v)}
            type="button"
            disabled={!canEdit}
            onClick={() => handleChange(field, v)}
            className={cn(
              "flex-1 py-1.5 text-xs font-medium rounded-lg border-2 transition-all",
              val === v
                ? "border-[#15689E] bg-blue-50 text-[#15689E]"
                : "border-slate-200 text-slate-500 hover:border-slate-300",
              !canEdit && "opacity-60 cursor-not-allowed"
            )}
          >
            {v ? "Yes" : "No"}
          </button>
        ))}
      </div>
    );
  }

  function selectInput(field: IVRField, options: { value: string; label: string }[]) {
    return (
      <select
        value={(ivr[field] as string) ?? ""}
        disabled={!canEdit}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#15689E]/20 focus:border-[#15689E] bg-white disabled:opacity-60"
        onChange={(e) => handleChange(field, e.target.value || null)}
      >
        <option value="">Select...</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-4">
      {/* Save status banner */}
      {saveStatus !== "idle" && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium",
            saveStatus === "saving" && "bg-blue-50 text-blue-700",
            saveStatus === "saved" && "bg-green-50 text-green-700",
            saveStatus === "error" && "bg-red-50 text-red-700"
          )}
        >
          {saveStatus === "saving" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {saveStatus === "saved" && <CheckCircle className="w-3.5 h-3.5" />}
          {saveStatus === "saving" && "Saving..."}
          {saveStatus === "saved" && "Change is saved"}
          {saveStatus === "error" && "Failed to save — please try again"}
        </div>
      )}

      {!canEdit && (
        <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          You have read-only access to this IVR record.
        </p>
      )}

      {/* Insurance Information */}
      <FormSection title="Insurance Information">
        <FieldRow label="Insurance Provider">{textInput("insuranceProvider", "e.g. Blue Cross")}</FieldRow>
        <FieldRow label="Plan Name">{textInput("planName")}</FieldRow>
        <FieldRow label="Plan Type">
          {selectInput("planType", [
            { value: "Medicare", label: "Medicare" },
            { value: "Medicaid", label: "Medicaid" },
            { value: "HMO", label: "HMO" },
            { value: "PPO", label: "PPO" },
            { value: "Other", label: "Other" },
          ])}
        </FieldRow>
        <FieldRow label="Member ID">{textInput("memberId")}</FieldRow>
        <FieldRow label="Group Number">{textInput("groupNumber")}</FieldRow>
        <FieldRow label="Insurance Phone">{textInput("insurancePhone", "1-800-...")}</FieldRow>
      </FormSection>

      {/* Subscriber Details */}
      <FormSection title="Subscriber Details">
        <FieldRow label="Subscriber Name">{textInput("subscriberName")}</FieldRow>
        <FieldRow label="Subscriber DOB">{dateInput("subscriberDob")}</FieldRow>
        <FieldRow label="Relationship">
          {selectInput("subscriberRelationship", [
            { value: "Self", label: "Self" },
            { value: "Spouse", label: "Spouse" },
            { value: "Child", label: "Child" },
            { value: "Other", label: "Other" },
          ])}
        </FieldRow>
      </FormSection>

      {/* Coverage Details */}
      <FormSection title="Coverage Details">
        <FieldRow label="Coverage Start">{dateInput("coverageStartDate")}</FieldRow>
        <FieldRow label="Coverage End">{dateInput("coverageEndDate")}</FieldRow>
        <FieldRow label="Deductible Amount">{numberInput("deductibleAmount", "$")}</FieldRow>
        <FieldRow label="Deductible Met">{numberInput("deductibleMet", "$")}</FieldRow>
        <FieldRow label="Out of Pocket Max">{numberInput("outOfPocketMax", "$")}</FieldRow>
        <FieldRow label="Out of Pocket Met">{numberInput("outOfPocketMet", "$")}</FieldRow>
        <FieldRow label="Copay Amount">{numberInput("copayAmount", "$")}</FieldRow>
        <FieldRow label="Coinsurance">{numberInput("coinsurancePercent", "%")}</FieldRow>
      </FormSection>

      {/* DME / Wound Care Coverage */}
      <FormSection title="DME / Wound Care Coverage">
        <FieldRow label="DME Covered?">{yesNoRadio("dmeCovered")}</FieldRow>
        <FieldRow label="Wound Care Covered?">{yesNoRadio("woundCareCovered")}</FieldRow>
        <FieldRow label="Prior Auth Required?">{yesNoRadio("priorAuthRequired")}</FieldRow>
        {ivr.priorAuthRequired && (
          <>
            <FieldRow label="Prior Auth Number">{textInput("priorAuthNumber")}</FieldRow>
            <FieldRow label="Auth Start Date">{dateInput("priorAuthStartDate")}</FieldRow>
            <FieldRow label="Auth End Date">{dateInput("priorAuthEndDate")}</FieldRow>
            <FieldRow label="Units Authorized">{numberInput("unitsAuthorized")}</FieldRow>
          </>
        )}
      </FormSection>

      {/* Verification Details */}
      <FormSection title="Verification Details">
        <FieldRow label="Verified By">{textInput("verifiedBy", "Name of person who called")}</FieldRow>
        <FieldRow label="Verified Date">{dateInput("verifiedDate")}</FieldRow>
        <FieldRow label="Reference Number">{textInput("verificationReference", "Call reference #")}</FieldRow>
        <FieldRow label="Notes">
          <Textarea
            value={(ivr.notes as string) ?? ""}
            placeholder="Additional notes..."
            disabled={!canEdit}
            rows={3}
            className="text-sm resize-none"
            onChange={(e) => handleChange("notes", e.target.value || null)}
          />
        </FieldRow>
      </FormSection>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">{title}</h4>
      <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white">
        {children}
      </div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5">
      <span className="text-xs text-slate-500 w-36 shrink-0 pt-2">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
```

- [ ] **Step 7.2: Commit**

```bash
git add app/(dashboard)/dashboard/orders/(components)/OrderIVRForm.tsx
git commit -m "feat(orders): create OrderIVRForm with auto-save debounce 800ms"
```

---

## Task 8: Create OrderCompletionGuide component

**Files:**
- Create: `app/(dashboard)/dashboard/orders/(components)/OrderCompletionGuide.tsx`

- [ ] **Step 8.1: Create OrderCompletionGuide.tsx**

```typescript
"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { DashboardOrder, IOrderDocument } from "@/utils/interfaces/orders";

interface CompletionItem {
  label: string;
  done: boolean;
  tab?: string; // which tab to navigate to if incomplete
}

interface OrderCompletionGuideProps {
  open: boolean;
  onClose: () => void;
  onGoToTab: (tab: string) => void;
  order: DashboardOrder;
  documents: IOrderDocument[];
}

export function OrderCompletionGuide({
  open,
  onClose,
  onGoToTab,
  order,
  documents,
}: OrderCompletionGuideProps) {
  const items: CompletionItem[] = [
    {
      label: "Wound type selected",
      done: !!order.wound_type,
    },
    {
      label: "Date of service set",
      done: !!order.date_of_service,
    },
    {
      label: "Patient facesheet uploaded",
      done: documents.some((d) => d.documentType === "facesheet"),
      tab: "documents",
    },
    {
      label: "At least one product added",
      done: (order.all_items?.length ?? 0) > 0,
      tab: "overview",
    },
  ];

  const completed = items.filter((i) => i.done);
  const incomplete = items.filter((i) => !i.done);
  const allDone = incomplete.length === 0;

  function handleNextIncomplete() {
    const first = incomplete.find((i) => i.tab);
    if (first?.tab) {
      onGoToTab(first.tab);
    }
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm w-[calc(100%-2rem)] rounded-2xl p-0 border-[#E2E8F0] shadow-2xl">
        <div className="p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-sm text-slate-800">Order Completion Guide</h3>
            <p className="text-xs text-slate-500 mt-1">
              Complete the following to submit for signature:
            </p>
            <p className="text-xs font-semibold text-slate-700 mt-2">
              {completed.length} of {items.length} completed
            </p>
          </div>

          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div
                  className={
                    item.done
                      ? "w-4 h-4 rounded-full bg-green-500 flex items-center justify-center shrink-0"
                      : "w-4 h-4 rounded-full border-2 border-amber-400 shrink-0"
                  }
                >
                  {item.done && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span className={`text-sm ${item.done ? "text-slate-400 line-through" : "text-slate-700"}`}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          {allDone && (
            <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              All requirements met. You can submit this order for signature.
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="flex-1 border-[#E2E8F0]"
            >
              Close
            </Button>
            {!allDone && (
              <Button
                size="sm"
                onClick={handleNextIncomplete}
                className="flex-1 bg-[#15689E] hover:bg-[#125d8e] text-white"
              >
                Next Incomplete
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 8.2: Commit**

```bash
git add app/(dashboard)/dashboard/orders/(components)/OrderCompletionGuide.tsx
git commit -m "feat(orders): create OrderCompletionGuide modal"
```

---

## Task 9: Rewrite OrderDetailSheet with 6 tabs

**Files:**
- Modify: `app/(dashboard)/dashboard/orders/(components)/OrderDetailSheet.tsx`

Replace the entire file. The new sheet has 6 tabs: Overview, Order Form, IVR Form, Documents, Conversation, History.

- [ ] **Step 9.1: Replace OrderDetailSheet.tsx**

```typescript
"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MessageSquare,
  FileText,
  Clock,
  Package,
  Send,
  Upload,
  Trash2,
  ExternalLink,
  Loader2,
  User,
  Lock,
  AlertCircle,
  Plus,
  Minus,
} from "lucide-react";
import type {
  DashboardOrder,
  IOrderHistory,
  IOrderMessage,
  IOrderDocument,
  DocumentType,
} from "@/utils/interfaces/orders";
import {
  getOrderMessages,
  getOrderHistory,
  getOrderDocuments,
  sendOrderMessage,
  uploadOrderDocument,
  deleteOrderDocument,
  getDocumentSignedUrl,
  submitForSignature,
  getProducts,
  addOrderItems,
} from "../(services)/actions";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { OrderIVRForm } from "./OrderIVRForm";
import { OrderCompletionGuide } from "./OrderCompletionGuide";
import toast from "react-hot-toast";
import type { ProductRecord } from "@/utils/interfaces/orders";
import { cn } from "@/utils/utils";

const DOC_TYPE_CONFIG: Array<{ type: string; label: string; emoji: string }> = [
  { type: "facesheet", label: "Facesheet", emoji: "📋" },
  { type: "clinical_docs", label: "Clinical Docs", emoji: "📄" },
  { type: "order_form", label: "Order Form", emoji: "📝" },
  { type: "additional_ivr", label: "Additional IVR Info", emoji: "📎" },
  { type: "form_1500", label: "1500 Form", emoji: "🧾" },
  { type: "wound_pictures", label: "Wound Pictures", emoji: "🖼" },
  { type: "other", label: "Other", emoji: "📌" },
];

interface OrderDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: DashboardOrder;
  canCreate: boolean;
  isAdmin: boolean;
  canSign?: boolean;
  isSupport?: boolean;
}

export function OrderDetailSheet({
  open,
  onOpenChange,
  order,
  canCreate,
  isAdmin,
  canSign,
  isSupport,
}: OrderDetailSheetProps) {
  const [messages, setMessages] = useState<IOrderMessage[]>([]);
  const [history, setHistory] = useState<IOrderHistory[]>([]);
  const [documents, setDocuments] = useState<IOrderDocument[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [tab, setTab] = useState("overview");
  const [, startTransition] = useTransition();

  // Product picker state
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [addingProducts, setAddingProducts] = useState(false);

  // Completion guide state
  const [completionOpen, setCompletionOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canEditIvr = canCreate || canSign || isSupport;
  const canEditDocs = canCreate || isAdmin;

  useEffect(() => {
    if (!open) return;
    setTab("overview");

    async function loadAll() {
      setLoadingMessages(true);
      setLoadingHistory(true);
      setLoadingDocs(true);

      const [msgs, hist, docs] = await Promise.all([
        getOrderMessages(order.id),
        getOrderHistory(order.id),
        getOrderDocuments(order.id),
      ]);

      setMessages(msgs);
      setLoadingMessages(false);
      setHistory(hist);
      setLoadingHistory(false);
      setDocuments(docs);
      setLoadingDocs(false);
    }

    loadAll();
  }, [open, order.id]);

  // Load products when picker opens
  useEffect(() => {
    if (!showProductPicker) return;
    setLoadingProducts(true);
    getProducts().then((p) => {
      setProducts(p);
      setLoadingProducts(false);
    });
  }, [showProductPicker]);

  async function handleSendMessage() {
    if (!newMessage.trim()) return;
    setSendingMsg(true);
    const result = await sendOrderMessage(order.id, newMessage.trim());
    if (result.success) {
      const msgs = await getOrderMessages(order.id);
      setMessages(msgs);
      setNewMessage("");
    } else {
      toast.error(result.error ?? "Failed to send.");
    }
    setSendingMsg(false);
  }

  async function handleViewDoc(doc: IOrderDocument) {
    const { url, error } = await getDocumentSignedUrl(doc.filePath);
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      toast.error(error ?? "Could not generate link.");
    }
  }

  async function handleDeleteDoc(doc: IOrderDocument) {
    startTransition(async () => {
      const result = await deleteOrderDocument(doc.id, doc.filePath);
      if (result.success) {
        setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
        toast.success("Document deleted.");
      } else {
        toast.error(result.error ?? "Failed to delete document.");
      }
    });
  }

  async function handleUploadDoc(file: File, docType: DocumentType) {
    const fd = new FormData();
    fd.set("file", file);
    const result = await uploadOrderDocument(order.id, docType, fd);
    if (result.success && result.document) {
      setDocuments((prev) => [result.document!, ...prev]);
      toast.success("Document uploaded.");
    } else {
      toast.error(result.error ?? "Upload failed.");
    }
  }

  async function handleAddProducts() {
    const items = Object.entries(quantities)
      .filter(([, q]) => q > 0)
      .map(([productId, quantity]) => {
        const prod = products.find((p) => p.id === productId)!;
        return {
          product_id: prod.id,
          product_name: prod.name,
          product_sku: prod.sku,
          unit_price: Number(prod.unit_price),
          quantity,
        };
      });

    if (!items.length) return;
    setAddingProducts(true);
    const result = await addOrderItems(order.id, items);
    if (result.success) {
      toast.success("Products added.");
      setShowProductPicker(false);
      setQuantities({});
      // Reload to reflect new items (revalidation will update the store on next navigation)
      toast("Reload the page to see updated items.", { icon: "ℹ️" });
    } else {
      toast.error(result.error ?? "Failed to add products.");
    }
    setAddingProducts(false);
  }

  async function handleEditAndSubmit() {
    // Check completion
    const hasFacesheet = documents.some((d) => d.documentType === "facesheet");
    const hasProducts = (order.all_items?.length ?? 0) > 0;
    const hasDate = !!order.date_of_service;
    const hasWoundType = !!order.wound_type;

    if (!hasFacesheet || !hasProducts || !hasDate || !hasWoundType) {
      setCompletionOpen(true);
      return;
    }

    setSubmitting(true);
    const result = await submitForSignature(order.id);
    if (result.success) {
      toast.success("Order submitted for signature.");
      onOpenChange(false);
    } else {
      toast.error(result.error ?? "Failed to submit.");
    }
    setSubmitting(false);
  }

  const groupedDocs = documents.reduce<Record<string, IOrderDocument[]>>((acc, d) => {
    const key = d.documentType;
    if (!acc[key]) acc[key] = [];
    acc[key].push(d);
    return acc;
  }, {});

  const msgCount = messages.length;
  const docCount = documents.length;

  return (
    <>
      <OrderCompletionGuide
        open={completionOpen}
        onClose={() => setCompletionOpen(false)}
        onGoToTab={(t) => { setCompletionOpen(false); setTab(t); }}
        order={order}
        documents={documents}
      />

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full md:max-w-[600px] p-0 flex flex-col overflow-hidden">
          <SheetHeader className="px-6 py-4 border-b border-slate-200 shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg font-bold text-slate-800">
                {order.order_number}
              </SheetTitle>
              <OrderStatusBadge status={order.order_status} />
            </div>
          </SheetHeader>

          <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 min-h-0">
            <TabsList className="shrink-0 flex mx-4 mt-3 mb-0 bg-slate-100 rounded-lg overflow-x-auto p-1 gap-0.5">
              <TabsTrigger value="overview" className="text-xs flex-1 whitespace-nowrap">Overview</TabsTrigger>
              <TabsTrigger value="order-form" className="text-xs flex-1 whitespace-nowrap">Order Form</TabsTrigger>
              <TabsTrigger value="ivr" className="text-xs flex-1 whitespace-nowrap">IVR Form</TabsTrigger>
              <TabsTrigger value="documents" className="text-xs flex-1 whitespace-nowrap">
                Docs {docCount > 0 && <Badge className="ml-1 h-4 text-[10px] px-1.5">{docCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="conversation" className="text-xs flex-1 whitespace-nowrap">
                Chat {msgCount > 0 && <Badge className="ml-1 h-4 text-[10px] px-1.5">{msgCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs flex-1 whitespace-nowrap">History</TabsTrigger>
            </TabsList>

            {/* ── OVERVIEW ── */}
            <TabsContent value="overview" className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Order info */}
              <Section title="Order Info">
                <Row label="Order #" value={<span className="font-mono text-sm font-bold text-[#15689E]">{order.order_number}</span>} />
                <Row label="Wound Type" value={order.wound_type?.replace("_", " ") ?? "—"} capitalize />
                <Row label="Date of Service" value={order.date_of_service ?? "—"} />
                <Row label="Status" value={<OrderStatusBadge status={order.order_status} />} />
                <Row label="Facility" value={order.facility_name ?? "—"} />
                {order.created_by_name && <Row label="Created By" value={order.created_by_name} />}
                {order.signed_by_name && <Row label="Signed By" value={order.signed_by_name} />}
                {order.signed_at && <Row label="Signed At" value={new Date(order.signed_at).toLocaleDateString()} />}
                {order.payment_method && <Row label="Payment Method" value={order.payment_method.replace("_", " ")} capitalize />}
              </Section>

              {/* Products */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Products</h4>
                <div className="rounded-xl border border-slate-200 bg-white">
                  {order.all_items?.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {order.all_items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <Package className="w-3.5 h-3.5 text-slate-400" />
                            <div>
                              <p className="text-sm font-medium text-slate-800">{item.productName}</p>
                              <p className="text-xs text-slate-500">{item.productSku}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold">×{item.quantity}</p>
                            <p className="text-xs text-slate-500">${item.unitPrice.toFixed(2)} ea</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 text-center py-4">No products added yet.</p>
                  )}

                  {/* Add product button */}
                  {canCreate && order.order_status === "draft" && (
                    <div className="border-t border-slate-100 px-3 py-2">
                      {!showProductPicker ? (
                        <button
                          type="button"
                          onClick={() => setShowProductPicker(true)}
                          className="text-xs text-[#15689E] hover:underline flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          Add Product
                        </button>
                      ) : (
                        <div className="space-y-3 py-1">
                          {loadingProducts ? (
                            <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Loading products...
                            </div>
                          ) : products.length === 0 ? (
                            <p className="text-xs text-slate-400">No products available.</p>
                          ) : (
                            products.map((prod) => {
                              const qty = quantities[prod.id] ?? 0;
                              return (
                                <div key={prod.id} className={cn(
                                  "flex items-center gap-2 p-2 rounded-lg border transition-all",
                                  qty > 0 ? "border-[#15689E] bg-blue-50" : "border-slate-200"
                                )}>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-slate-800 truncate">{prod.name}</p>
                                    <p className="text-[11px] text-slate-500">${Number(prod.unit_price).toFixed(2)}</p>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      disabled={qty === 0}
                                      onClick={() => setQuantities((p) => {
                                        const next = { ...p };
                                        if (qty <= 1) delete next[prod.id]; else next[prod.id] = qty - 1;
                                        return next;
                                      })}
                                      className="w-6 h-6 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                                    >
                                      <Minus className="w-2.5 h-2.5" />
                                    </button>
                                    <span className="w-6 text-center text-xs font-bold">{qty}</span>
                                    <button
                                      type="button"
                                      onClick={() => setQuantities((p) => ({ ...p, [prod.id]: qty + 1 }))}
                                      className="w-6 h-6 rounded-full bg-[#15689E] flex items-center justify-center text-white hover:bg-[#125d8e]"
                                    >
                                      <Plus className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 text-xs border-[#E2E8F0]"
                              onClick={() => { setShowProductPicker(false); setQuantities({}); }}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1 text-xs bg-[#15689E] hover:bg-[#125d8e] text-white"
                              disabled={!Object.values(quantities).some((q) => q > 0) || addingProducts}
                              onClick={handleAddProducts}
                            >
                              {addingProducts ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add to Order"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              {order.order_status === "draft" && canCreate && (
                <Button
                  className="w-full bg-[#15689E] hover:bg-[#125d8e] text-white"
                  disabled={submitting}
                  onClick={handleEditAndSubmit}
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Edit and Submit Order →
                </Button>
              )}

              {order.notes && (
                <Section title="Notes">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap px-3 py-2.5">{order.notes}</p>
                </Section>
              )}
            </TabsContent>

            {/* ── ORDER FORM (read-only AI data) ── */}
            <TabsContent value="order-form" className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {!order.ai_extracted ? (
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm">
                  <div className="flex items-center gap-2 text-amber-700">
                    <AlertCircle className="w-4 h-4" />
                    <span className="font-medium">AI extraction pending</span>
                  </div>
                  <p className="text-amber-600 mt-1 text-xs">
                    Upload the patient facesheet and doctor's note. The AI will automatically
                    extract patient and clinical information from your documents.
                  </p>
                  <p className="text-amber-600 mt-2 text-xs italic">
                    Documents uploaded. You can proceed to fill the IVR and HCFA forms.
                  </p>
                </div>
              ) : (
                <>
                  <Section title="Patient Information (AI-extracted)">
                    <AiRow label="Patient Name" value={order.patient_full_name ?? "—"} />
                    <AiRow label="Date of Birth" value={order.patient_id ?? "—"} />
                    <AiRow label="Date of Service" value={order.date_of_service ?? "—"} />
                    <AiRow label="Wound Visit #" value={order.wound_visit_number != null ? String(order.wound_visit_number) : "—"} />
                    <AiRow label="Chief Complaint" value={order.chief_complaint ?? "—"} />
                    <AiRow label="Active Vasculitis/Burns?" value={order.has_vasculitis_or_burns ? "Yes" : "No"} />
                    <AiRow label="Receiving Home Health?" value={order.is_receiving_home_health ? "Yes" : "No"} />
                    <AiRow label="Patient at SNF?" value={order.is_patient_at_snf ? "Yes" : "No"} />
                    <AiRow label="ICD-10 Code" value={order.icd10_code ?? "—"} />
                    <AiRow label="Follow-up Days" value={order.followup_days != null ? String(order.followup_days) : "—"} />
                  </Section>
                  <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    These fields are populated by AI extraction and cannot be modified. If corrections
                    are needed, please update on your clinic system.
                  </p>
                </>
              )}
            </TabsContent>

            {/* ── IVR FORM ── */}
            <TabsContent value="ivr" className="flex-1 overflow-y-auto px-6 py-4">
              <OrderIVRForm orderId={order.id} canEdit={!!canEditIvr} />
            </TabsContent>

            {/* ── DOCUMENTS ── */}
            <TabsContent value="documents" className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {loadingDocs ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              ) : (
                DOC_TYPE_CONFIG.map(({ type, label, emoji }) => {
                  const typeDocs = groupedDocs[type] ?? [];
                  return (
                    <div key={type} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-700">
                          {emoji} {label}
                        </p>
                        {canEditDocs && (
                          <label className="cursor-pointer text-xs text-[#15689E] hover:underline flex items-center gap-1">
                            <Upload className="w-3 h-3" />
                            Upload
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*,.pdf,.doc,.docx"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleUploadDoc(file, type as DocumentType);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        )}
                      </div>
                      {typeDocs.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">
                          {type === "wound_pictures"
                            ? "No wound photos uploaded"
                            : "No additional documentation uploaded"}
                        </p>
                      ) : (
                        typeDocs.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                          >
                            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="text-sm text-slate-700 flex-1 truncate">{doc.fileName}</span>
                            <span className="text-xs text-slate-400">
                              {new Date(doc.createdAt).toLocaleDateString()}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleViewDoc(doc)}
                              className="text-[#15689E] hover:text-[#125d8e] transition-colors"
                              title="View"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            {canEditDocs && (
                              <button
                                type="button"
                                onClick={() => handleDeleteDoc(doc)}
                                className="text-slate-400 hover:text-red-500 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  );
                })
              )}
            </TabsContent>

            {/* ── CONVERSATION ── */}
            <TabsContent value="conversation" className="flex flex-col flex-1 min-h-0 px-6 py-4 gap-3">
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {loadingMessages ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">
                    No messages yet. Start the conversation.
                  </p>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs font-semibold text-slate-700">
                          {m.senderName ?? "Unknown"}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(m.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{m.message}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="shrink-0 flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={sendingMsg}
                  className="flex-1"
                />
                <Button
                  size="icon"
                  disabled={sendingMsg || !newMessage.trim()}
                  onClick={handleSendMessage}
                  className="bg-[#15689E] hover:bg-[#125d8e] text-white shrink-0"
                >
                  {sendingMsg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </TabsContent>

            {/* ── HISTORY ── */}
            <TabsContent value="history" className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {loadingHistory ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No history yet.</p>
              ) : (
                <div className="relative pl-5">
                  <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-slate-200" />
                  {history.map((h) => (
                    <div key={h.id} className="relative mb-5">
                      <div className="absolute -left-[17px] w-3 h-3 rounded-full bg-[#15689E] border-2 border-white top-1" />
                      <p className="text-sm font-semibold text-slate-800">{h.action}</p>
                      {h.oldStatus && h.newStatus && (
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                          <span className="capitalize">{h.oldStatus.replace(/_/g, " ")}</span>
                          <span>→</span>
                          <span className="capitalize">{h.newStatus.replace(/_/g, " ")}</span>
                        </p>
                      )}
                      {h.performedByName && (
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <User className="w-3 h-3" />
                          {h.performedByName}
                        </p>
                      )}
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(h.createdAt).toLocaleString()}
                      </p>
                      {h.notes && (
                        <p className="text-xs text-slate-600 mt-1 bg-slate-50 rounded-lg px-2 py-1">
                          {h.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </>
  );
}

/* ── Helpers ── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">{title}</h4>
      <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
        {children}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: React.ReactNode;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <span className="text-xs text-slate-500">{label}</span>
      {typeof value === "string" ? (
        <span className={`text-sm font-semibold text-slate-800 ${capitalize ? "capitalize" : ""}`}>
          {value}
        </span>
      ) : (
        value
      )}
    </div>
  );
}

function AiRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <span className="text-xs text-slate-500">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-semibold text-slate-800">{value}</span>
        <Lock className="w-3 h-3 text-slate-300" />
      </div>
    </div>
  );
}
```

Note: This file imports `getProducts` from actions.ts. Verify that export exists (it does from the original `createOrder` flow).

- [ ] **Step 9.2: Commit**

```bash
git add app/(dashboard)/dashboard/orders/(components)/OrderDetailSheet.tsx
git commit -m "feat(orders): rewrite OrderDetailSheet with 6 tabs — Overview, Order Form, IVR, Docs, Chat, History"
```

---

## Task 10: Update OrderCard action buttons

**Files:**
- Modify: `app/(dashboard)/dashboard/orders/(components)/OrderCard.tsx`

The Draft button should say "Edit and Submit Order →" and just open the detail sheet (completion check happens inside the sheet). Remove the direct `submitForSignature` call from the card.

- [ ] **Step 10.1: Update OrderCard.tsx**

Find the `Draft actions` section (around line 181). Replace:

```typescript
          {/* Draft actions */}
          {status === "draft" && canCreate && (
            <>
              <Button
                size="sm"
                className="h-8 text-xs bg-[#15689E] hover:bg-[#125d8e] text-white"
                disabled={isActing}
                onClick={() => handleAction(() => submitForSignature(order.id), "Submitted for signature.")}
              >
                {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
                Submit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-red-500 hover:bg-red-50"
                disabled={isDeleting}
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Delete
              </Button>
            </>
          )}
```

With:

```typescript
          {/* Draft actions */}
          {status === "draft" && canCreate && (
            <>
              <Button
                size="sm"
                className="h-8 text-xs bg-[#15689E] hover:bg-[#125d8e] text-white"
                onClick={onClick}
              >
                <Send className="w-3 h-3 mr-1" />
                Edit and Submit Order →
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-red-500 hover:bg-red-50"
                disabled={isDeleting}
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Delete
              </Button>
            </>
          )}
```

Also remove unused imports: `submitForSignature` can be removed from the destructured imports if it's only used here. Keep `recallOrder`, `resubmitForReview`, `deleteOrder`. Remove `isActing` state and `handleAction` if no longer needed for other statuses — actually keep them since they're used by other status actions.

Actually check: `handleAction` is still used by `recallOrder`, `requestAdditionalInfo`, `resubmitForReview`. Keep it.

Remove `submitForSignature` from the import destructure at top of file:

```typescript
import {
  recallOrder,
  resubmitForReview,
  deleteOrder,
} from "../(services)/actions";
```

- [ ] **Step 10.2: Commit**

```bash
git add app/(dashboard)/dashboard/orders/(components)/OrderCard.tsx
git commit -m "feat(orders): update OrderCard draft button to 'Edit and Submit Order' — opens sheet"
```

---

## Task 11: Update OrdersPageClient — pass new props to OrderDetailSheet

**Files:**
- Modify: `app/(dashboard)/dashboard/orders/(sections)/OrdersPageClient.tsx`

- [ ] **Step 11.1: Update both OrderDetailSheet usages in OrdersPageClient**

Find the two `<OrderDetailSheet` JSX blocks (one in table view, one in kanban view). Add `canSign` and `isSupport` props to both:

Table view usage (around line 176):
```typescript
        {selectedOrder && (
          <OrderDetailSheet
            open={detailOpen}
            onOpenChange={setDetailOpen}
            order={selectedOrder}
            canCreate={canCreate}
            isAdmin={isAdmin}
            canSign={canSign}
            isSupport={isSupport}
          />
        )}
```

Kanban view usage (around line 317):
```typescript
      {selectedOrder && (
        <OrderDetailSheet
          open={detailOpen}
          onOpenChange={setDetailOpen}
          order={selectedOrder}
          canCreate={canCreate}
          isAdmin={isAdmin}
          canSign={canSign}
          isSupport={isSupport}
        />
      )}
```

- [ ] **Step 11.2: Commit**

```bash
git add app/(dashboard)/dashboard/orders/(sections)/OrdersPageClient.tsx
git commit -m "feat(orders): pass canSign + isSupport to OrderDetailSheet"
```

---

## Task 12: Final verification query

- [ ] **Step 12.1: Run verification SQL via Supabase MCP**

```sql
SELECT
  o.order_number, o.order_status, o.wound_type,
  o.date_of_service, o.ai_extracted,
  o.order_form_locked,
  COUNT(DISTINCT od.id) AS docs,
  COUNT(DISTINCT oi.id) AS items,
  ivr.insurance_provider
FROM public.orders o
LEFT JOIN public.order_documents od ON od.order_id = o.id
LEFT JOIN public.order_items oi ON oi.order_id = o.id
LEFT JOIN public.order_ivr ivr ON ivr.order_id = o.id
GROUP BY o.id, o.order_number, o.order_status,
         o.wound_type, o.date_of_service,
         o.ai_extracted, o.order_form_locked,
         ivr.insurance_provider
ORDER BY o.placed_at DESC
LIMIT 10;
```

Expected: No errors; columns `ai_extracted` and `order_form_locked` return values.

- [ ] **Step 12.2: Final summary commit**

```bash
git add .
git commit -m "feat(orders): phase 3 complete — single-screen create, 6-tab sheet, IVR form, completion guide"
```

---

## Self-Review

**Spec coverage check:**

| Spec Requirement | Task |
|---|---|
| CreateOrderModal single-screen, no wizard | Task 6 |
| No patient selection in create modal | Task 6 |
| No products in create modal | Task 6 |
| Wound type radio + date + notes in modal | Task 6 |
| Facesheet required, wound pics required for chronic | Task 6 |
| createOrder plain args (no FormData, no patient/items) | Task 3 |
| ai_extracted=false, order_form_locked=false on create | Task 3 |
| documentTypeSchema includes order_form | Task 1 |
| IOrder updated with AI fields | Task 1 |
| DashboardOrder updated with AI fields | Task 1 |
| IOrderIVR interface added | Task 1 |
| RawOrderRecord updated | Task 1 |
| mapOrder maps AI fields | Task 1 |
| ORDER_WITH_RELATIONS_SELECT includes AI columns | Task 2 |
| getOrderIVR action | Task 4 |
| upsertOrderIVR action (clinical + support_staff) | Task 4 |
| addOrderItems action | Task 5 |
| OrderDetailSheet 6 tabs | Task 9 |
| Overview tab: order info + products + add product | Task 9 |
| Order Form tab: read-only, lock icons, ai_extracted pending notice | Task 9 |
| IVR Form tab: editable, auto-save debounce | Tasks 7+9 |
| Documents tab: grouped by type, LUCAS labels | Task 9 |
| Conversation tab (rename from Messages/Chat) | Task 9 |
| History tab | Task 9 |
| Products added via Overview tab product picker | Task 9 |
| OrderCompletionGuide checks products+facesheet+date+wound_type | Task 8 |
| "Edit and Submit Order" label on draft card | Task 10 |
| Card button opens sheet (no direct submit) | Task 10 |
| Submit for Signature inside Overview tab runs completion check | Task 9 |
| canSign + isSupport passed to OrderDetailSheet | Task 11 |
| IVR form canEdit: canCreate \|\| canSign \|\| isSupport | Tasks 7+9 |
| Auto-save "Change is saved" feedback | Task 7 |
| Lock icons on AI-extracted fields | Task 9 |

All requirements covered. No gaps found.
