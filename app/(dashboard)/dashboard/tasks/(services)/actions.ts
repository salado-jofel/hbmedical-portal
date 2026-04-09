"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserOrThrow, requireAdminOrThrow, getUserRole } from "@/lib/supabase/auth";
import { isAdmin, isSalesRep } from "@/utils/helpers/role";
import { TASKS_TABLE, TASK_SELECT, TASKS_PATH } from "@/utils/constants/activities";
import {
  createTaskSchema,
  updateTaskSchema,
  mapTask,
  mapTasks,
  type ITask,
  type ITaskFormState,
  type TaskStatus,
  type RawTaskRecord,
} from "@/utils/interfaces/tasks";

/* -------------------------------------------------------------------------- */
/* Helper                                                                    */
/* -------------------------------------------------------------------------- */

function toNullable(val: string | null | undefined): string | null {
  if (!val || val.trim() === "" || val.trim() === "none") return null;
  return val.trim();
}

/* -------------------------------------------------------------------------- */
/* getTasks                                                                  */
/* -------------------------------------------------------------------------- */

export async function getTasks(filters?: {
  status?: TaskStatus | "all";
  priority?: string;
  facility_id?: string;
}): Promise<ITask[]> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const role = await getUserRole(supabase);

  if (!isAdmin(role) && !isSalesRep(role)) {
    throw new Error("Unauthorized.");
  }

  let query = supabase
    .from(TASKS_TABLE)
    .select(TASK_SELECT)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  // Sales reps only see tasks assigned to them
  if (!isAdmin(role)) {
    query = query.eq("assigned_to", user.id);
  }

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters?.priority && filters.priority !== "all") {
    query = query.eq("priority", filters.priority);
  }

  if (filters?.facility_id) {
    query = query.eq("facility_id", filters.facility_id);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[getTasks] Error:", error);
    throw new Error(error.message || "Failed to fetch tasks.");
  }

  return mapTasks((data ?? []) as unknown as RawTaskRecord[]);
}

/* -------------------------------------------------------------------------- */
/* getTasksByFacility                                                        */
/* -------------------------------------------------------------------------- */

export async function getTasksByFacility(facilityId: string): Promise<ITask[]> {
  return getTasks({ facility_id: facilityId });
}

/* -------------------------------------------------------------------------- */
/* createTask                                                                */
/* -------------------------------------------------------------------------- */

export async function createTask(
  _prevState: ITaskFormState | null,
  formData: FormData,
): Promise<ITaskFormState> {
  try {
    const supabase = await createClient();
    await requireAdminOrThrow(supabase);
    const user = await getCurrentUserOrThrow(supabase);

    const raw = {
      title: formData.get("title") as string,
      due_date: (formData.get("due_date") as string) ?? "",
      priority: formData.get("priority") as string || "medium",
      assigned_to: toNullable(formData.get("assigned_to") as string),
      facility_id: toNullable(formData.get("facility_id") as string),
      contact_id: toNullable(formData.get("contact_id") as string),
      notes: toNullable(formData.get("notes") as string),
    };

    const parsed = createTaskSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input.", success: false };
    }

    const assignedTo = parsed.data.assigned_to || user.id;

    const { error } = await supabase.from(TASKS_TABLE).insert({
      title: parsed.data.title,
      due_date: parsed.data.due_date,
      priority: parsed.data.priority,
      status: "open",
      created_by: user.id,
      assigned_to: assignedTo,
      facility_id: parsed.data.facility_id || null,
      contact_id: parsed.data.contact_id || null,
      notes: toNullable(parsed.data.notes),
      reminder_sent: false,
    });

    if (error) {
      console.error("[createTask] Error:", error);
      return { error: error.message || "Failed to create task.", success: false };
    }

    revalidatePath(TASKS_PATH);
    return { error: null, success: true };
  } catch (err) {
    console.error("[createTask] Unexpected error:", err);
    return { error: "An unexpected error occurred.", success: false };
  }
}

/* -------------------------------------------------------------------------- */
/* updateTask                                                                */
/* -------------------------------------------------------------------------- */

export async function updateTask(
  taskId: string,
  _prevState: ITaskFormState | null,
  formData: FormData,
): Promise<ITaskFormState> {
  try {
    const supabase = await createClient();
    await requireAdminOrThrow(supabase);
    const user = await getCurrentUserOrThrow(supabase);

    const raw = {
      title: formData.get("title") as string,
      due_date: (formData.get("due_date") as string) ?? "",
      priority: formData.get("priority") as string || "medium",
      assigned_to: toNullable(formData.get("assigned_to") as string),
      facility_id: toNullable(formData.get("facility_id") as string),
      contact_id: toNullable(formData.get("contact_id") as string),
      notes: toNullable(formData.get("notes") as string),
    };

    const parsed = updateTaskSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input.", success: false };
    }

    const assignedTo = parsed.data.assigned_to || user.id;

    const { error } = await supabase
      .from(TASKS_TABLE)
      .update({
        title: parsed.data.title,
        due_date: parsed.data.due_date,
        priority: parsed.data.priority,
        assigned_to: assignedTo,
        facility_id: parsed.data.facility_id || null,
        contact_id: parsed.data.contact_id || null,
        notes: toNullable(parsed.data.notes),
      })
      .eq("id", taskId);

    if (error) {
      console.error("[updateTask] Error:", error);
      return { error: error.message || "Failed to update task.", success: false };
    }

    revalidatePath(TASKS_PATH);
    return { error: null, success: true };
  } catch (err) {
    console.error("[updateTask] Unexpected error:", err);
    return { error: "An unexpected error occurred.", success: false };
  }
}

/* -------------------------------------------------------------------------- */
/* toggleTaskStatus                                                          */
/* -------------------------------------------------------------------------- */

export async function toggleTaskStatus(
  taskId: string,
  currentStatus: TaskStatus,
): Promise<ITask> {
  const supabase = await createClient();
  await requireAdminOrThrow(supabase);

  const nextStatus: TaskStatus = currentStatus === "open" ? "done" : "open";

  const { error } = await supabase
    .from(TASKS_TABLE)
    .update({ status: nextStatus })
    .eq("id", taskId);

  if (error) {
    console.error("[toggleTaskStatus] Error:", error);
    throw new Error(error.message || "Failed to update task status.");
  }

  const { data, error: fetchError } = await supabase
    .from(TASKS_TABLE)
    .select(TASK_SELECT)
    .eq("id", taskId)
    .single();

  if (fetchError || !data) {
    throw new Error("Failed to fetch updated task.");
  }

  revalidatePath(TASKS_PATH);
  return mapTask(data as unknown as RawTaskRecord);
}

/* -------------------------------------------------------------------------- */
/* deleteTask                                                                */
/* -------------------------------------------------------------------------- */

export async function deleteTask(taskId: string): Promise<void> {
  const supabase = await createClient();
  await requireAdminOrThrow(supabase);

  const { error } = await supabase
    .from(TASKS_TABLE)
    .delete()
    .eq("id", taskId);

  if (error) {
    console.error("[deleteTask] Error:", error);
    throw new Error(error.message || "Failed to delete task.");
  }

  revalidatePath(TASKS_PATH);
}
