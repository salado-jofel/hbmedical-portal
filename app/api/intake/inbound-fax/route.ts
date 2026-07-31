import { NextResponse } from "next/server";
import { timingSafeEqual, randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Documo inbound-fax webhook.
 *
 * Documo POSTs one of these to us every time a fax completes on our
 * dedicated Meridian intake number. We:
 *   1. Verify HTTP Basic Auth on the `Authorization` header. Documo's
 *      webhook config only offers None / Basic Auth / OAuth 2.0 — no
 *      HMAC signing — so Basic Auth is the practical HTTPS-native
 *      defense against a public URL being sprayed with fake PDFs.
 *   2. Idempotency-check by fax_id — Documo retries on 5xx, so a naive
 *      insert would duplicate rows. Unique index in the DB gives us the
 *      hard guarantee; we surface a friendly 200 on the collision.
 *   3. Download the PDF from Documo's file URL and upload it to our
 *      HIPAA-scoped Supabase Storage bucket under intake/<id>.pdf. Bytes
 *      never touch a laptop or Vercel disk — server-to-server only.
 *   4. Insert an intake_documents row with status='pending' so the row
 *      shows up on the Intake Inbox for staff triage.
 *
 * Environment:
 *   DOCUMO_WEBHOOK_USERNAME  — Basic Auth username Documo sends.
 *   DOCUMO_WEBHOOK_PASSWORD  — matching password.
 *   SUPABASE_BUCKET          — Storage bucket; defaults to the HIPAA one.
 *
 * NOTE on the payload shape: Documo publishes the JSON schema at
 * https://developer.documo.com/reference/inbound-fax-webhook. If they
 * ever change field names, edit `parseDocumoPayload` below; nothing else
 * needs to move.
 */

const BUCKET = process.env.SUPABASE_BUCKET ?? "hbmedical-bucket-private";

interface DocumoFaxPayload {
  faxId: string;
  fromNumber: string | null;
  toNumber: string | null;
  pageCount: number | null;
  receivedAt: string | null;
  fileUrl: string;
  fileName: string | null;
  /** Documo's per-number webhook uses `fax.v1.inbound.complete` which
   *  fires for BOTH successful and failed receptions. This flag lets
   *  the handler skip the storage upload + intake row insert for
   *  failed transmissions (no PDF to store). */
  succeeded: boolean;
}

/**
 * Extract the fields we need from Documo's webhook body. Kept as a
 * separate function so if Documo changes their shape (or we swap
 * providers), only this one spot has to move. Documo's actual field
 * names may be snake_case in the wire format; we normalize here.
 */
function parseDocumoPayload(body: unknown): DocumoFaxPayload | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;

  // Accept both camelCase and snake_case forms — Documo docs use
  // camelCase but some historical webhook payloads have shown snake_case.
  const faxId = (b.faxId ?? b.fax_id ?? b.id) as string | undefined;
  if (!faxId) return null;

  // fileUrl may be absent on failed transmissions (`.complete` with
  // status=failed) — we still parse the payload so we can log the
  // failed reception, but skip the download step.
  const fileUrl =
    ((b.fileUrl ?? b.file_url ?? b.url) as string | undefined) ?? "";

  // Documo signals success in a `status` field on `.complete` events.
  // Known values: 'success' | 'succeed' | 'succeeded' (varies by tenant).
  const rawStatus = (b.status ?? b.state ?? b.result ?? "") as string;
  const succeeded =
    !!fileUrl &&
    (rawStatus === "" ||
      /^(success|succeed|succeeded|complete)/i.test(rawStatus));

  return {
    faxId,
    fromNumber:
      ((b.fromNumber ?? b.from_number ?? b.from) as string | null | undefined) ??
      null,
    toNumber:
      ((b.toNumber ?? b.to_number ?? b.to) as string | null | undefined) ?? null,
    pageCount:
      typeof b.pageCount === "number"
        ? (b.pageCount as number)
        : typeof b.page_count === "number"
          ? (b.page_count as number)
          : typeof b.pages === "number"
            ? (b.pages as number)
            : null,
    receivedAt:
      ((b.receivedAt ?? b.received_at ?? b.date) as string | null | undefined) ??
      null,
    fileUrl,
    fileName:
      ((b.fileName ?? b.file_name) as string | null | undefined) ?? null,
    succeeded,
  };
}

/** Constant-time Basic Auth compare so the caller can't time-attack the
 *  credentials. Both username and password are compared independently
 *  under timingSafeEqual — length-safe padding to avoid the trivial
 *  early-exit on length mismatch. */
