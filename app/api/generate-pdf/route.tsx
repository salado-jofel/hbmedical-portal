/** @jsxImportSource react */
import { NextRequest, NextResponse } from "next/server";
import { generateOrderPdf, type OrderPdfFormType } from "@/lib/pdf/generate-order-pdfs";
import {
  requireOrderAccess,
  orderAccessErrorStatus,
  OrderAccessError,
} from "@/lib/supabase/order-access";
import { logPhiAccess } from "@/lib/audit/log-phi-access";

// Vercel Pro plan ceiling is 300s. Bumped from 30s — react-pdf can take
// 20-30s on a complex order_form with many items + the embedded signature
// image + HCPCS modifiers. 30s was too tight, especially when this route
// is called after-the-fact during the auto-regen flow on item changes.
export const maxDuration = 300;

const ALLOWED_FORM_TYPES: ReadonlySet<OrderPdfFormType> = new Set([
  "order_form",
  "ivr",
  "hcfa_1500",
  "delivery_invoice",
]);

/**
 * Regenerate a PDF for an order. Returns the storage path of the freshly
 * regenerated file (the file itself is in a private bucket and only readable
 * via signed URL).
 *
 * HIPAA: every order PDF contains PHI (patient name, DOB, ICD-10, products,
 * signatures). Authentication + per-order authorization are required before
 * triggering regeneration. The previous version of this route had neither.
 */
export async function POST(req: NextRequest) {
  // Parse body first so we have orderId for the access check.
  let body: { orderId?: unknown; formType?: unknown };
  try {
    body = (await req.json()) as { orderId?: unknown; formType?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const orderId = typeof body.orderId === "string" ? body.orderId : null;
  const formType = body.formType as OrderPdfFormType | undefined;
  if (!orderId) {
    return NextResponse.json(
      { error: "Missing orderId." },
      { status: 400 },
    );
  }
  if (!formType || !ALLOWED_FORM_TYPES.has(formType)) {
    return NextResponse.json(
      { error: "Invalid formType." },
      { status: 400 },
    );
  }

  // Authorization gate — verifies signed in + role + the user can access
  // this specific order. Throws OrderAccessError on denial.
  try {
    await requireOrderAccess(orderId);
  } catch (err) {
    if (err instanceof OrderAccessError) {
      return NextResponse.json(
        { error: err.message },
        { status: orderAccessErrorStatus(err) },
      );
    }
    console.error("[generate-pdf] access check failed:", err);
    return NextResponse.json({ error: "Access check failed." }, { status: 500 });
  }

  try {
    const result = await generateOrderPdf(orderId, formType);
    if (!result.success) {
      const status = result.error === "Order not found" ? 404 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }
    void logPhiAccess({
      action: "pdf.regenerate",
      resource: "order_documents",
      orderId,
      metadata: { formType, filePath: result.filePath },
    });
    return NextResponse.json({
      success: true,
      formType: result.formType,
      filePath: result.filePath,
      fileName: result.fileName,
    });
  } catch (err) {
    console.error("[generate-pdf] regen failed:", err);
    return NextResponse.json(
      { error: "PDF regeneration failed." },
      { status: 500 },
    );
  }
}
