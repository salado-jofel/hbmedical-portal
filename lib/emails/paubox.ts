/**
 * Paubox Email API client. Replaces Resend (which doesn't currently offer a
 * HIPAA BAA — see docs/BAA_TRACKER.md row 4). Paubox BAA was signed on
 * 2026-04-30, so this is the live transactional-email path.
 *
 * Shape design: this module exports a `paubox` object whose `.emails.send()`
 * method MIRRORS the Resend SDK's signature. That way `lib/emails/resend.ts`
 * can simply re-export `paubox` as `resend`, and none of the 13 call sites
 * across the codebase need changes.
 *
 * Paubox REST API reference:
 *   POST https://api.paubox.net/v1/{API_USER}/messages
 *   Authorization: Token token={API_KEY}
 *   Body: { data: { message: { recipient, headers, content } } }
 *   200: { sourceTrackingId, data: "Service OK", customHeaders }
 */

const PAUBOX_API_KEY = process.env.PAUBOX_API_KEY;
const PAUBOX_USERNAME = process.env.PAUBOX_USERNAME;

if (!PAUBOX_API_KEY) {
  throw new Error("Missing PAUBOX_API_KEY environment variable.");
}
if (!PAUBOX_USERNAME) {
  throw new Error("Missing PAUBOX_USERNAME environment variable.");
}

const PAUBOX_API_URL = `https://api.paubox.net/v1/${PAUBOX_USERNAME}/messages`;

// FROM addresses — fallback values reference the new Meridian domain.
// In env where the new domain isn't yet verified at Paubox, override via
// PAYMENTS_FROM_EMAIL / ACCOUNTS_FROM_EMAIL env vars to keep using the
// old hbmedicalportal.com sender during the rebrand transition.
export const PAYMENTS_FROM_EMAIL =
  process.env.PAYMENTS_FROM_EMAIL || "payments@meridianportal.io";

export const ACCOUNTS_FROM_EMAIL =
  process.env.ACCOUNTS_FROM_EMAIL ||
  "Meridian Portal <accounts@meridianportal.io>";

/**
 * Default Reply-To. Outbound transactional mails are sent from accounts@
 * and payments@ which are virtual/no-reply. When a user hits Reply, we
 * route them to the real human-monitored support inbox at PrivateEmail.
 * The support inbox is intentionally non-PHI per docs — see the rebrand
 * plan in docs/. Callers can override per-send by passing `replyTo`.
 */
const DEFAULT_REPLY_TO =
  process.env.SUPPORT_REPLY_TO || "support@meridiansurgicalsupplies.com";

/**
 * Disclaimer auto-injected into every outbound email. The Reply-To inbox is
 * a non-PHI PrivateEmail mailbox used only for portal-access / login / bug
 * report inquiries — replying with patient or health information would land
 * PHI in a mailbox that is NOT covered by a HIPAA BAA. The notice tells the
 * recipient where to send PHI instead (in-portal Conversations tab).
 */
const REPLY_TO_NOTICE_HTML = `
<div style="margin:24px auto 8px;max-width:560px;padding:12px 16px;background:#fff8e1;border-left:3px solid #f5a255;border-radius:4px;font:13px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#5a4500;">
  <strong>Please do not reply to this email with patient or health information.</strong><br/>
  Replies route to <a href="mailto:support@meridiansurgicalsupplies.com" style="color:#5a4500;text-decoration:underline;">support@meridiansurgicalsupplies.com</a>, which is monitored by Meridian Portal support for account, login, and bug-report questions only — it is <strong>not</strong> a HIPAA-secure channel. For anything involving PHI, please use the <strong>Conversations</strong> tab inside the portal.
</div>
`.trim();

const REPLY_TO_NOTICE_TEXT = [
  "",
  "----------------------------------------",
  "Please do not reply to this email with patient or health information.",
  "Replies route to support@meridiansurgicalsupplies.com, which is monitored",
  "by Meridian Portal support for account, login, and bug-report questions",
  "only — it is NOT a HIPAA-secure channel. For anything involving PHI,",
  "please use the Conversations tab inside the portal.",
  "----------------------------------------",
].join("\n");

