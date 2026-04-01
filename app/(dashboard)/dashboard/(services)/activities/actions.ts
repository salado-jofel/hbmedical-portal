"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserOrThrow, getUserRole } from "@/lib/supabase/auth";
import {
  ACTIVITIES_TABLE,
  ACTIVITY_SELECT,
  ACTIVITIES_PATH,
} from "@/utils/constants/activities";
import {
  createActivitySchema,
  updateActivitySchema,
  mapActivity,
  mapActivities,
  type IActivity,
  type IActivityFormState,
  type RawActivityRecord,
} from "@/utils/interfaces/activities";

/* -------------------------------------------------------------------------- */
/* Permission helper                                                          */
/* -------------------------------------------------------------------------- */

async function canManageActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  facilityId: string,
): Promise<boolean> {
  const role = await getUserRole(supabase);
  if (role === "admin") return true;
  if (role === "sales_representative") {
    const { data } = await supabase
      .from("facilities")
      .select("assigned_rep")
      .eq("id", facilityId)
      .maybeSingle();
    return data?.assigned_rep === userId;
  }
  return false;
}

function toNullable(val: string | null | undefined): string | null {
  if (!val || val.trim() === "" || val.trim() === "none") return null;
  return val.trim();
}

/* -------------------------------------------------------------------------- */
/* getActivitiesByFacility                                                   */
/* -------------------------------------------------------------------------- */

export async function getActivitiesByFacility(
  facilityId: string,
): Promise<IActivity[]> {
  const supabase = await createClient();
  await getCurrentUserOrThrow(supabase);

  const { data, error } = await supabase
    .from(ACTIVITIES_TABLE)
    .select(ACTIVITY_SELECT)
    .eq("facility_id", facilityId)
    .order("activity_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getActivitiesByFacility] Error:", error);
    throw new Error(error.message || "Failed to fetch activities.");
  }

  return mapActivities((data ?? []) as unknown as RawActivityRecord[]);
}

/* -------------------------------------------------------------------------- */
/* createActivity                                                            */
/* -------------------------------------------------------------------------- */

export async function createActivity(
  facilityId: string,
  _prevState: IActivityFormState | null,
  formData: FormData,
): Promise<IActivityFormState> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);

    const allowed = await canManageActivity(supabase, user.id, facilityId);
    if (!allowed) {
      return { error: "You do not have permission to log activities for this account.", success: false };
    }

    const raw = {
      type: formData.get("type") as string,
      activity_date: formData.get("activity_date") as string,
      contact_id: toNullable(formData.get("contact_id") as string),
      outcome: formData.get("outcome") as string,
      notes: toNullable(formData.get("notes") as string),
    };

    const parsed = createActivitySchema.safeParse(raw);
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message ?? "Invalid input.", success: false };
    }

    const { error } = await supabase.from(ACTIVITIES_TABLE).insert({
      facility_id: facilityId,
      logged_by: user.id,
      type: parsed.data.type,
      activity_date: parsed.data.activity_date,
      contact_id: parsed.data.contact_id || null,
      outcome: parsed.data.outcome,
      notes: toNullable(parsed.data.notes),
    });

    if (error) {
      console.error("[createActivity] Error:", error);
      return { error: error.message || "Failed to log activity.", success: false };
    }

    revalidatePath(`${ACTIVITIES_PATH}/${facilityId}`);
    return { error: null, success: true };
  } catch (err) {
    console.error("[createActivity] Unexpected error:", err);
    return { error: "An unexpected error occurred.", success: false };
  }
}

/* -------------------------------------------------------------------------- */
/* updateActivity                                                            */
/* -------------------------------------------------------------------------- */

export async function updateActivity(
  activityId: string,
  facilityId: string,
  _prevState: IActivityFormState | null,
  formData: FormData,
): Promise<IActivityFormState> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);

    const allowed = await canManageActivity(supabase, user.id, facilityId);
    if (!allowed) {
      return { error: "You do not have permission to edit this activity.", success: false };
    }

    const raw = {
      type: formData.get("type") as string,
      activity_date: formData.get("activity_date") as string,
      contact_id: toNullable(formData.get("contact_id") as string),
      outcome: formData.get("outcome") as string,
      notes: toNullable(formData.get("notes") as string),
    };

    const parsed = updateActivitySchema.safeParse(raw);
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message ?? "Invalid input.", success: false };
    }

    const { error } = await supabase
      .from(ACTIVITIES_TABLE)
      .update({
        type: parsed.data.type,
        activity_date: parsed.data.activity_date,
        contact_id: parsed.data.contact_id || null,
        outcome: parsed.data.outcome,
        notes: toNullable(parsed.data.notes),
      })
      .eq("id", activityId)
      .eq("facility_id", facilityId);

    if (error) {
      console.error("[updateActivity] Error:", error);
      return { error: error.message || "Failed to update activity.", success: false };
    }

    revalidatePath(`${ACTIVITIES_PATH}/${facilityId}`);
    return { error: null, success: true };
  } catch (err) {
    console.error("[updateActivity] Unexpected error:", err);
    return { error: "An unexpected error occurred.", success: false };
  }
}

/* -------------------------------------------------------------------------- */
/* deleteActivity                                                            */
/* -------------------------------------------------------------------------- */

export async function deleteActivity(
  activityId: string,
  facilityId: string,
): Promise<void> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);

  const allowed = await canManageActivity(supabase, user.id, facilityId);
  if (!allowed) {
    throw new Error("You do not have permission to delete this activity.");
  }

  const { error } = await supabase
    .from(ACTIVITIES_TABLE)
    .delete()
    .eq("id", activityId)
    .eq("facility_id", facilityId);

  if (error) {
    console.error("[deleteActivity] Error:", error);
    throw new Error(error.message || "Failed to delete activity.");
  }

  revalidatePath(`${ACTIVITIES_PATH}/${facilityId}`);
}
