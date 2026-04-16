# Resources Page Beautification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do NOT run `git commit` or `git add` — user has explicit rules against unauthorized commits.**

**Goal:** Global CSS restyle of `MaterialCard` / `AdminMaterialCard` (lighter header, fixed height, line-clamp titles, category color accent) and the Resources sub-tabs (underline-style tabs), plus prop-threading `category` from all 5 consumer pages.

**Architecture:** Styling-only. Optional `category` prop added to `MaterialCard`, `AdminMaterialCard`, and `MaterialsSection` — unset = neutral slate default, set = tinted per category using existing CSS vars (`--blue`, `--purple`, `--gold`, `--teal`). No business logic, no data flow, no new files.

**Tech Stack:** React 19, Tailwind 4, existing CSS variables in `globals.css`, Lucide icons.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `app/(components)/MaterialCard.tsx` | Modify | Light-tinted category header, fixed height, line-clamp, category prop |
| `app/(components)/AdminMaterialCard.tsx` | Modify | Parallel restyle + category prop |
| `app/(components)/MaterialSection.tsx` | Modify | Optional category dot on heading |
| `app/(dashboard)/dashboard/resources/(components)/ResourceSubTabs.tsx` | Modify | Underline-style active tab |
| `app/(dashboard)/dashboard/resources/(sections)/ResourcesContent.tsx` | Modify | Thread `category` prop to cards + MaterialsSection |
| `app/(dashboard)/dashboard/marketing/(sections)/MarketingCards.tsx` | Modify | Pass `category="marketing"` |
| `app/(dashboard)/dashboard/contracts/(sections)/ContractCards.tsx` | Modify | Pass `category="contracts"` |
| `app/(dashboard)/dashboard/trainings/(sections)/TrainingCards.tsx` | Modify | Pass `category="training"` |
| `app/(dashboard)/dashboard/hospital-onboarding/(sections)/HospitalOnboardingCards.tsx` | Modify | Pass `category="onboarding"` |

---

## Task 1: Restyle `MaterialCard.tsx`

**Files:**
- Modify: `app/(components)/MaterialCard.tsx`

- [ ] **Step 1: Replace the entire file**

