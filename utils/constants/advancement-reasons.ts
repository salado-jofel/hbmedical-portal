/**
 * Standardized clinical justifications for advancing from conservative wound
 * care to advanced cellular/tissue-based products. Aligned with CMS LCD
 * language so each option maps to a payer-defensible documentation phrase.
 *
 * The `id` slugs are stable forever; only the `label` text gets persisted
 * to `order_forms.advancement_reason`. Storing the label (not the slug)
 * keeps clinical records immutable — if we ever clarify wording, old
 * records still show what the prescriber actually selected at sign-time.
 */
export const ADVANCEMENT_REASONS = [
  {
    id: "failure_50pct",
    label:
      "Failure to achieve ≥50% wound area reduction after 4 weeks of documented conservative care",
  },
  {
    id: "stalled_trajectory",
    label:
      "Stalled or static wound trajectory despite addressing all underlying factors",
  },
  {
    id: "wound_chronicity",
    label: "Wound chronicity beyond expected healing timeframes",
  },
  {
    id: "depth_complexity",
    label:
      "Wound depth or anatomical complexity exceeding what dressings can address",
  },
  {
    id: "limb_loss_risk",
    label: "High risk of limb loss or major morbidity if healing is delayed",
  },
  {
    id: "recurrent_recalcitrant",
    label: "Recurrent or recalcitrant wounds at the same anatomic site",
  },
  {
    id: "compromised_host",
    label: "Compromised host biology limiting native healing capacity",
  },
  {
    id: "qol_functional",
    label: "Quality-of-life and functional impact that justifies acceleration",
  },
] as const;

export type AdvancementReasonId = (typeof ADVANCEMENT_REASONS)[number]["id"];

/** Canonical labels (the actual saved values) — used to detect whether a
 *  saved string matches a known reason vs. is free-text "Other" content. */
export const ADVANCEMENT_REASON_LABELS: ReadonlyArray<string> =
  ADVANCEMENT_REASONS.map((r) => r.label);