function injectReplyToNoticeHtml(html: string): string {
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${REPLY_TO_NOTICE_HTML}</body>`);
  }
  return html + REPLY_TO_NOTICE_HTML;
}

/**
 * Resend-compatible send-email signature. The codebase passes `from`, `to`,
 * `subject`, `html`, and (for two contracts-signed flows) `attachments` — so
 * we accept the same shape Resend uses. Add more fields here only when an
 * actual call site needs them.
 */
export interface SendEmailAttachment {
  filename: string;
  /** Resend hands us a Buffer; we accept either Buffer or a pre-encoded
   *  base64 string for flexibility. */
  content: Buffer | string;
  /** Optional MIME type. Auto-derived from filename if missing. */
  contentType?: string;
}

export interface SendEmailParams {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  /** Optional plain-text alternative. Improves spam scoring on some
   *  receivers; auto-derived from `html` if not provided. */
  text?: string;
  replyTo?: string;
  attachments?: SendEmailAttachment[];
}

/**
 * Resend-compatible result shape. Existing callers do `if (error)` and
 * `data?.id` — both keep working.
 */
export interface SendEmailResult {
  data: { id: string } | null;
  error: { message: string } | null;
}

/**
 * Strip HTML to a rough plain-text fallback. Not perfect — just enough that
 * receivers requiring text/plain see something readable. Removes tags,
 * collapses whitespace, decodes the most common entities.
 */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Best-effort content-type lookup from filename extension. Covers the file
 *  types this codebase actually attaches (PDFs); falls back to a generic
 *  octet-stream so Paubox still accepts the body. */
function inferContentType(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    txt: "text/plain",
    html: "text/html",
  };
  return map[ext] ?? "application/octet-stream";
}

async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const recipients = Array.isArray(params.to) ? params.to : [params.to];

  // Auto-inject the do-not-reply-with-PHI notice into both the HTML and
  // plain-text bodies of every outbound email. Single source of truth so we
  // can't accidentally ship a template that omits the disclaimer.
  const htmlWithNotice = injectReplyToNoticeHtml(params.html);
  const baseText = params.text ?? htmlToText(params.html);
  const text = `${baseText}\n${REPLY_TO_NOTICE_TEXT}`;

  const headers: Record<string, string> = {
    subject: params.subject,
    from: params.from,
  };
  const replyTo = params.replyTo ?? DEFAULT_REPLY_TO;
  if (replyTo) {
    headers["reply-to"] = replyTo;
  }

  // Map the Resend-shape attachment array onto Paubox's required shape:
  // { fileName, contentType, content (base64) }.
  const pauboxAttachments = (params.attachments ?? []).map((a) => {
    const content =
      typeof a.content === "string"
        ? a.content // assume already base64
        : a.content.toString("base64");
    return {
      fileName: a.filename,
      contentType: a.contentType ?? inferContentType(a.filename),
      content,
    };
  });

  const body = {
    data: {
      message: {
        // Paubox's REST API expects `recipients` (plural) — confirmed via
        // the API's own 400 response when sent under the wrong key.
        recipients,
        headers,
        content: {
          "text/plain": text,
          "text/html": htmlWithNotice,
        },
        ...(pauboxAttachments.length > 0
          ? { attachments: pauboxAttachments }
          : {}),
      },
    },
  };

  try {
    const res = await fetch(PAUBOX_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token token=${PAUBOX_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    const raw = await res.text();
    // Paubox uses two different error-body shapes depending on the failure
    // mode:  { errors: [{ title, details }] }  AND/OR  the older shape
    //   { errorCode, errorMessage, errorDescription }. Parse both so
    // diagnostics surface the real reason instead of a vague "HTTP 400".
    let parsed: {
      sourceTrackingId?: string;
      data?: string;
      errors?: Array<{ title?: string; details?: string }>;
      errorCode?: string | number;
      errorMessage?: string;
      errorDescription?: string;
    } = {};
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      // Non-JSON body — Paubox returned an HTML error page or plaintext.
      return {
        data: null,
        error: {
          message: `Paubox HTTP ${res.status}: ${raw.slice(0, 200) || "empty response"}`,
        },
      };
    }

    if (!res.ok) {
      const detail =
        parsed.errors?.[0]?.details ??
        parsed.errors?.[0]?.title ??
        parsed.errorDescription ??
        parsed.errorMessage ??
        (parsed.errorCode ? `errorCode ${parsed.errorCode}` : null) ??
        // Last-resort: if Paubox returned an unfamiliar shape, dump the
        // truncated raw body so we can diagnose without a redeploy.
        raw.slice(0, 300) ??
        `HTTP ${res.status}`;
      return {
        data: null,
        error: { message: `Paubox HTTP ${res.status}: ${detail}` },
      };
    }

    return {
      data: { id: parsed.sourceTrackingId ?? "unknown" },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: {
        message: err instanceof Error ? err.message : "Paubox request failed",
      },
    };
  }
}

/**
 * The drop-in `resend`-shaped client. Existing call sites do
 *   await resend.emails.send({ from, to, subject, html })
 * and that exact form continues to work — `paubox.emails.send(...)` here is
 * the Paubox-backed implementation.
 */
export const paubox = {
  emails: {
    send: sendEmail,
  },
};
