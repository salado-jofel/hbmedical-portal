import { z } from "zod";

/* -------------------------------------------------------------------------- */
/* Enums                                                                      */
/* -------------------------------------------------------------------------- */

export const taskPrioritySchema = z.enum(["low", "medium", "high"]);
export type TaskPriority = z.infer<typeof taskPrioritySchema>;

export const taskStatusSchema = z.enum(["open", "done"]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

/* -------------------------------------------------------------------------- */
/* Joined sub-shapes                                                          */
/* -------------------------------------------------------------------------- */

export interface ITaskProfile {
  id: string;
  first_name: string;
  last_name: string;
}

export interface ITaskFacility {
  id: string;
  name: string;
}

export interface ITaskContact {
  id: string;
  first_name: string;
  last_name: string;
}

/* -------------------------------------------------------------------------- */
/* Core interface                                                             */
/* -------------------------------------------------------------------------- */

export interface ITask {
  id: string;
  facility_id: string | null;
  contact_id: string | null;
  created_by: string;
  assigned_to: string | null;
  title: string;
  due_date: string; // YYYY-MM-DD
  priority: TaskPriority;
  status: TaskStatus;
  notes: string | null;
  reminder_sent: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  assigned_to_profile: ITaskProfile | null;
  facility: ITaskFacility | null;
  contact: ITaskContact | null;
}

/* -------------------------------------------------------------------------- */
/* Form state                                                                 */
/* -------------------------------------------------------------------------- */

export interface ITaskFormState {
  error: string | null;
  success: boolean;
}

/* -------------------------------------------------------------------------- */
/* Zod validation schemas                                                     */
/* -------------------------------------------------------------------------- */

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Title is required."),
  due_date: z.string().trim().min(1, "Due date is required."),
  priority: taskPrioritySchema.default("medium"),
  assigned_to: z.string().uuid().nullable().optional().or(z.literal("")),
  facility_id: z.string().uuid().nullable().optional().or(z.literal("")),
  contact_id: z.string().uuid().nullable().optional().or(z.literal("")),
  notes: z.string().trim().nullable().optional(),
});

export const updateTaskSchema = createTaskSchema;

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

/* -------------------------------------------------------------------------- */
/* Raw Supabase response                                                      */
/* -------------------------------------------------------------------------- */

export type RawTaskRecord = {
  id: string;
  facility_id: string | null;
  contact_id: string | null;
  created_by: string;
  assigned_to: string | null;
  title: string;
  due_date: string;
  priority: string;
  status: string;
  notes: string | null;
  reminder_sent: boolean;
  created_at: string;
  updated_at: string;
  assigned_to_profile: ITaskProfile | null;
  facility: ITaskFacility | null;
  contact: ITaskContact | null;
};

/* -------------------------------------------------------------------------- */
/* Mapping                                                                    */
/* -------------------------------------------------------------------------- */

export function mapTask(raw: RawTaskRecord): ITask {
  return {
    id: raw.id,
    facility_id: raw.facility_id,
    contact_id: raw.contact_id,
    created_by: raw.created_by,
    assigned_to: raw.assigned_to,
    title: raw.title,
    due_date: raw.due_date,
    priority: taskPrioritySchema.catch("medium").parse(raw.priority),
    status: taskStatusSchema.catch("open").parse(raw.status),
    notes: raw.notes,
    reminder_sent: raw.reminder_sent,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    assigned_to_profile: raw.assigned_to_profile ?? null,
    facility: raw.facility ?? null,
    contact: raw.contact ?? null,
  };
}

export function mapTasks(rows: RawTaskRecord[]): ITask[] {
  return rows.map(mapTask);
}

/* -------------------------------------------------------------------------- */
/* Grouping helper                                                            */
/* -------------------------------------------------------------------------- */

export type TaskGroup = "overdue" | "today" | "upcoming" | "done";

export function groupTasksByDue(tasks: ITask[]): Record<TaskGroup, ITask[]> {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const todayMs = now.getTime();

  const groups: Record<TaskGroup, ITask[]> = {
    overdue: [],
    today: [],
    upcoming: [],
    done: [],
  };

  for (const task of tasks) {
    if (task.status === "done") {
      groups.done.push(task);
      continue;
    }
    const due = new Date(task.due_date + "T00:00:00");
    due.setHours(0, 0, 0, 0);
    const dueMs = due.getTime();

    if (dueMs < todayMs) {
      groups.overdue.push(task);
    } else if (dueMs === todayMs) {
      groups.today.push(task);
    } else {
      groups.upcoming.push(task);
    }
  }

  return groups;
}
