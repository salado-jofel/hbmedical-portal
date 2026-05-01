/**
 * Standardized "prior treatments tried" taxonomy. Two-level structure:
 * top-level treatment categories, with sub-options for treatments that have
 * clinically distinct subtypes payers care about.
 *
 * Saved as a composite human-readable string ("Wound cleansing — Saline
 * solution") in `prior_treatments[].treatment`, so the PDF and the existing
 * AI-extracted free text both render correctly without a schema migration.
 *
 * The `id` slugs are stable forever; only the composed `label` strings get
 * persisted, keeping the clinical record immutable across future wording
 * tweaks.
 */
export interface PriorTreatmentSubOption {
  id: string;
  label: string;
}

export interface PriorTreatmentOption {
  id: string;
  label: string;
  subOptions?: ReadonlyArray<PriorTreatmentSubOption>;
}

export const PRIOR_TREATMENTS: ReadonlyArray<PriorTreatmentOption> = [
  {
    id: "debridement",
    label: "Debridement",
    subOptions: [
      { id: "sharp", label: "Sharp / conservative sharp" },
      { id: "mechanical", label: "Mechanical" },
      { id: "enzymatic", label: "Enzymatic (collagenase / Santyl)" },
      { id: "autolytic", label: "Autolytic" },
    ],
  },
  {
    id: "cleansing",
    label: "Wound cleansing",
    subOptions: [
      { id: "saline", label: "Saline solution or cleanser" },
      { id: "antiseptic", label: "Antiseptic solutions" },
    ],
  },
  {
    id: "moisture_dressing",
    label: "Moisture-balanced primary dressing",
    subOptions: [
      { id: "hydrogel", label: "Hydrogels" },
      { id: "hydrocolloid", label: "Hydrocolloids" },
      { id: "foam", label: "Foams" },
      { id: "alginate", label: "Alginates / gelling fibers" },
    ],
  },
  {
    id: "antimicrobial",
    label: "Antimicrobial dressings",
    subOptions: [
      { id: "silver", label: "Silver (Acticoat / Aquacel Ag / Mepilex Ag)" },
      { id: "phmb", label: "PHMB (Kerlix AMD / Telfa AMD)" },
      { id: "iodine", label: "Iodine-impregnated (Iodosorb)" },
      { id: "honey", label: "Honey-based (Medihoney)" },
    ],
  },
  {
    id: "compression",
    label: "Compression therapy for venous disease",
  },
  {
    id: "offloading",
    label: "Offloading for pressure / DFU",
  },
  {
    id: "moist_wound_therapy",
    label: "Standard moist wound therapy + secondary dressing",
  },
] as const;

/** Compose the saved string from parent + (optional) sub label. */
export function composePriorTreatmentLabel(
  parentLabel: string,
  subLabel: string,
): string {
  return subLabel ? `${parentLabel} — ${subLabel}` : parentLabel;
}

/** Reverse of `composePriorTreatmentLabel` — used when loading a saved row
 *  back into the dropdowns. Anything unrecognized routes to "other". */
export function decomposePriorTreatment(saved: string): {
  parentId: string;
  subId: string;
} {
  if (!saved) return { parentId: "", subId: "" };
  for (const parent of PRIOR_TREATMENTS) {
    if (saved === parent.label) {
      return { parentId: parent.id, subId: "" };
    }
    if (parent.subOptions) {
      for (const sub of parent.subOptions) {
        if (saved === composePriorTreatmentLabel(parent.label, sub.label)) {
          return { parentId: parent.id, subId: sub.id };
        }
      }
    }
  }
  return { parentId: "other", subId: "" };
}
