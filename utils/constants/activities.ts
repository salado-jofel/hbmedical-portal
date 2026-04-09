import type { ActivityType, ActivityOutcome, TypeFilter } from "../interfaces/activities";
import { MapPin, Phone, Mail, Video } from "lucide-react";
import type React from "react";

export const TYPE_ICONS: Record<ActivityType, React.ElementType> = {
  visit: MapPin,
  call:  Phone,
  email: Mail,
  demo:  Video,
};

export const TYPE_LABELS: Record<ActivityType, string> = {
  visit: "Visit",
  call:  "Call",
  email: "Email",
  demo:  "Demo",
};

export const TYPE_COLORS: Record<ActivityType, string> = {
  visit: "bg-emerald-50 text-emerald-700",
  call:  "bg-blue-50 text-[var(--navy)]",
  email: "bg-violet-50 text-violet-700",
  demo:  "bg-[#e8821a]/10 text-[#e8821a]",
};

export const OUTCOME_LABELS: Record<ActivityOutcome, string> = {
  positive:    "Positive",
  neutral:     "Neutral",
  negative:    "Negative",
  no_response: "No Response",
};

export const OUTCOME_DOTS: Record<ActivityOutcome, string> = {
  positive:    "bg-emerald-500",
  neutral:     "bg-zinc-400",
  negative:    "bg-red-500",
  no_response: "bg-yellow-400",
};

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

export const ACTIVITY_TYPE_FILTER_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all",   label: "All" },
  { value: "visit", label: "Visit" },
  { value: "call",  label: "Call" },
  { value: "email", label: "Email" },
  { value: "demo",  label: "Demo" },
];
