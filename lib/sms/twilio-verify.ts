/**
 * Twilio Verify API wrapper.
 *
 * We use Verify (not raw Programmable Messaging) because it manages code
 * generation, expiry, retry windows, and rate limits server-side at Twilio.
 * The `?` envelope below mirrors how we wrap Stripe / Supabase elsewhere:
 * never throw across module boundaries — surface errors as typed results
 * the caller can branch on without try/catch.
 *
 * Required env:
 *   TWILIO_ACCOUNT_SID         AC...
 *   TWILIO_AUTH_TOKEN          ...
 *   TWILIO_VERIFY_SERVICE_SID  VA...
 *
 * Logging:
 *   Every call logs with prefix `[twilio-verify]`. Phone numbers are masked
 *   to last 2 digits before they hit logs. Failures surface the Twilio
 *   numeric code + the canonical Verify error URL so an operator can grep
 *   the log line and jump straight to Twilio's docs.
 */

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID;

const BASE = "https://verify.twilio.com/v2";

/**
 * Operator-facing translations of common Twilio error codes encountered
 * on the Verify channel. These bubble up to inline error UI so an admin
 * (or the user themselves) gets actionable context, not raw SDK noise.
 *
 * Full code reference: https://www.twilio.com/docs/api/errors
 */
const FRIENDLY_TWILIO_ERRORS: Record<number, string> = {
  20003:
    "Twilio credentials are missing or invalid. Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in the environment.",
  21211: "The phone number on file isn't a valid E.164 number — re-enroll it.",
  21408:
    "Twilio doesn't have permission to send SMS to this region. Enable the country in Twilio Console → Messaging → Geo Permissions.",
  21608:
    "Twilio rejected this number. If this is a US trial account, the destination must be verified in the Twilio Console.",
  60200: "Twilio rejected the request format — check the phone number.",
  60203: "Max send attempts reached for this phone in the current window. Wait ~10 minutes.",
  60205:
    "SMS isn't supported for this phone number (e.g., a landline). Try a different number or use voice.",
  60212:
    "Too many concurrent verifications for this phone. Wait for the existing one to expire.",
  60410:
    "Twilio has temporarily blocked this destination as suspected fraud. Open a Twilio support ticket to unblock the number.",
};

function authHeader(): string {
  if (!ACCOUNT_SID || !AUTH_TOKEN) {
    throw new Error(
      "Twilio credentials missing: TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set.",
    );
  }
  // HTTP basic: base64("sid:token")
  const creds = Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString("base64");
  return `Basic ${creds}`;
}

function serviceUrl(suffix: string): string {
  if (!SERVICE_SID) {
    throw new Error(
      "Twilio Verify service SID missing: TWILIO_VERIFY_SERVICE_SID must be set.",
    );
  }
  return `${BASE}/Services/${SERVICE_SID}${suffix}`;
}

/** Mask all but the last 2 digits so logs don't leak full phone numbers. */
function maskForLog(phoneE164: string): string {
  if (phoneE164.length <= 4) return "+******";
  const cc = phoneE164.slice(0, 3); // "+63"
  const tail = phoneE164.slice(-2);
  return `${cc}******${tail}`;
}

function friendlyError(code: number | undefined, fallback: string): string {
  if (typeof code === "number" && FRIENDLY_TWILIO_ERRORS[code]) {
    return FRIENDLY_TWILIO_ERRORS[code];
  }
  return fallback;
}

export type SendCodeResult =
  | { ok: true; status: "pending"; sid: string }
  | { ok: false; error: string; code?: number };

/**
 * Trigger Twilio to send a verification code via SMS to the given E.164 phone.
 * Returns immediately after Twilio accepts the request — it does not wait for
 * the SMS to be delivered.
 */
export async function sendVerificationCode(
  phoneE164: string,
): Promise<SendCodeResult> {
  const masked = maskForLog(phoneE164);
  try {
    const body = new URLSearchParams({
      To: phoneE164,
      Channel: "sms",
    });

    const res = await fetch(serviceUrl("/Verifications"), {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const json = (await res.json()) as {
      sid?: string;
      status?: string;
      message?: string;
      code?: number;
      more_info?: string;
      details?: unknown;
    };

    if (!res.ok || !json.sid) {
      console.error("[twilio-verify] sendVerificationCode FAIL", {
        to: masked,
        http: res.status,
        twilioCode: json.code,
        twilioMessage: json.message,
        moreInfo: json.more_info,
        details: json.details,
      });
      return {
        ok: false,
        error: friendlyError(
          json.code,
          json.message || `Twilio Verify error (${res.status})`,
        ),
        code: json.code,
      };
    }

    console.info("[twilio-verify] sendVerificationCode OK", {
      to: masked,
      sid: json.sid,
    });
    return { ok: true, status: "pending", sid: json.sid };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Twilio error";
    console.error("[twilio-verify] sendVerificationCode THREW", {
      to: masked,
      message,
    });
    return { ok: false, error: message };
  }
}

export type CheckCodeResult =
  | { ok: true; approved: true }
  | { ok: true; approved: false; status: string }
  | { ok: false; error: string; code?: number };

/**
 * Submit a code the user typed in for verification against the pending
 * Twilio Verification for that phone. Returns approved=true only when
 * Twilio's status is "approved".
 */
export async function checkVerificationCode(
  phoneE164: string,
  code: string,
): Promise<CheckCodeResult> {
  const masked = maskForLog(phoneE164);
  try {
    const body = new URLSearchParams({
      To: phoneE164,
      Code: code,
    });

    const res = await fetch(serviceUrl("/VerificationCheck"), {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const json = (await res.json()) as {
      status?: string;
      valid?: boolean;
      message?: string;
      code?: number;
      more_info?: string;
      details?: unknown;
    };

    if (!res.ok) {
      console.error("[twilio-verify] checkVerificationCode FAIL", {
        to: masked,
        http: res.status,
        twilioCode: json.code,
        twilioMessage: json.message,
        moreInfo: json.more_info,
        details: json.details,
      });
      return {
        ok: false,
        error: friendlyError(
          json.code,
          json.message || `Twilio Verify error (${res.status})`,
        ),
        code: json.code,
      };
    }

    if (json.status === "approved") {
      console.info("[twilio-verify] checkVerificationCode APPROVED", {
        to: masked,
      });
      return { ok: true, approved: true };
    }

    console.info("[twilio-verify] checkVerificationCode REJECTED", {
      to: masked,
      status: json.status,
    });
    return {
      ok: true,
      approved: false,
      status: json.status ?? "unknown",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Twilio error";
    console.error("[twilio-verify] checkVerificationCode THREW", {
      to: masked,
      message,
    });
    return { ok: false, error: message };
  }
}