```typescript
"use client";

import { ReactNode, useState } from "react";
import { Download } from "lucide-react";
import { cn } from "@/utils/utils";

export type MaterialCategory = "marketing" | "contracts" | "training" | "onboarding";

interface MaterialCardProps {
  title: string;
  description?: string | null;
  tag?: string | null;
  fileUrl: string;
  onDownload: (fileUrl: string) => Promise<string>;
  icon?: ReactNode;
  tagSeparator?: string;
  category?: MaterialCategory;
}

const CATEGORY_STYLES: Record<MaterialCategory, {
  headerBg: string;
  iconText: string;
  tagBg: string;
  tagBorder: string;
  tagText: string;
}> = {
  marketing: {
    headerBg:   "bg-[var(--blue-lt)]",
    iconText:   "text-[var(--blue)]",
    tagBg:      "bg-[var(--blue-lt)]",
    tagBorder:  "border-[var(--blue)]/30",
    tagText:    "text-[var(--blue)]",
  },
  contracts: {
    headerBg:   "bg-[var(--purple-lt)]",
    iconText:   "text-[var(--purple)]",
    tagBg:      "bg-[var(--purple-lt)]",
    tagBorder:  "border-[var(--purple)]/30",
    tagText:    "text-[var(--purple)]",
  },
  training: {
    headerBg:   "bg-[var(--gold-lt)]",
    iconText:   "text-[var(--gold)]",
    tagBg:      "bg-[var(--gold-lt)]",
    tagBorder:  "border-[var(--gold-border)]",
    tagText:    "text-[var(--gold)]",
  },
  onboarding: {
    headerBg:   "bg-[var(--teal-lt)]",
    iconText:   "text-[var(--teal)]",
    tagBg:      "bg-[var(--teal-lt)]",
    tagBorder:  "border-[var(--teal)]/30",
    tagText:    "text-[var(--teal)]",
  },
};

const NEUTRAL_STYLES = {
  headerBg:   "bg-slate-50",
  iconText:   "text-[var(--text2)]",
  tagBg:      "bg-slate-100",
  tagBorder:  "border-slate-200",
  tagText:    "text-[var(--text2)]",
};

function splitTag(tag?: string | null, separator = " - ") {
  if (!tag) return { prefix: "", label: "" };
  if (!separator || !tag.includes(separator)) return { prefix: "", label: tag };
  const [prefix, ...rest] = tag.split(separator);
  return { prefix: prefix?.trim() ?? "", label: rest.join(separator).trim() };
}

export function MaterialCard({
  title,
  description,
  tag,
  fileUrl,
  onDownload,
  icon,
  tagSeparator = " - ",
  category,
}: MaterialCardProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const { prefix, label } = splitTag(tag, tagSeparator);
  const styles = category ? CATEGORY_STYLES[category] : NEUTRAL_STYLES;

  async function handleDownloadClick() {
    try {
      setIsDownloading(true);
      const signedUrl = await onDownload(fileUrl);
      if (!signedUrl) throw new Error("Missing download URL");
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="group flex flex-col min-h-[280px] overflow-hidden rounded-2xl border border-slate-200 bg-[var(--surface)] shadow-sm transition-all duration-150 hover:shadow-md hover:border-slate-300">
      {/* Category-tinted header */}
      <div className={cn("relative flex items-start justify-between px-5 py-4", styles.headerBg)}>
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm", styles.iconText)}>
          {icon}
        </div>
        {(prefix || label) && (
          <div className={cn(
            "inline-flex max-w-[60%] items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            styles.tagBg,
            styles.tagBorder,
            styles.tagText,
          )}>
            {prefix ? <span className="shrink-0">{prefix}</span> : null}
            {label ? (
              <span className="truncate normal-case tracking-normal">{label}</span>
            ) : null}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
        <h3
          className="text-[15px] font-semibold leading-snug text-[var(--navy)] line-clamp-2"
          title={title}
        >
          {title}
        </h3>
        <p
          className="mt-2 text-[13px] leading-5 text-[var(--text2)] line-clamp-3 flex-1"
          title={description || "No description available."}
        >
          {description || "No description available."}
        </p>
        <button
          type="button"
          onClick={handleDownloadClick}
          disabled={isDownloading}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[7px] bg-[var(--teal)] px-4 h-9 text-sm font-medium text-white transition-colors hover:bg-[var(--teal)]/90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Download className="h-4 w-4" />
          <span>{isDownloading ? "Preparing..." : "Download"}</span>
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run `npx tsc --noEmit 2>&1 | tail -5` → zero errors.

---

## Task 2: Restyle `AdminMaterialCard.tsx`

**Files:**
- Modify: `app/(components)/AdminMaterialCard.tsx`

- [ ] **Step 1: Replace the entire file**

```typescript
"use client";

import { ReactNode, useState } from "react";
import { Download, Trash2 } from "lucide-react";
import ConfirmModal from "@/app/(components)/ConfirmModal";
import { cn } from "@/utils/utils";
import type { MaterialCategory } from "@/app/(components)/MaterialCard";

interface AdminMaterialCardProps {
  id: string;
  title: string;
  description?: string | null;
  tag?: string | null;
  fileUrl: string;
  onDownload: (fileUrl: string) => Promise<string>;
  onDelete: (id: string) => Promise<void>;
  icon?: ReactNode;
  tagSeparator?: string;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  isActive?: boolean;
  category?: MaterialCategory;
}

const CATEGORY_STYLES: Record<MaterialCategory, {
  headerBg: string;
  iconText: string;
  tagBg: string;
  tagBorder: string;
  tagText: string;
}> = {
  marketing: {
    headerBg:   "bg-[var(--blue-lt)]",
    iconText:   "text-[var(--blue)]",
    tagBg:      "bg-[var(--blue-lt)]",
    tagBorder:  "border-[var(--blue)]/30",
    tagText:    "text-[var(--blue)]",
  },
  contracts: {
    headerBg:   "bg-[var(--purple-lt)]",
    iconText:   "text-[var(--purple)]",
    tagBg:      "bg-[var(--purple-lt)]",
    tagBorder:  "border-[var(--purple)]/30",
    tagText:    "text-[var(--purple)]",
  },
  training: {
    headerBg:   "bg-[var(--gold-lt)]",
    iconText:   "text-[var(--gold)]",
    tagBg:      "bg-[var(--gold-lt)]",
    tagBorder:  "border-[var(--gold-border)]",
    tagText:    "text-[var(--gold)]",
  },
  onboarding: {
    headerBg:   "bg-[var(--teal-lt)]",
    iconText:   "text-[var(--teal)]",
    tagBg:      "bg-[var(--teal-lt)]",
    tagBorder:  "border-[var(--teal)]/30",
    tagText:    "text-[var(--teal)]",
  },
};

