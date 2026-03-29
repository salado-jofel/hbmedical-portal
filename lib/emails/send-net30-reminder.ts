import { resend, PAYMENTS_FROM_EMAIL } from "@/lib/emails/resend";

export type Net30ReminderStage =
  | "upcoming"
  | "tomorrow"
  | "due_today"
  | "overdue";

type SendNet30ReminderEmailParams = {
  to: string;
  orderId: string;
  orderNumber?: string | null;
  facilityName?: string | null;
  productName?: string | null;
  amountRemaining?: number | null; // cents
  currency?: string | null;
  dueDate?: string | null;
  hostedInvoiceUrl?: string | null;
  invoiceNumber?: string | null;
  reminderStage: Net30ReminderStage;
  overdueDays?: number | null;
};

function formatAmount(amount?: number | null, currency?: string | null) {
  if (amount == null || !currency) return null;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function formatDate(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getReminderContent(
  reminderStage: Net30ReminderStage,
  orderLabel: string,
  overdueDays?: number | null,
) {
  switch (reminderStage) {
    case "tomorrow":
      return {
        subjectPrefix: "Reminder: invoice due tomorrow",
        heading: "Payment due tomorrow",
        intro: `This is a friendly reminder that your Net 30 invoice for order #${orderLabel} is due tomorrow.`,
        buttonColor: "#15689E",
        statusLabel: "Due tomorrow",
      };

    case "due_today":
      return {
        subjectPrefix: "Reminder: invoice due today",
        heading: "Payment due today",
        intro: `Your Net 30 invoice for order #${orderLabel} is due today. Please submit payment as soon as possible.`,
        buttonColor: "#f5a255",
        statusLabel: "Due today",
      };

    case "overdue":
      return {
        subjectPrefix: "Invoice overdue",
        heading: "Invoice overdue",
        intro:
          overdueDays && overdueDays > 0
            ? `Your Net 30 invoice for order #${orderLabel} is now overdue by ${overdueDays} day${overdueDays === 1 ? "" : "s"}.`
            : `Your Net 30 invoice for order #${orderLabel} is now overdue.`,
        buttonColor: "#dc2626",
        statusLabel: "Overdue",
      };

    case "upcoming":
    default:
      return {
        subjectPrefix: "Reminder: upcoming invoice due date",
        heading: "Upcoming payment reminder",
        intro: `This is a reminder that your Net 30 invoice for order #${orderLabel} is coming due soon.`,
        buttonColor: "#15689E",
        statusLabel: "Payment reminder",
      };
  }
}

export async function sendNet30ReminderEmail({
  to,
  orderId,
  orderNumber,
  facilityName,
  productName,
  amountRemaining,
  currency,
  dueDate,
  hostedInvoiceUrl,
  invoiceNumber,
  reminderStage,
  overdueDays,
}: SendNet30ReminderEmailParams) {
  const displayOrder = escapeHtml(orderNumber || orderId);
  const displayFacility = facilityName ? escapeHtml(facilityName) : null;
  const displayProduct = productName ? escapeHtml(productName) : null;
  const displayInvoiceNumber = invoiceNumber ? escapeHtml(invoiceNumber) : null;

  const formattedAmount = formatAmount(amountRemaining, currency);
  const formattedDueDate = formatDate(dueDate);

  const content = getReminderContent(
    reminderStage,
    orderNumber || orderId,
    overdueDays,
  );

  const subject = `${content.subjectPrefix} for order #${orderNumber || orderId}`;

  const logoUrl =
    "https://eyrefohymvvabazvmemq.supabase.co/storage/v1/object/public/spearhead-assets/assets/email/hb-logo-name-2.png";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f4f7f9;
      margin: 0;
      padding: 0;
    }

    .wrapper {
      background-color: #f4f7f9;
      padding: 32px 16px;
    }

    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    }

    .header {
      background-color: #ffffff;
      padding: 22px 28px 16px;
      text-align: center;
      border-bottom: 1px solid #f1f5f9;
    }

    .logo-img {
      display: block;
      margin: 0 auto;
      width: 176px;
      max-width: 176px;
      height: auto;
      border: 0;
      outline: none;
      text-decoration: none;
    }

    .content {
      padding: 28px 32px 34px;
      line-height: 1.6;
      color: #334155;
    }

    .h1 {
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 12px;
    }

    p {
      margin: 0 0 14px;
      font-size: 14px;
    }

    .btn-container {
      text-align: center;
      margin: 24px 0 22px;
    }

    .btn {
      color: #ffffff !important;
      padding: 13px 28px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 15px;
      display: inline-block;
    }

    .info-box {
      margin: 18px 0 22px;
      padding: 16px 18px;
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
    }

    .info-row {
      margin: 5px 0;
      font-size: 14px;
      color: #475569;
    }

    .muted {
      margin-top: 20px;
      font-size: 13px;
      color: #94a3b8;
    }

    .footer {
      background-color: #f8fafc;
      padding: 20px 24px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid #f1f5f9;
    }

    @media only screen and (max-width: 640px) {
      .wrapper {
        padding: 16px 10px;
      }

      .header {
        padding: 18px 18px 12px;
      }

      .logo-img {
        width: 164px;
        max-width: 164px;
      }

      .content {
        padding: 24px 20px 28px;
      }

      .h1 {
        font-size: 20px;
      }

      .btn {
        width: auto;
        max-width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <img
          src="${logoUrl}"
          alt="HB Medical"
          width="176"
          class="logo-img"
        />
      </div>

      <div class="content">
        <h1 class="h1">${escapeHtml(content.heading)}</h1>

        <p>${escapeHtml(content.intro)}</p>

        <div class="info-box">
          <div class="info-row"><strong>Order:</strong> #${displayOrder}</div>
          ${
            displayInvoiceNumber
              ? `<div class="info-row"><strong>Invoice:</strong> ${displayInvoiceNumber}</div>`
              : ""
          }
          ${
            displayFacility
              ? `<div class="info-row"><strong>Facility:</strong> ${displayFacility}</div>`
              : ""
          }
          ${
            displayProduct
              ? `<div class="info-row"><strong>Product:</strong> ${displayProduct}</div>`
              : ""
          }
          ${
            formattedAmount
              ? `<div class="info-row"><strong>Amount remaining:</strong> ${escapeHtml(formattedAmount)}</div>`
              : ""
          }
          ${
            formattedDueDate
              ? `<div class="info-row"><strong>Due date:</strong> ${escapeHtml(formattedDueDate)}</div>`
              : ""
          }
          <div class="info-row"><strong>Status:</strong> ${escapeHtml(content.statusLabel)}</div>
        </div>

        ${
          hostedInvoiceUrl
            ? `
            <div class="btn-container">
              <a
                href="${hostedInvoiceUrl}"
                class="btn"
                style="background-color: ${content.buttonColor};"
                target="_blank"
                rel="noopener noreferrer"
              >
                Review & Pay Invoice
              </a>
            </div>
          `
            : ""
        }

        <p>
          If payment has already been submitted, you may disregard this reminder.
        </p>

        <p class="muted">
          Thank you for choosing HB Medical Portal.
        </p>
      </div>

      <div class="footer">
        &copy; 2026 HB Medical Portal. Secure & Confidential.
      </div>
    </div>
  </div>
</body>
</html>
  `;

  return resend.emails.send({
    from: PAYMENTS_FROM_EMAIL,
    to,
    subject,
    html,
  });
}
