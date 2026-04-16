# Resources Page Beautification

**Date:** 2026-04-16
**Scope:** Styling-only refresh of `MaterialCard` / `AdminMaterialCard` and the Resources-page sub-tabs, with a category color system mapped to existing CSS vars. Global restyle — changes apply everywhere the cards are used (Resources, Marketing, Contracts, Training, Hospital Onboarding).

---

## 1. Overview

The Resources page functions correctly but feels heavy: every card sports a tall dark-navy gradient header, titles truncate mid-word, card heights are uneven, and nothing visually distinguishes categories at a glance. This change is **purely CSS/JSX styling**. No data flow, no Redux, no server actions, no business logic changes.

Global impact: the new visual treatment will automatically flow to the four single-category pages (`/dashboard/marketing`, `/contracts`, `/trainings`, `/hospital-onboarding`) since they reuse `MaterialCard` / `AdminMaterialCard`.

---

## 2. Category color system

Extend `MaterialCard` and `AdminMaterialCard` with an optional prop:

```ts
category?: "marketing" | "contracts" | "training" | "onboarding";
```

Default: unset → uses a neutral slate palette. When set, the card header tint, icon badge background, and tag pill color change to the category's accent.

| Category | Header bg | Accent text | Tag pill bg | Tag pill text |
|---|---|---|---|---|
| marketing | `var(--blue-lt)` | `var(--blue)` | `var(--blue-lt)` + 1px border `var(--blue)/30` | `var(--blue)` |
| contracts | `var(--purple-lt)` | `var(--purple)` | `var(--purple-lt)` + border `var(--purple)/30` | `var(--purple)` |
| training | `var(--gold-lt)` | `var(--gold)` | `var(--gold-lt)` + border `var(--gold-border)` | `var(--gold)` |
| onboarding | `var(--teal-lt)` | `var(--teal)` | `var(--teal-lt)` + border `var(--teal)/30` | `var(--teal)` |

Consumers (5 pages) will pass `category="marketing"` etc. explicitly.

---

## 3. `MaterialCard.tsx` restyle

### Current
- Dark navy-to-blue gradient header ~144px tall
- Title on dark background, white text, `truncate` (single line, cuts mid-word)
- Tag pill in top-right with `bg-white/18` glassy effect
- Icon on `bg-white/14` inside header
- Body below with description + download button

### New
- Light tinted header (`bg-[var(--blue-lt)]` for marketing, etc.), **~96px tall**
- Circular colored icon badge (`h-11 w-11 rounded-full bg-[var(--surface)] shadow-sm`) with category-accent icon color
- Title renders in **the body**, not the header — 2 lines max via `line-clamp-2`, `text-[var(--navy)]`, `font-semibold`, `text-[15px]`
- Tag pill moves to top-right of the header, smaller (`text-[10px]`, `px-2 py-0.5`), category-colored
- Card overall: `rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all`
- **Fixed card height** — `min-h-[280px]` + `flex flex-col`; description area is `flex-1` so the Download button always sits at the bottom
- Description text `text-[13px] text-[var(--text2)] line-clamp-3`
- Download button: existing teal style preserved (`bg-[var(--teal)] text-white`), keeps full width at the bottom

### Prop additions
```tsx
interface MaterialCardProps {
  // existing props unchanged
  category?: "marketing" | "contracts" | "training" | "onboarding";
}
```

---

## 4. `AdminMaterialCard.tsx` restyle

Parallel to `MaterialCard`:
- Same light-tinted header + category colors
- Same `line-clamp-2` title + `line-clamp-3` description
- Same fixed height + flex layout
- Selection checkbox (existing) stays in top-left of header
- "Inactive" badge if `isActive === false` — same position, slightly refined styling to blend with the lighter header
- Delete/Edit actions row — unchanged logic, restyle to match overall lighter feel

### Prop additions
Same `category` prop.

---

## 5. `ResourceSubTabs.tsx` polish

### Current
Full-width segmented bar with filled navy for active tab; count pill inline.

### New
Same `flex` row, but:
- **Inactive tab**: `text-[var(--text3)] hover:text-[var(--navy)]`, no background
- **Active tab**: `text-[var(--navy)] font-semibold` + 2px bottom border accent (`border-b-2 border-[var(--navy)]`)
- Count pill: `bg-[var(--border)] text-[var(--text3)] text-[11px] rounded-full px-1.5 py-0.5` (inactive); `bg-[var(--navy)] text-white` when tab is active
- Remove outer container `bg-[var(--surface)] border rounded` treatment — becomes a flat tab bar with underline
- Space between tabs (`gap-6`), no full justify-between

---

## 6. `ResourcesContent.tsx` minor tweaks

- Pass `category="marketing"` etc. to each `renderCard` invocation based on `item.category` — small prop-threading change
- Search bar: unchanged (`ActionBar` component), this is fine as-is
- Select-All button row: keep as-is
- Section dividers (`MARKETING`, `CONTRACTS` etc.) when in All view: add a small colored dot (`h-2 w-2 rounded-full bg-[var(--blue)]` etc.) before the label so the category color is reinforced

---

## 7. `MaterialsSection.tsx` small tweak

Add an optional `category` prop that renders a colored dot next to the heading. Keep other styles intact.

---

## 8. Files Changed

### Modified files
| File | Change |
|---|---|
| `app/(components)/MaterialCard.tsx` | Light-tinted header, line-clamp, fixed height, category prop |
| `app/(components)/AdminMaterialCard.tsx` | Parallel restyle + category prop |
| `app/(components)/MaterialSection.tsx` | Optional category dot next to heading |
| `app/(dashboard)/dashboard/resources/(components)/ResourceSubTabs.tsx` | Underline-style tab bar |
| `app/(dashboard)/dashboard/resources/(sections)/ResourcesContent.tsx` | Pass `category` to cards + `MaterialsSection` |
| `app/(dashboard)/dashboard/marketing/(sections)/MarketingCards.tsx` | Pass `category="marketing"` to cards |
| `app/(dashboard)/dashboard/contracts/(sections)/ContractCards.tsx` | Pass `category="contracts"` |
| `app/(dashboard)/dashboard/trainings/(sections)/TrainingCards.tsx` | Pass `category="training"` |
| `app/(dashboard)/dashboard/hospital-onboarding/(sections)/HospitalOnboardingCards.tsx` | Pass `category="onboarding"` |

### No new files

---

## 9. Out of Scope
- Restructuring the Resources page layout (tabs, order, search position)
- New data fetches or business logic
- Card preview thumbnails (PDF first-page images)
- Drag-to-reorder or custom sort
- Admin bulk actions UX (stays as-is)
- Responsive breakpoints beyond what's already in place
- Upload button styling (a separate component)
