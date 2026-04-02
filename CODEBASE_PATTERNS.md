# HB Medical Portal — Codebase Patterns Reference

> Use this document as the single source of truth before building any new feature.
> Every pattern here is derived from working code in this repo.

---

## SECTION A — File & Folder Structure Pattern

Every dashboard feature lives under `app/(dashboard)/dashboard/<feature>/` and follows this exact layout:

```
app/(dashboard)/dashboard/<feature>/
├── page.tsx                    ← async server component, fetches data, renders Providers
├── (sections)/
│   ├── Providers.tsx           ← "use client", dispatches initial data into Redux
│   ├── <Feature>PageClient.tsx ← "use client", main interactive UI, reads from Redux
│   ├── Header.tsx              ← page header (optional, or use DashboardHeader)
│   └── ...                     ← other presentational client components
├── (components)/               ← domain-specific components (cards, modals, forms)
│   ├── <Feature>Card.tsx
│   ├── Create<Feature>Modal.tsx
│   └── ...
├── (redux)/
│   ├── <feature>-slice.ts      ← createSlice with set/add/update/remove reducers
│   └── <feature>-state.ts      ← interface + initialState export
└── (services)/
    └── actions.ts              ← "use server" server actions, all DB I/O here
```

**Shared/cross-feature state** (accounts, tasks, contacts, activities, dashboard profile) lives in:
```
app/(dashboard)/dashboard/(redux)/   ← shared slices only (not feature-specific)
app/(dashboard)/dashboard/(services)/  ← shared server actions
```

**Reusable UI components** live in:
```
app/(components)/   ← shared dashboard components (EmptyState, DashboardHeader, etc.)
components/ui/      ← shadcn/ui primitives (Button, Input, Dialog, Select, etc.)
```

---

## SECTION B — Page Pattern

Every feature page follows this exact server component pattern:

```typescript
// app/(dashboard)/dashboard/<feature>/page.tsx
import { Metadata } from "next";
import { DashboardHeader } from "@/app/(components)/DashboardHeader";
import Providers from "./(sections)/Providers";
import { FeaturePageClient } from "./(sections)/FeaturePageClient";
import { getFeatureData } from "./(services)/actions";

export const metadata: Metadata = { title: "Feature Name" };

export const dynamic = "force-dynamic"; // add when data must never be cached

export default async function FeaturePage() {
  const data = await getFeatureData();

  return (
    <Providers data={data}>
      <div className="p-4 md:p-8 mx-auto space-y-6">
        <DashboardHeader
          title="Feature Name"
          description="Short description shown under the title"
        />
        <FeaturePageClient />
      </div>
    </Providers>
  );
}
```

**Rules:**
- Page is always `async` and always a server component (no `"use client"`)
- Data is fetched at the top before rendering
- `Providers` wraps everything to hydrate Redux on the client
- `DashboardHeader` receives `title` and `description` props
- Padding is always `p-4 md:p-8 mx-auto space-y-6`
- For parallel fetches: `const [a, b] = await Promise.all([getA(), getB()])`
- Admin-only pages redirect non-admins:
  ```typescript
  const supabase = await createClient();
  const role = await getUserRole(supabase);
  if (role !== "admin") redirect("/dashboard");
  ```

---

## SECTION C — Server Actions Pattern

All DB operations live in `(services)/actions.ts` and follow this pattern:

