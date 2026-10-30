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
   * Which figure the card leads with.
   *
   * "commission" for open stages — the rep's question is what they will make.
   * "volume" for `paid`, deliberately: once a clinic pays, a real commission
   * row exists, and a rate-based estimate on the same orders will disagree
   * with it (a voided row, an adjustment, or a paid order that never got a
   * commission row all break the arithmetic). Showing both would put two
   * different answers to "what did I earn on these" on one screen, so the paid
   * stage reports the money the CLINIC paid and hands the rep's own cut to
   * RepEarnedCommissions, which reads the ledger.
   */
  metric: "commission" | "volume";
};

/* Order follows the money's actual journey, so the row reads as a pipeline
 * rather than a set of unrelated tiles. */
export const BUCKETS: PipelineStage[] = [
  {
    key: "in_progress",
    label: "In Progress",
    caption: "est. to you",
    hint: "Still in the clinic or under review — not yet cleared.",
    bar: "bg-slate-400",
    metric: "commission",
  },
  {
    key: "fulfilled",
    label: "Went Through",
    caption: "est. to you",
    hint: "Approved, shipped or delivered. Not invoiced yet.",
    bar: "bg-blue-500",
    metric: "commission",
  },
  {
    key: "collectible",
    label: "Collectible",
    caption: "est. to you",
    hint: "Invoiced and waiting on the clinic to pay.",
    bar: "bg-amber-500",
    metric: "commission",
  },
  {
    key: "paid",
    label: "Paid",
    caption: "clinic paid",
    hint: "Collected. What this earned you is in Earned, below.",
    bar: "bg-emerald-500",
    metric: "volume",
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
