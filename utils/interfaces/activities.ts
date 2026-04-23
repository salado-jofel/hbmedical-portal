import { z } from "zod";
import { uuidString } from "@/utils/validators/shared";

/* -------------------------------------------------------------------------- */
/* Enums                                                                      */
/* -------------------------------------------------------------------------- */

export const activityTypeSchema = z.enum(["visit", "call", "email", "demo"]);
export type ActivityType = z.infer<typeof activityTypeSchema>;

export const activityOutcomeSchema = z.enum([
  "positive",
  "neutral",
  "negative",
  "no_response",
]);
export type ActivityOutcome = z.infer<typeof activityOutcomeSchema>;

/* -------------------------------------------------------------------------- */
/* Joined sub-shapes                                                          */
/* -------------------------------------------------------------------------- */

export interface IActivityProfile {
  id: string;
  first_name: string;
  last_name: string;
}

export interface IActivityContact {
  id: string;
  first_name: string;
  last_name: string;
}

/* -------------------------------------------------------------------------- */
/* Core interface                                                             */
/* -------------------------------------------------------------------------- */

export interface IActivity {
  id: string;
  facility_id: string;
  contact_id: string | null;
  logged_by: string;
  type: ActivityType;
  activity_date: string; // YYYY-MM-DD
  outcome: ActivityOutcome;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  logged_by_profile: IActivityProfile | null;
  contact: IActivityContact | null;
}

/* -------------------------------------------------------------------------- */
/* Form state                                                                 */
/* -------------------------------------------------------------------------- */

export interface IActivityFormState {
  error: string | null;
  success: boolean;
  activity?: IActivity;
}

/* -------------------------------------------------------------------------- */
/* Zod validation schemas                                                     */
/* -------------------------------------------------------------------------- */

export const createActivitySchema = z.object({
  type: activityTypeSchema,
  activity_date: z.string().trim().min(1, "Date is required."),
  contact_id: uuidString().nullable().optional().or(z.literal("")),
  outcome: activityOutcomeSchema,
  notes: z.string().trim().nullable().optional(),
});

export const updateActivitySchema = createActivitySchema;

export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;

/* -------------------------------------------------------------------------- */
/* Raw Supabase response                                                      */
/* -------------------------------------------------------------------------- */

export type RawActivityRecord = {
  id: string;
  facility_id: string;
  contact_id: string | null;
  logged_by: string;
  type: string;
  activity_date: string;
  outcome: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  logged_by_profile: IActivityProfile | null;
  contact: IActivityContact | null;
};

/* -------------------------------------------------------------------------- */
/* Mapping                                                                    */
/* -------------------------------------------------------------------------- */

export function mapActivity(raw: RawActivityRecord): IActivity {
  return {
    id: raw.id,
    facility_id: raw.facility_id,
    contact_id: raw.contact_id,
    logged_by: raw.logged_by,
    type: activityTypeSchema.catch("call").parse(raw.type),
    activity_date: raw.activity_date,
    outcome: activityOutcomeSchema.catch("neutral").parse(raw.outcome),
    notes: raw.notes,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    logged_by_profile: raw.logged_by_profile ?? null,
    contact: raw.contact ?? null,
  };
}

export function mapActivities(rows: RawActivityRecord[]): IActivity[] {
  return rows.map(mapActivity);
}

export type TypeFilter = ActivityType | "all";
