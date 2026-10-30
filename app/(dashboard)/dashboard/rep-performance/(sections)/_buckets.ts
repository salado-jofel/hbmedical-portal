/* Shared shape of the money pipeline's four stages.
 *
 * Lives here rather than in utils/constants/ because it is presentation: the
 * copy a rep reads and the colour of each stage's bar. The RULES behind the
 * stages are in utils/helpers/rep-pipeline.ts, which is pure and tested.
 *
 * Imported by RepMoneyPipeline and RepOverrideStrip so the rep's own book and
 * their override read in the same left-to-right order. Two separate literals
 * drifted apart the moment one of them was relabelled.
 */

import type { RepMoneyBucket } from "@/utils/helpers/rep-pipeline";

export type PipelineStage = {
  key: Exclude<RepMoneyBucket, "excluded">;
  label: string;
  /** Names the headline figure, so no card shows a bare unlabelled number. */
  caption: string;
  hint: string;
  bar: string;
  /**
   * Whether the stage's second line carries the rep's own cut.
   *
   * False for `paid` only. Once a clinic pays, a real commission row exists,
   * and a rate-based estimate on the same orders will disagree with it — a
   * voided row, an adjustment, or a paid order that never got a commission row
   * all break the arithmetic. Main Rep's 7 paid orders estimate to $2,086 at
   * 20% while the ledger holds $1,490. So the paid stage hands the rep's cut to
   * RepEarnedCommissions, which reads the ledger instead of guessing.
   */
  showCommission: boolean;
};

/* Order follows the money's actual journey, so the row reads as a pipeline
 * rather than a set of unrelated tiles.
 *
 * Every stage leads with the ORDER AMOUNT, on the client's instruction
 * (2026-10-30, on a screenshot of this card): asked whether a rep should see
 * the total order amount or just their commission, he answered "they need to
 * see the entire bill for sure and then their commission second". So the bill
 * is the headline and the rep's cut is the line beneath it — not the reverse. */
export const BUCKETS: PipelineStage[] = [
  {
    key: "in_progress",
    label: "In Progress",
    caption: "order value",
    hint: "Still in the clinic or under review — not yet cleared.",
    bar: "bg-slate-400",
    showCommission: true,
  },
  {
    key: "fulfilled",
    label: "Went Through",
    caption: "order value",
    hint: "Approved, shipped or delivered. Not invoiced yet.",
    bar: "bg-blue-500",
    showCommission: true,
  },
  {
    key: "collectible",
    label: "Collectible",
    caption: "billed, unpaid",
    hint: "Invoiced and waiting on the clinic to pay.",
    bar: "bg-amber-500",
    showCommission: true,
  },
  {
    key: "paid",
    label: "Paid",
    caption: "clinic paid",
    hint: "Collected. What this earned you is in Earned, below.",
    bar: "bg-emerald-500",
    showCommission: false,
  },
];

/**
 * The stages that are still open money.
 *
 * `paid` is excluded on purpose: once the clinic pays, a real commission row
 * exists, so counting a paid estimate into "still to come" would double it
 * against the earned figures. Used both for the headline total and for the
 * override strip, which is a forecast only.
 */
export const OPEN_STAGES = BUCKETS.filter((s) => s.key !== "paid");

export const OPEN_KEYS = ["in_progress", "fulfilled", "collectible"] as const;
