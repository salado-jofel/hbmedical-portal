"use server";

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export type SendNet30InvoiceEmailParams = {
  to: string;
  orderId: string;
  invoiceNumber: string | null;
  dueDate: string | null;
  hostedInvoiceUrl: string;
  amountDue: number;
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export async function sendNet30InvoiceEmail({
  to,
  orderId,
  invoiceNumber,
  dueDate,
  hostedInvoiceUrl,
  amountDue,
}: SendNet30InvoiceEmailParams) {
  const portalUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";

  const subject = invoiceNumber
    ? `Invoice ${invoiceNumber} for Order #${orderId}`
    : `Net 30 Invoice for Order #${orderId}`;

  const amountText = formatCurrency(amountDue);
  const dueDateText = dueDate ?? "30 days from invoice date";
  const invoiceNumberText = invoiceNumber ?? "Pending";

  return await resend.emails.send({
    from: "HB Medical Portal <payments@hbmedicalportal.com>",
    to,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; background:#f8fafc; padding:32px; color:#0f172a;">
        <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; overflow:hidden;">
          
          <div style="background:#15689E; padding:24px 32px;">
            <h1 style="margin:0; font-size:24px; color:#ffffff;">HB Medical Portal</h1>
            <p style="margin:8px 0 0; color:#dbeafe; font-size:14px;">
              Your Net 30 invoice is ready
            </p>
          </div>

          <div style="padding:32px;">
            <p style="margin:0 0 16px; font-size:16px; line-height:1.6;">
              Hello,
            </p>

            <p style="margin:0 0 16px; font-size:16px; line-height:1.6;">
              A Net 30 invoice has been created for your order.
            </p>

            <div style="margin:24px 0; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:20px;">
              <table style="width:100%; border-collapse:collapse;">
                <tr>
                  <td style="padding:8px 0; font-size:14px; color:#475569;">Order ID</td>
                  <td style="padding:8px 0; font-size:14px; color:#0f172a; text-align:right; font-weight:600;">
                    ${orderId}
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0; font-size:14px; color:#475569;">Invoice Number</td>
                  <td style="padding:8px 0; font-size:14px; color:#0f172a; text-align:right; font-weight:600;">
                    ${invoiceNumberText}
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0; font-size:14px; color:#475569;">Amount Due</td>
                  <td style="padding:8px 0; font-size:14px; color:#0f172a; text-align:right; font-weight:700;">
                    ${amountText}
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0; font-size:14px; color:#475569;">Due Date</td>
                  <td style="padding:8px 0; font-size:14px; color:#0f172a; text-align:right; font-weight:600;">
                    ${dueDateText}
                  </td>
                </tr>
              </table>
            </div>

            <div style="margin:32px 0; text-align:center;">
              <a
                href="${hostedInvoiceUrl}"
                style="display:inline-block; background:#15689E; color:#ffffff; text-decoration:none; padding:14px 24px; border-radius:10px; font-weight:600; font-size:15px;"
              >
                View & Pay Invoice
              </a>
            </div>

            <p style="margin:0 0 12px; font-size:14px; line-height:1.7; color:#475569;">
              Payment terms for this invoice are Net 30. Please complete payment by the due date to avoid overdue balance status.
            </p>

            <p style="margin:0 0 12px; font-size:14px; line-height:1.7; color:#475569;">
              You may also review your order in the portal:
            </p>

            <p style="margin:0 0 24px;">
              <a
                href="${portalUrl}/dashboard/orders"
                style="color:#15689E; text-decoration:none; font-weight:600;"
              >
                Open HB Medical Portal
              </a>
            </p>

            <hr style="border:none; border-top:1px solid #e2e8f0; margin:24px 0;" />

            <p style="margin:0; font-size:12px; line-height:1.6; color:#94a3b8;">
              If you have any questions regarding this invoice, please contact HB Medical Portal support.
            </p>
          </div>
        </div>
      </div>
    `,
  });
}