const NEUTRAL_STYLES = {
  headerBg:   "bg-slate-50",
  iconText:   "text-[var(--text2)]",
  tagBg:      "bg-slate-100",
  tagBorder:  "border-slate-200",
  tagText:    "text-[var(--text2)]",
};

function splitTag(tag?: string | null, separator = " - ") {
  if (!tag) return { prefix: "", label: "" };
  if (!separator || !tag.includes(separator)) return { prefix: "", label: tag };
  const [prefix, ...rest] = tag.split(separator);
  return { prefix: prefix?.trim() ?? "", label: rest.join(separator).trim() };
}

export function AdminMaterialCard({
  id,
  title,
  description,
  tag,
  fileUrl,
  onDownload,
  onDelete,
  icon,
  tagSeparator = " - ",
  selected,
  onToggleSelect,
  isActive = true,
  category,
}: AdminMaterialCardProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { prefix, label } = splitTag(tag, tagSeparator);
  const styles = category ? CATEGORY_STYLES[category] : NEUTRAL_STYLES;

  async function handleDownloadClick() {
    try {
      setIsDownloading(true);
      const signedUrl = await onDownload(fileUrl);
      if (!signedUrl) throw new Error("Missing download URL");
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleConfirmDelete() {
    try {
      setDeleting(true);
      await onDelete(id);
      setConfirmOpen(false);
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div
        className={cn(
          "group relative flex flex-col min-h-[280px] overflow-hidden rounded-2xl border bg-[var(--surface)] shadow-sm transition-all duration-150 hover:shadow-md",
          selected
            ? "border-[var(--navy)] ring-2 ring-[var(--navy)]/20"
            : "border-slate-200 hover:border-slate-300",
          !isActive && "opacity-60",
        )}
      >
        {/* Checkbox overlay */}
        <button
          type="button"
          onClick={() => onToggleSelect(id)}
          className={cn(
            "absolute left-3 top-3 z-20 flex h-5 w-5 items-center justify-center rounded border-2 transition-colors",
            selected
              ? "border-[var(--navy)] bg-white"
              : "border-slate-300 bg-white hover:border-[var(--navy)]",
          )}
          aria-label={selected ? "Deselect" : "Select"}
        >
          {selected && (
            <svg viewBox="0 0 10 8" className="h-3 w-3">
              <path
                d="M1 4l3 3 5-6"
                stroke="var(--navy)"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>

        {/* Delete button */}
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="absolute right-0 top-0 z-20 flex h-6 w-6 items-center justify-center rounded-bl-lg bg-red-500/90 text-white transition hover:bg-red-600"
          aria-label="Delete material"
        >
          <Trash2 className="h-3 w-3" />
        </button>

        {/* Inactive badge */}
        {!isActive && (
          <div className="absolute right-10 top-3 z-20 rounded-full bg-[var(--text3)]/70 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
            Inactive
          </div>
        )}

        {/* Category-tinted header */}
        <div className={cn("relative flex items-start justify-between px-5 py-4 pl-10", styles.headerBg)}>
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm", styles.iconText)}>
            {icon}
          </div>
          {(prefix || label) && (
            <div className={cn(
              "inline-flex max-w-[55%] items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide mt-8",
              styles.tagBg,
              styles.tagBorder,
              styles.tagText,
            )}>
              {prefix ? <span className="shrink-0">{prefix}</span> : null}
              {label ? (
                <span className="truncate normal-case tracking-normal">{label}</span>
              ) : null}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
          <h3
            className="text-[15px] font-semibold leading-snug text-[var(--navy)] line-clamp-2"
            title={title}
          >
            {title}
          </h3>
          <p
            className="mt-2 text-[13px] leading-5 text-[var(--text2)] line-clamp-3 flex-1"
            title={description || "No description available."}
          >
            {description || "No description available."}
          </p>
          <button
            type="button"
            onClick={handleDownloadClick}
            disabled={isDownloading}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[7px] bg-[var(--teal)] px-4 h-9 text-sm font-medium text-white transition-colors hover:bg-[var(--teal)]/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Download className="h-4 w-4" />
            <span>{isDownloading ? "Preparing..." : "Download"}</span>
          </button>
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        onOpenChange={(val) => {
          if (!deleting) setConfirmOpen(val);
        }}
        onConfirm={handleConfirmDelete}
        isLoading={deleting}
        title="Delete Material"
        description={`Are you sure you want to delete "${title}"? This will permanently remove the file from storage.`}
        confirmLabel="Delete"
      />
    </>
  );
}
```

- [ ] **Step 2: Verify**

Run `npx tsc --noEmit 2>&1 | tail -5` → zero errors.

---

## Task 3: Add `category` dot to `MaterialSection.tsx`

**Files:**
- Modify: `app/(components)/MaterialSection.tsx`

- [ ] **Step 1: Replace the file**

```typescript
import { ReactNode } from "react";
import { cn } from "@/utils/utils";
import type { MaterialCategory } from "@/app/(components)/MaterialCard";

interface MaterialsSectionProps {
  title: string;
  category?: MaterialCategory;
  children: ReactNode;
}

const CATEGORY_DOT: Record<MaterialCategory, string> = {
  marketing:  "bg-[var(--blue)]",
  contracts:  "bg-[var(--purple)]",
  training:   "bg-[var(--gold)]",
  onboarding: "bg-[var(--teal)]",
};

export function MaterialsSection({ title, category, children }: MaterialsSectionProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        {category && (
          <span className={cn("h-2 w-2 rounded-full shrink-0", CATEGORY_DOT[category])} />
        )}
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 whitespace-nowrap">
          {title}
        </h2>
        <div className="flex-1 h-px bg-slate-200" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run `npx tsc --noEmit 2>&1 | tail -5` → zero errors.

---

## Task 4: Restyle `ResourceSubTabs.tsx` to underline style

**Files:**
- Modify: `app/(dashboard)/dashboard/resources/(components)/ResourceSubTabs.tsx`

- [ ] **Step 1: Replace the file**

```typescript
"use client";

import { cn } from "@/utils/utils";

const TABS = ["All", "Marketing", "Contracts", "Training", "Onboarding"] as const;

export function ResourceSubTabs({
  activeTab,
  onTabChange,
  counts,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
  counts: Record<string, number>;
}) {
  return (
    <div
      className="flex gap-6 overflow-x-auto border-b border-slate-200"
      style={{ scrollbarWidth: "none" }}
    >
      {TABS.map((tab) => {
        const count = tab === "All"
          ? Object.values(counts).reduce((s, n) => s + n, 0)
          : counts[tab] ?? 0;
        const active = activeTab === tab;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap px-1 py-2.5 text-[13px] transition-colors border-b-2 -mb-px",
              active
                ? "font-semibold text-[var(--navy)] border-[var(--navy)]"
                : "font-medium text-[var(--text3)] border-transparent hover:text-[var(--navy)]",
            )}
          >
            <span>{tab}</span>
            {count > 0 && (
              <span
                className={cn(
                  "inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-semibold leading-[1.6]",
                  active
                    ? "bg-[var(--navy)] text-white"
                    : "bg-slate-100 text-[var(--text3)]",
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run `npx tsc --noEmit 2>&1 | tail -5` → zero errors.

---

## Task 5: Thread `category` prop through `ResourcesContent.tsx`

**Files:**
- Modify: `app/(dashboard)/dashboard/resources/(sections)/ResourcesContent.tsx`

- [ ] **Step 1: Pass `category` to both card components in `renderCard`**

Find:

```typescript
    if (isAdmin) {
      return (
        <AdminMaterialCard
          key={item.id}
          id={item.id}
          title={title}
          description={description}
          tag={tag}
          fileUrl={item.file_url}
          onDownload={handleDownload}
          onDelete={getDeleteFn(item.category)}
          icon={icon}
          tagSeparator=" - "
          selected={isItemSelected(item)}
          onToggleSelect={() => toggleItem(item)}
          isActive={item.is_active}
        />
      );
    }
    return (
      <MaterialCard
        key={item.id}
        title={title}
        description={description}
        tag={tag}
        fileUrl={item.file_url}
        onDownload={handleDownload}
        icon={icon}
        tagSeparator=" - "
      />
    );
```

Replace with:

```typescript
    if (isAdmin) {
      return (
        <AdminMaterialCard
          key={item.id}
          id={item.id}
          title={title}
          description={description}
          tag={tag}
          fileUrl={item.file_url}
          onDownload={handleDownload}
          onDelete={getDeleteFn(item.category)}
          icon={icon}
          tagSeparator=" - "
          selected={isItemSelected(item)}
          onToggleSelect={() => toggleItem(item)}
          isActive={item.is_active}
          category={item.category}
        />
      );
    }
    return (
      <MaterialCard
        key={item.id}
        title={title}
        description={description}
        tag={tag}
        fileUrl={item.file_url}
        onDownload={handleDownload}
        icon={icon}
        tagSeparator=" - "
        category={item.category}
      />
    );
```

- [ ] **Step 2: Pass `category` to `MaterialsSection` in the All view**

Find:

```typescript
              <MaterialsSection key={cat} title={getCategoryLabel(cat)}>
                {group.map(renderCard)}
              </MaterialsSection>
```

Replace with:

```typescript
              <MaterialsSection key={cat} title={getCategoryLabel(cat)} category={cat}>
                {group.map(renderCard)}
              </MaterialsSection>
```

- [ ] **Step 3: Update the category-tinted icon styling**

In this file, `getCategoryIcon(category)` currently returns `<Megaphone className="w-6 h-6 text-white" />` etc. Since the new card uses a light header, `text-white` icons would disappear. Change each icon to **remove** the `text-white` class so the icon inherits from the parent `iconText` color set by the card component.

Replace:

```typescript
function getCategoryIcon(category: Category) {
  switch (category) {
    case "marketing": return <Megaphone className="w-6 h-6 text-white" />;
    case "contracts": return <ScrollText className="w-6 h-6 text-white" />;
    case "training": return <BookOpen className="w-6 h-6 text-white" />;
    case "onboarding": return <Hospital className="w-6 h-6 text-white" />;
  }
}
```

With:

```typescript
function getCategoryIcon(category: Category) {
  switch (category) {
    case "marketing": return <Megaphone className="w-5 h-5" />;
    case "contracts": return <ScrollText className="w-5 h-5" />;
    case "training": return <BookOpen className="w-5 h-5" />;
    case "onboarding": return <Hospital className="w-5 h-5" />;
  }
}
```

- [ ] **Step 4: Verify**

Run `npx tsc --noEmit 2>&1 | tail -5` → zero errors.

---

## Task 6: Thread `category` prop on the 4 single-category pages

**Files:**
- Modify: `app/(dashboard)/dashboard/marketing/(sections)/MarketingCards.tsx`
- Modify: `app/(dashboard)/dashboard/contracts/(sections)/ContractCards.tsx`
- Modify: `app/(dashboard)/dashboard/trainings/(sections)/TrainingCards.tsx`
- Modify: `app/(dashboard)/dashboard/hospital-onboarding/(sections)/HospitalOnboardingCards.tsx`

For each of the four files:

- [ ] **Step 1: Pass `category` to both `<AdminMaterialCard ... />` and `<MaterialCard ... />` usages**

Locate both usages in the file (grep for `AdminMaterialCard` and `MaterialCard`) and add the `category` prop:

- `MarketingCards.tsx` → `category="marketing"`
- `ContractCards.tsx` → `category="contracts"`
- `TrainingCards.tsx` → `category="training"`
- `HospitalOnboardingCards.tsx` → `category="onboarding"`

Also **remove `text-white`** from the lucide icon className in each file if it exists (the icon template for these pages parallels `getCategoryIcon` from `ResourcesContent`). If the icon is declared inline (e.g., `<Megaphone className="w-6 h-6 text-white" />`), change to `w-5 h-5` and drop `text-white`.

- [ ] **Step 2: Verify**

Run `npx tsc --noEmit 2>&1 | tail -5` → zero errors.

---

## Task 7: Final build + browser spot-check

- [ ] **Step 1: Production build**

```bash
npm run build 2>&1 | tail -20
```

Expected: zero errors.

- [ ] **Step 2: Browser check**

Start `npm run dev`, visit `/dashboard/resources`:
1. Tab bar: underline style; "All" selected has bottom-border navy + filled count pill; other tabs are muted
2. Cards: light-tinted header per category, circular white icon badge, tag pill at top-right in category color
3. Title wraps to 2 lines (no mid-word truncation); description to 3 lines; all cards same height
4. Hover: subtle shadow lift

Also visit:
- `/dashboard/marketing` → blue-tinted headers
- `/dashboard/contracts` → purple-tinted
- `/dashboard/trainings` → gold-tinted
- `/dashboard/hospital-onboarding` → teal-tinted

Verify downloads still work (click Download → opens signed URL in new tab).
Verify admin controls (delete + select) still work on `/dashboard/marketing` as admin.