```typescript
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrThrow, getCurrentUserOrThrow, getUserRole } from "@/lib/supabase/auth";

/* ── Validation schema ── */
const createFeatureSchema = z.object({
  name: z.string().min(1, "Name is required."),
  role: z.enum(["sales_representative", "support_staff"]),
});

/* ── Read action ── */
export async function getFeatureData(): Promise<IFeature[]> {
  const supabase = await createClient();
  await requireAdminOrThrow(supabase); // or getCurrentUserOrThrow

  const { data, error } = await supabase
    .from("table_name")
    .select("*, related:other_table!fk_name(id, name)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getFeatureData] Error:", JSON.stringify(error));
    throw new Error(error.message ?? error.code ?? "Failed to fetch.");
  }

  return (data ?? []).map(mapFeature);
}

/* ── Write action returning form state ── */
export async function createFeature(
  _prev: IFeatureFormState | null,
  formData: FormData,
): Promise<IFeatureFormState> {
  try {
    const supabase = await createClient();
    await requireAdminOrThrow(supabase);

    const raw = {
      name: formData.get("name") as string,
    };

    const parsed = createFeatureSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: IFeatureFormState["fieldErrors"] = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof NonNullable<IFeatureFormState["fieldErrors"]>;
        fieldErrors[field] = issue.message;
      }
      return { error: null, success: false, fieldErrors };
    }

    const { error } = await supabase.from("table_name").insert(parsed.data);
    if (error) {
      return { error: error.message ?? "Failed to create.", success: false };
    }

    revalidatePath("/dashboard/feature");
    return { success: true, error: null };
  } catch (err) {
    console.error("[createFeature] Unexpected error:", err);
    return { error: "An unexpected error occurred.", success: false };
  }
}
```

**Rules:**
- Always `"use server"` at top
- Always call `requireAdminOrThrow` (or `getCurrentUserOrThrow` for non-admin actions)
- Errors logged with `JSON.stringify(error)` for Supabase errors (they may be objects)
- Mutations always call `revalidatePath("/dashboard/<feature>")`
- Return `IFeatureFormState` from form-bound actions, throw from data fetchers
- Use `createAdminClient()` (bypasses RLS) when operating on data for other users
- Use `createClient()` (respects RLS) for user's own data
- Supabase FK joins use explicit hint: `table!fk_constraint_name(cols)`

---

## SECTION D — Redux Slice Pattern

**State file** (`(redux)/<feature>-state.ts`):
```typescript
import type { IFeature } from "@/utils/interfaces/<feature>";

export interface FeatureState {
  items: IFeature[];
}

export const initialState: FeatureState = {
  items: [],
};
```

**Slice file** (`(redux)/<feature>-slice.ts`):
```typescript
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { IFeature } from "@/utils/interfaces/<feature>";
import { initialState } from "./<feature>-state";

const featureSlice = createSlice({
  name: "feature",
  initialState,
  reducers: {
    setFeatures(state, action: PayloadAction<IFeature[]>) {
      state.items = action.payload;
    },
    addFeatureToStore(state, action: PayloadAction<IFeature>) {
      state.items.unshift(action.payload);
    },
    updateFeatureInStore(state, action: PayloadAction<IFeature>) {
      const index = state.items.findIndex((i) => i.id === action.payload.id);
      if (index !== -1) state.items[index] = action.payload;
    },
    removeFeatureFromStore(state, action: PayloadAction<string>) {
      state.items = state.items.filter((i) => i.id !== action.payload);
    },
  },
});

export const {
  setFeatures,
  addFeatureToStore,
  updateFeatureInStore,
  removeFeatureFromStore,
} = featureSlice.actions;

export default featureSlice.reducer;
```

**Providers.tsx** (`(sections)/Providers.tsx`):
```typescript
"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import type { IFeature } from "@/utils/interfaces/<feature>";
import { useAppDispatch } from "@/store/hooks";
import { setFeatures } from "../(redux)/<feature>-slice";

export default function Providers({
  children,
  data,
}: {
  children: ReactNode;
  data: IFeature[];
}) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setFeatures(data));
  }, [dispatch, data]);

  return <>{children}</>;
}
```

**Registering the slice** — add to `store/store.ts`:
```typescript
import featureReducer from "@/app/(dashboard)/dashboard/<feature>/(redux)/<feature>-slice";
// Add to configureStore reducer:
feature: featureReducer,
```

**Using in a client component:**
```typescript
const items = useAppSelector((s) => s.feature.items);
const dispatch = useAppDispatch();
// Optimistic update pattern:
dispatch(updateFeatureInStore(updated));
```

