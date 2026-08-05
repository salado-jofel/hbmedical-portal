/** @jsxImportSource react */
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserRole } from "@/lib/supabase/auth";
import { safeLogError } from "@/lib/logging/safe-log";
import { logPhiAccess } from "@/lib/audit/log-phi-access";
import { IVRFormPDF } from "@/app/(dashboard)/dashboard/orders/(pdf)/IVRFormPDF";

/**
 * GET /api/ivrs/[id]/pdf
 *
 * Renders the built IVR paper form as a PDF, uploads it to storage,
 * and 302-redirects the browser to a short-TTL signed URL — so the
 * "View" link on the IVR Details modal opens a real PDF in a new
 * tab, same UX as the fax file.
 *
 * We reuse the order-side IVRFormPDF component so a fax-built IVR
 * looks byte-identical to the same IVR viewed on an order. This
 * works because the standalone_ivrs migration mirrored order_ivr's
 * column names 1:1 — the PDF renderer reads snake_case columns off
 * the row it's given, so passing a standalone_ivrs row is a drop-in.
 * Signature columns (physician_signature*) are order-only and left
 * off standalone_ivrs; the PDF renders an empty signature area,
 * which is correct — save = approval for fax-built IVRs.
 */

const BUCKET = process.env.SUPABASE_BUCKET ?? "hbmedical-bucket-private";
const SIGNED_URL_TTL_SECONDS = 600;

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const supabase = await createClient();
    const role = await getUserRole(supabase);
    if (!role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // RLS-scoped read of the raw standalone_ivrs row so IVRFormPDF gets
    // snake_case columns matching what it expects off order_ivr. Access
    // denial (RLS returns null) becomes a 404 — no info leak.
    const { data: ivrRow, error: ivrErr } = await supabase
      .from("standalone_ivrs")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (ivrErr) {
      safeLogError("standaloneIvrPdf.fetch", ivrErr, { ivrId: id });
      return NextResponse.json(
        { error: "Failed to load IVR." },
        { status: 500 },
      );
    }
    if (!ivrRow) {
      return NextResponse.json(
        { error: "IVR not found or access denied." },
        { status: 404 },
      );
    }

    // Give the renderer a minimal "order" object — it only reads
    // wound_type off it to gate the chronic vs post-surgical layout.
    // Standalone IVRs never carry the post-surgical order flag, so
    // pin to 'chronic' — matches how fax-built IVRs behave once
    // converted to an order (see convertIvrToOrder / finalizeIvrConversion).
    const order = { wound_type: "chronic" as const };

    const buffer = await renderToBuffer(
      <IVRFormPDF
        order={order}
        ivr={ivrRow as Record<string, unknown>}
      />,
    );

    const filePath = `standalone-ivrs/${id}/built-ivr-form.pdf`;
    const adminClient = createAdminClient();

    const { error: uploadErr } = await adminClient.storage
      .from(BUCKET)
      .upload(filePath, buffer, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (uploadErr) {
      safeLogError("standaloneIvrPdf.upload", uploadErr, { ivrId: id });
      return NextResponse.json(
        { error: "Failed to store generated PDF." },
        { status: 500 },
      );
    }

    const { data: signed, error: signErr } = await adminClient.storage
      .from(BUCKET)
      .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS);
    if (signErr || !signed?.signedUrl) {
      safeLogError("standaloneIvrPdf.sign", signErr, { ivrId: id });
      return NextResponse.json(
        { error: "Failed to sign PDF URL." },
        { status: 500 },
      );
    }

    void logPhiAccess({
      action: "standalone_ivr.pdf.signed_url",
      resource: "standalone_ivrs",
      metadata: { ivrId: id, ttlSeconds: SIGNED_URL_TTL_SECONDS },
    });

    return NextResponse.redirect(signed.signedUrl, { status: 302 });
  } catch (err) {
    safeLogError("standaloneIvrPdf", err, { ivrId: id });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error." },
      { status: 500 },
    );
  }
}
