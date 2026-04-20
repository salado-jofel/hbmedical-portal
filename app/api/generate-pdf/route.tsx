/** @jsxImportSource react */
import { NextRequest, NextResponse } from "next/server";
import { generateOrderPdf, type OrderPdfFormType } from "@/lib/pdf/generate-order-pdfs";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { orderId, formType } = (await req.json()) as {
      orderId: string;
      formType: OrderPdfFormType;
    };

    const result = await generateOrderPdf(orderId, formType);

    if (!result.success) {
      const status = result.error === "Order not found" ? 404 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({
      success: true,
      formType: result.formType,
      filePath: result.filePath,
      fileName: result.fileName,
    });
  } catch (err) {
    console.error("[generate-pdf]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
