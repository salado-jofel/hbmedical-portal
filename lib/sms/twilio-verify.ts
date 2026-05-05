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
 */

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID;

const BASE = "https://verify.twilio.com/v2";

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
    };

    if (!res.ok || !json.sid) {
      return {
        ok: false,
        error: json.message || `Twilio Verify error (${res.status})`,
        code: json.code,
      };
    }

    return { ok: true, status: "pending", sid: json.sid };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown Twilio error",
    };
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
    };

    if (!res.ok) {
      return {
        ok: false,
        error: json.message || `Twilio Verify error (${res.status})`,
        code: json.code,
      };
    }

    if (json.status === "approved") {
      return { ok: true, approved: true };
    }

    return {
      ok: true,
      approved: false,
      status: json.status ?? "unknown",
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown Twilio error",
    };
  }
}
