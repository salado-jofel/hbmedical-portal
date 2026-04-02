import { resend, ACCOUNTS_FROM_EMAIL } from "@/lib/emails/resend";

const LOGO_URL =
  "https://eyrefohymvvabazvmemq.supabase.co/storage/v1/object/public/spearhead-assets/assets/email/hb-logo-name-2.png";

const PRIORITY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  high:   { bg: "#fef2f2", text: "#ef4444", label: "High" },
  medium: { bg: "#fff7ed", text: "#f97316", label: "Medium" },
  low:    { bg: "#f9fafb", text: "#6b7280", label: "Low" },
};

type SendTaskReminderEmailParams = {
  to: string;
  firstName: string;
  taskTitle: string;
  dueDate: string;        // ISO date string, e.g. "2026-04-04"
  priority: string;       // "high" | "medium" | "low"
  facilityName?: string | null;
  notes?: string | null;
  appUrl: string;         // base URL for the "View Task" CTA
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function buildHtml({
  firstName,
  taskTitle,
  dueDate,
  priority,
  facilityName,
  notes,
  appUrl,
}: Omit<SendTaskReminderEmailParams, "to">): string {
  const priorityStyle = PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.medium;
  const formattedDate = formatDate(dueDate);
  const tasksUrl = `${appUrl}/dashboard/tasks`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f9; margin: 0; padding: 0; }
    .wrapper { background-color: #f4f7f9; padding: 32px 16px; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
    .header { background-color: #ffffff; padding: 22px 28px 16px; text-align: center; border-bottom: 1px solid #f1f5f9; }
    .logo-img { display: block; margin: 0 auto; width: 176px; height: auto; border: 0; }
    .content { padding: 28px 32px 34px; line-height: 1.6; color: #334155; }
    .h1 { font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 12px; }
    p { margin: 0 0 14px; font-size: 14px; }
    .info-box { margin: 18px 0 22px; padding: 16px 18px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; }
    .info-row { margin: 5px 0; font-size: 14px; color: #475569; }
    .priority-badge { display: inline-block; padding: 2px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
    .notes-box { margin: 0 0 18px; padding: 12px 16px; background-color: #f8fafc; border-left: 3px solid #e2e8f0; border-radius: 0 8px 8px 0; font-size: 13px; color: #64748b; line-height: 1.5; white-space: pre-wrap; }
    .btn-row { text-align: center; margin: 24px 0 22px; }
    .btn { background-color: #15689E; color: #ffffff !important; padding: 13px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; }
    .muted { margin-top: 20px; font-size: 13px; color: #94a3b8; }
    .footer { background-color: #f8fafc; padding: 20px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #f1f5f9; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <img src="${LOGO_URL}" alt="HB Medical" width="176" class="logo-img" />
      </div>
      <div class="content">
        <h1 class="h1">Task due tomorrow</h1>
        <p>Hi ${escapeHtml(firstName)},</p>
        <p>This is a reminder that the following task is due <strong>tomorrow</strong>.</p>

        <div class="info-box">
          <div class="info-row"><strong>Task:</strong> ${escapeHtml(taskTitle)}</div>
          <div class="info-row"><strong>Due date:</strong> ${escapeHtml(formattedDate)}</div>
          <div class="info-row">
            <strong>Priority:</strong>&nbsp;
            <span
              class="priority-badge"
              style="background-color: ${priorityStyle.bg}; color: ${priorityStyle.text};"
            >${escapeHtml(priorityStyle.label)}</span>
          </div>
          ${facilityName ? `<div class="info-row"><strong>Account:</strong> ${escapeHtml(facilityName)}</div>` : ""}
        </div>

        ${notes ? `<p style="margin: 0 0 6px; font-size: 13px; color: #64748b; font-weight: 600;">Notes</p><div class="notes-box">${escapeHtml(notes)}</div>` : ""}

        <div class="btn-row">
          <a href="${tasksUrl}" class="btn" target="_blank" rel="noopener noreferrer">
            View Task &rarr;
          </a>
        </div>

        <p class="muted">
          You're receiving this because a task was assigned to you in HB Medical Portal.
        </p>
      </div>
      <div class="footer">&copy; 2026 HB Medical Portal. Secure &amp; Confidential.</div>
    </div>
  </div>
</body>
</html>`;
}

export async function sendTaskReminderEmail(
  params: SendTaskReminderEmailParams,
): Promise<void> {
  await resend.emails.send({
    from: ACCOUNTS_FROM_EMAIL,
    to: params.to,
    subject: `Reminder: "${params.taskTitle}" is due tomorrow`,
    html: buildHtml(params),
  });
}
