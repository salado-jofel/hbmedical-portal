export const ACTIVITIES_TABLE = "activities";
export const TASKS_TABLE = "tasks";

export const ACTIVITIES_PATH = "/dashboard/accounts";
export const TASKS_PATH = "/dashboard/tasks";

export const ACTIVITY_SELECT = `
  id,
  facility_id,
  contact_id,
  logged_by,
  type,
  activity_date,
  outcome,
  notes,
  created_at,
  updated_at,
  logged_by_profile:profiles!activities_logged_by_fkey (
    id,
    first_name,
    last_name
  ),
  contact:contacts!activities_contact_id_fkey (
    id,
    first_name,
    last_name
  )
`;

export const TASK_SELECT = `
  id,
  facility_id,
  contact_id,
  created_by,
  assigned_to,
  title,
  due_date,
  priority,
  status,
  notes,
  reminder_sent,
  created_at,
  updated_at,
  assigned_to_profile:profiles!tasks_assigned_to_fkey (
    id,
    first_name,
    last_name
  ),
  facility:facilities!tasks_facility_id_fkey (
    id,
    name
  ),
  contact:contacts!tasks_contact_id_fkey (
    id,
    first_name,
    last_name
  )
`;
