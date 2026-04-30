import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTaskReminderEmail } from "@/lib/emails/send-task-reminder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Auth ──────────────────────────────────────────────────────────────────────

function isAuthorizedCronRequest(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  // Allow unauthenticated requests in dev when CRON_SECRET is not configured.
  if (!cronSecret) {
    return process.env.NODE_ENV !== "production";
  }
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;
  const [type, token] = authHeader.split(" ");
  return type === "Bearer" && token?.trim() === cronSecret;
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type TaskCandidate = {
  id: string;
  title: string;
  due_date: string;
  priority: string;
  notes: string | null;
  assigned_to: { first_name: string; last_name: string; email: string } | null;
  facility: { name: string } | null;
};

// ─── Main handler ──────────────────────────────────────────────────────────────

async function handleTaskReminderCron(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://meridianportal.io";

  const admin = createAdminClient();

  // Tomorrow's date in YYYY-MM-DD (UTC)
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowDate = tomorrow.toISOString().slice(0, 10);

  const { data, error } = await admin
    .from("tasks")
    .select(`
      id,
      title,
      due_date,
      priority,
      notes,
      assigned_to:profiles!tasks_assigned_to_fkey ( first_name, last_name, email ),
      facility:facilities!tasks_facility_id_fkey ( name )
    `)
    .eq("due_date", tomorrowDate)
    .eq("status", "open")
    .eq("reminder_sent", false);

  if (error) {
    console.error("[task-reminders] Failed to load tasks:", error.message);
    return NextResponse.json(
      { ok: false, error: "Failed to load tasks." },
      { status: 500 },
    );
  }

  const tasks = (data ?? []) as unknown as TaskCandidate[];

  let sent = 0;
  let failed = 0;

  const results = await Promise.allSettled(
    tasks.map(async (task) => {
      const assignee = Array.isArray(task.assigned_to)
        ? task.assigned_to[0]
        : task.assigned_to;

      if (!assignee?.email) {
        console.error(`[task-reminders] Task ${task.id} has no assignee email — skipping.`);
        throw new Error("missing_assignee_email");
      }

      const facilityRow = Array.isArray(task.facility)
        ? task.facility[0]
        : task.facility;

      await sendTaskReminderEmail({
        to: assignee.email,
        firstName: assignee.first_name,
        taskTitle: task.title,
        dueDate: task.due_date,
        priority: task.priority,
        facilityName: facilityRow?.name ?? null,
        notes: task.notes,
        appUrl,
      });

      const { error: updateError } = await admin
        .from("tasks")
        .update({ reminder_sent: true })
        .eq("id", task.id);

      if (updateError) {
        console.error(
          `[task-reminders] Failed to mark reminder_sent for task ${task.id}:`,
          updateError.message,
        );
        // Don't throw — email was already sent; best-effort flag update
      }
    }),
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      sent++;
    } else {
      failed++;
      console.error("[task-reminders] Task failed:", result.reason);
    }
  }

  return NextResponse.json({ ok: true, sent, failed });
}

export async function GET(request: Request) {
  return handleTaskReminderCron(request);
}

export async function POST(request: Request) {
  return handleTaskReminderCron(request);
}
