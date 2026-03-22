import { PAYMENTS_FROM_EMAIL, resend } from "@/utils/resend";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body?.to;

    if (!to || typeof to !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'to' email address." },
        { status: 400 },
      );
    }

    const { data, error } = await resend.emails.send({
      from: PAYMENTS_FROM_EMAIL,
      to,
      subject: "Resend test email from hbmedicalportal",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>Test email successful</h2>
          <p>This email confirms your Resend setup is working.</p>
          <p><strong>Sender:</strong> ${PAYMENTS_FROM_EMAIL}</p>
          <p><strong>Recipient:</strong> ${to}</p>
        </div>
      `,
    });

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Test email sent successfully.",
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