function verifyBasicAuth(
  authHeader: string | null,
  expectedUser: string,
  expectedPass: string,
): boolean {
  if (!authHeader || !authHeader.startsWith("Basic ")) return false;
  const base64 = authHeader.slice(6).trim();
  let decoded: string;
  try {
    decoded = Buffer.from(base64, "base64").toString("utf-8");
  } catch {
    return false;
  }
  const idx = decoded.indexOf(":");
  if (idx < 0) return false;
  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);

  const eqLen = (a: string, b: string) => {
    // Pad both to the longer length so timingSafeEqual doesn't reveal
    // whether the difference was in length or content.
    const max = Math.max(Buffer.byteLength(a), Buffer.byteLength(b));
    const pa = Buffer.alloc(max);
    const pb = Buffer.alloc(max);
    pa.write(a);
    pb.write(b);
    const eq = timingSafeEqual(pa, pb);
    return eq && Buffer.byteLength(a) === Buffer.byteLength(b);
  };

  return eqLen(user, expectedUser) && eqLen(pass, expectedPass);
}

export async function POST(request: Request) {
  const expectedUser = process.env.DOCUMO_WEBHOOK_USERNAME;
  const expectedPass = process.env.DOCUMO_WEBHOOK_PASSWORD;
  if (!expectedUser || !expectedPass) {
    console.error(
      "[intake.inbound-fax] Missing DOCUMO_WEBHOOK_USERNAME/PASSWORD",
    );
    return new NextResponse("Server not configured.", { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (!verifyBasicAuth(authHeader, expectedUser, expectedPass)) {
    console.warn("[intake.inbound-fax] Basic auth failed", {
      hasHeader: !!authHeader,
    });
    return new NextResponse("Unauthorized.", { status: 401 });
  }

  const rawBody = await request.text();

  let payloadJson: unknown;
  try {
    payloadJson = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Invalid JSON.", { status: 400 });
  }
  const payload = parseDocumoPayload(payloadJson);
  if (!payload) {
    console.error("[intake.inbound-fax] Unrecognized payload shape");
    return new NextResponse("Unrecognized payload.", { status: 400 });
  }

  // `.complete` fires for failed transmissions too — no PDF to store.
  // ACK the event so Documo stops retrying, log it, and move on. We
  // don't create an intake row for failed receptions (the Documo
  // dashboard is the source of truth for failed-fax troubleshooting).
  if (!payload.succeeded) {
    console.info("[intake.inbound-fax] Skipping non-successful event", {
      faxId: payload.faxId,
      hasFileUrl: !!payload.fileUrl,
    });
    return NextResponse.json({ ok: true, skipped: "not_succeeded" });
  }

  const admin = createAdminClient();

  // Idempotency check — if we've already stored this fax, ACK the retry
  // without re-downloading / re-inserting.
  const { data: existing } = await admin
    .from("intake_documents")
    .select("id")
    .eq("provider", "documo")
    .eq("external_id", payload.faxId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true, id: existing.id });
  }

  // Fetch the PDF bytes from Documo's file URL. Do this here (server-side)
  // so the URL — which may include an auth token — never leaks to a
  // browser. Response should be application/pdf; if it isn't, log +
  // reject rather than store a suspect blob.
  const fileRes = await fetch(payload.fileUrl);
  if (!fileRes.ok) {
    console.error("[intake.inbound-fax] Failed to download fax file", {
      status: fileRes.status,
      faxId: payload.faxId,
    });
    return new NextResponse("Failed to download fax file.", { status: 502 });
  }
  const contentType = fileRes.headers.get("content-type") ?? "application/pdf";
  const bytes = new Uint8Array(await fileRes.arrayBuffer());

  // Deterministic storage path — one PDF per intake row, easy to sweep.
  const intakeId = randomUUID();
  const filePath = `intake/${intakeId}.pdf`;

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(filePath, bytes, { contentType, upsert: false });
  if (uploadErr) {
    console.error("[intake.inbound-fax] Storage upload failed", uploadErr);
    return new NextResponse("Storage upload failed.", { status: 500 });
  }

  const fileName =
    payload.fileName ??
    `fax-${payload.faxId}.pdf`;

  const { data: inserted, error: insertErr } = await admin
    .from("intake_documents")
    .insert({
      id: intakeId,
      source: "fax",
      provider: "documo",
      external_id: payload.faxId,
      from_number: payload.fromNumber,
      to_number: payload.toNumber,
      received_at: payload.receivedAt ?? new Date().toISOString(),
      page_count: payload.pageCount,
      bucket: BUCKET,
      file_path: filePath,
      file_name: fileName,
      mime_type: contentType,
      file_size: bytes.byteLength,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertErr) {
    // Cleanup the just-uploaded blob so we don't leak an orphan on
    // failed insert (usually a constraint violation from a stale
    // idempotency check race, or DB downtime).
    await admin.storage
      .from(BUCKET)
      .remove([filePath])
      .catch((e) => console.error("[intake.inbound-fax] cleanup", e));

    // 23505 = duplicate key. Treat as idempotent success — the parallel
    // request that beat us already stored the row.
    if ((insertErr as { code?: string }).code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    console.error("[intake.inbound-fax] Insert failed", insertErr);
    return new NextResponse("Insert failed.", { status: 500 });
  }

  return NextResponse.json({ ok: true, id: inserted?.id });
}