---

## SECTION E — Section/Component Pattern

**Client page component** (`(sections)/<Feature>PageClient.tsx`):
```typescript
"use client";

import { useState, useTransition } from "react";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { motion } from "framer-motion";
import { staggerContainer, fadeUp } from "@/components/ui/animations";
import toast from "react-hot-toast";

export function FeaturePageClient() {
  const items = useAppSelector((s) => s.feature.items);
  const dispatch = useAppDispatch();
  const [, startTransition] = useTransition();

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteFeatureItem(id);
        dispatch(removeFeatureFromStore(id));
        toast.success("Item deleted.");
      } catch {
        toast.error("Failed to delete item.");
      }
    });
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<SomeIcon className="w-10 h-10 stroke-1" />}
        message="No items found"
      />
    );
  }

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible">
      {items.map((item) => (
        <motion.div key={item.id} variants={fadeUp}>
          {/* render item */}
        </motion.div>
      ))}
    </motion.div>
  );
}
```

**Create/Edit Modal pattern** (`(components)/Create<Feature>Modal.tsx`):
```typescript
"use client";

import { useActionState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createFeature } from "../(services)/actions";
import type { IFeatureFormState } from "@/utils/interfaces/<feature>";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreateFeatureModal({ open, onClose }: Props) {
  const [state, formAction, isPending] = useActionState<
    IFeatureFormState | null,
    FormData
  >(createFeature, null);

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      toast.success("Created successfully.");
      onClose();
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]); // ← deps array must be [state] ONLY to prevent double-fire

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Item</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs">
              Name <span className="text-red-400">*</span>
            </Label>
            <Input id="name" name="name" className="h-9 text-sm" required />
            {state?.fieldErrors?.name && (
              <p className="text-xs text-red-500">{state.fieldErrors.name}</p>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1 h-9"
              onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}
              className="flex-1 h-9 bg-[#15689E] hover:bg-[#15689E]/90 text-white">
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

---

## SECTION F — Available Reusable Components

All in `app/(components)/`. Import as `@/app/(components)/ComponentName`.

| Component | Props | Use for |
|---|---|---|
| `DashboardHeader` | `title`, `description` | Page heading block |
| `EmptyState` | `icon`, `message`, `description?`, `className?` | No-data placeholder |
| `ConfirmModal` | `open`, `onOpenChange`, `onConfirm`, `title?`, `description?` | Delete confirmations |
| `StatusBadge` | `status`, `variant?` | Generic status chip |
| `PaymentBadge` | `status` | Payment status chip |
| `FulfillmentBadge` | `status` | Fulfillment status chip |
| `MaterialCard` | material data | Document/file card display |
| `AdminMaterialCard` | material + admin actions | Admin document card |
| `AdminBulkBar` | selection state + actions | Bulk action toolbar |
| `AdminUploadButton` | upload handler | File upload trigger |
| `SearchFilterBox` | `value`, `onChange`, `placeholder?` | Search input with icon |
| `TableToolbar` | toolbar actions | Above-table action row |
| `DataTable` | `columns`, `data` | Tabular data display |
| `SubmitButton` | `isPending`, `label` | Form submit button |
| `ErrorAlert` | `message` | Inline error display |
| `HBLogo` | — | HB Medical logo mark |
| `BackgroundDots` | — | Auth page dot background |
| `StatCard` | `title`, `value`, `icon?` | Dashboard stat display |
| `AnimateStat` | `value` | Animated number counter |

**shadcn/ui primitives** in `components/ui/`:
`Button`, `Input`, `Label`, `Select` (+ `SelectTrigger/Content/Item/Value`), `Dialog` (+ `DialogContent/Header/Title`), `Tabs` (+ `TabsList/TabsTrigger/TabsContent`), `Badge`, `Separator`, `Textarea`, `Checkbox`, `RadioGroup`, `Switch`, `Tooltip`, `Sheet`, `Popover`, `Calendar`, `Card`

**Animation tokens** from `@/components/ui/animations`:
- `staggerContainer` — wrap a list of animated children
- `fadeUp` — each list item entrance animation
- Use: `<motion.div variants={staggerContainer} initial="hidden" animate="visible">`

---

## SECTION G — Available Utils

### `utils/helpers/`
- `role.ts` — `isAdmin(role)`, `isSalesRep(role)`, `isSupport(role)`, `isClinicalProvider(role)`, `isClinicalStaff(role)`, `isDistributionSide(role)`, `isClinicSide(role)`, `canSignOrders(role)`, `canCreateOrders(role)`, `ROLE_LABELS` record
- `formatter.ts` — currency, date, phone formatters
- `orders.ts` — `mapDashboardOrder`, `mapDashboardOrders`, order state helpers (`canEditOrder`, `canDeleteOrder`, etc.)
- `group-orders-by-status.ts` — `groupOrdersByBoardStatus(orders)`
- `storage.ts` — Supabase storage URL helpers
- `signup.ts` — invite/signup flow helpers

### `utils/interfaces/`
Each file exports: Zod schemas + inferred TypeScript types + mapping functions

Key interfaces: `IUser`, `IAccount`, `IContact`, `IOrder` / `DashboardOrder`, `IProduct`, `IContract`, `ITask`, `IActivity`, `IInviteToken`, `IFacility`, `IFacilityMember`, `IProfile`, `ITraining`, `IMarketing`, `IHospitalOnboarding`

Form state interface pattern (used with `useActionState`):
```typescript
export interface IFeatureFormState {
  success: boolean;
  error: string | null;
  fieldErrors?: {
    field_name?: string;
    // ...
  };
  // optional return data:
  token?: string;
  id?: string;
}
```

### `utils/constants/`
- `orders.ts` — table names, paths, default values, composable SELECT strings
- `accounts.ts` — accounts table/path constants
- `activities.ts` — activity constants
- `auth.ts` — `PROFILE_ROLES = ["sales_representative"]`
- `storage.ts` — Supabase storage bucket names

### `lib/supabase/`
- `server.ts` → `createClient()` — respects RLS, uses session cookie
- `admin.ts` → `createAdminClient()` — bypasses RLS, uses service role key
- `auth.ts` → `getCurrentUserOrThrow(supabase)`, `getUserRole(supabase)`, `requireAdminOrThrow(supabase)`, `requireSupportOrAdminOrThrow(supabase)`

### `lib/emails/resend.ts`
- `resend` — Resend client instance
- `PAYMENTS_FROM_EMAIL` — from address for payment/order emails
- `ACCOUNTS_FROM_EMAIL` — `"HB Medical <accounts@hbmedicalportal.com>"` for user account emails

### `store/hooks.ts`
- `useAppDispatch()` — typed dispatch
- `useAppSelector<T>(selector)` — typed selector

---

## SECTION H — What NOT to Recreate

These already exist — import them, do not rewrite:

| What | Where | Notes |
|---|---|---|
| Supabase clients | `lib/supabase/server.ts`, `lib/supabase/admin.ts` | Never create raw Supabase clients inline |
| Auth helpers | `lib/supabase/auth.ts` | Always use `requireAdminOrThrow` etc. |
| Resend client | `lib/emails/resend.ts` | Import `resend`, never instantiate `new Resend()` in a feature |
| Role helpers | `utils/helpers/role.ts` | Never hardcode role strings in components |
| `ROLE_LABELS` | `utils/helpers/role.ts` | Use for display; don't build your own map |
| `staggerContainer`/`fadeUp` | `components/ui/animations` | Use these; don't define new Framer variants inline |
| `EmptyState` | `app/(components)/EmptyState.tsx` | Already handles icon + message + optional description |
| `DashboardHeader` | `app/(components)/DashboardHeader.tsx` | Already handles title + description layout |
| `ConfirmModal` | `app/(components)/ConfirmModal.tsx` | Already built; don't build inline confirm dialogs |
| Toast | `react-hot-toast` | Single `<Toaster>` already in root layout; just call `toast.success/error()` |
| `useAppDispatch/Selector` | `store/hooks.ts` | Import these; never import raw `useDispatch/useSelector` |
| `StoreProvider` | `store/StoreProvider.tsx` | Already in root layout; don't add another Redux provider |
| shadcn/ui components | `components/ui/` | Check here before installing any UI library |

---

## SECTION I — Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| Page files | `page.tsx` (lowercase) | `orders/page.tsx` |
| Server action files | `actions.ts` | `(services)/actions.ts` |
| Redux slice files | `<feature>-slice.ts` | `orders-slice.ts` |
| Redux state files | `<feature>-state.ts` | `orders-state.ts` |
| Providers component | `Providers.tsx` (capital P) | `(sections)/Providers.tsx` |
| Client page component | `<Feature>PageClient.tsx` | `OrdersPageClient.tsx` |
| Modal components | `Create<Feature>Modal.tsx`, `Edit<Feature>Modal.tsx` | `CreateOrderModal.tsx` |
| Interface files | `<feature>.ts` (singular) | `utils/interfaces/orders.ts` |
| Interface types | `I<Name>` prefix | `IUser`, `IOrder`, `IFacility` |
| Form state types | `I<Name>FormState` | `IUserFormState`, `IOrderFormState` |
| Zod schemas | `<name>Schema` camelCase | `createOrderSchema`, `dashboardOrderSchema` |
| Redux actions (set) | `set<Features>` | `setOrders`, `setAccounts` |
| Redux actions (add) | `add<Feature>ToStore` | `addOrderToStore` |
| Redux actions (update) | `update<Feature>InStore` | `updateOrderInStore` |
| Redux actions (remove) | `remove<Feature>FromStore` | `removeOrderFromStore` |
| Server action (read) | `get<Features>` | `getUsers`, `getAllOrders` |
| Server action (create) | `create<Feature>` | `createUser`, `createOrder` |
| Server action (update) | `update<Feature>` | `updateOrder` |
| Server action (delete) | `delete<Feature>` | `deleteOrder`, `deleteInviteToken` |
| Constants files | `<feature>.ts` (singular) | `utils/constants/orders.ts` |
| DB table constants | `SCREAMING_SNAKE_CASE` | `ORDER_TABLE`, `FACILITY_TABLE` |
| Path constants | `<FEATURE>_PATH` | `ORDERS_PATH = "/dashboard/orders"` |
| CSS brand color | `#15689E` (blue), `#e8821a` (orange) | `bg-[#15689E]`, `text-[#e8821a]` |
| Button height | `h-9` for standard, `h-8` for compact | consistent across all forms |
| Primary button | `bg-[#15689E] hover:bg-[#15689E]/90 text-white` | all submit/primary CTAs |

---

## SECTION J — Role System Reference

Roles are defined in `utils/helpers/role.ts`. The 5 valid roles:

| Role value | Label | Scope |
|---|---|---|
| `admin` | Admin | Full access: all nav, all features, user management |
| `sales_representative` | Sales Rep | Distribution side: dashboard, products, marketing, contracts, trainings, hospital-onboarding, accounts, tasks, onboarding, settings |
| `support_staff` | Support Staff | Distribution side: dashboard, accounts, orders, settings |
| `clinical_provider` | Clinical Provider | Clinic side: dashboard, orders, settings (+ provider credentials in settings) |
| `clinical_staff` | Clinical Staff | Clinic side: dashboard, orders, settings |

Role badge colors (from `SidebarUserCard.tsx`):
- admin → `#15689E` (brand blue)
- sales_representative → `#e8821a` (orange)
- support_staff → `#7c3aed` (purple)
- clinical_provider → `#0d9488` (teal)
- clinical_staff → `#475569` (slate)

**Never hardcode role strings in JSX.** Use `ROLE_LABELS[role]` for display.
**Never gate UI with `role === "doctor"` or old role values.** They do not exist.
