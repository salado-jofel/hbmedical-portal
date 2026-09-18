# Fax Intake — Provider Setup Guide

Meridian receives inbound faxes via a dedicated fax number. Each fax
lands as an `intake_documents` row on `/dashboard/intake`, where admin
and support staff triage it into an IVR or a full order.

Two providers are supported side-by-side, switchable at deploy time
without touching code:

| `FAX_PROVIDER` env value | Handler                       | Auth scheme            |
|--------------------------|-------------------------------|------------------------|
| `documo` (default)       | `handleDocumoInbound`         | HMAC-SHA256 signature  |
| `ifax`                   | `handleIfaxInbound`           | HTTP Basic Auth        |

Set `FAX_PROVIDER=ifax` in Vercel env vars to route the webhook
endpoint through the iFax adapter. Leave it unset (or `=documo`) to
keep the legacy Documo behavior.

---

## Option A — iFax (current, $34.99/mo)

### 1. iFax account + BAA

- Sign up at https://www.ifaxapp.com/ (Business plan, 7-day free trial
  available).
- Request the **HIPAA BAA** from the iFax onboarding team — it's
  bundled free on Business/Enterprise. No PHI over the number until
  the BAA is countersigned.
- Assign a US local or toll-free fax number to the account.

### 2. API key

In the iFax dashboard: **Developers → API Keys → Generate**. Save the
key into Vercel env vars as `IFAX_API_KEY` (and `IFAX_API_KEY_DEV`
for local `.env.local` if you want a separate sandbox key).

### 3. Webhook configuration

In the iFax dashboard: **Developers → Webhooks → Add Webhook**.

| Field         | Value                                                          |
|---------------|----------------------------------------------------------------|
| URL           | `https://meridianportal.io/api/intake/inbound-fax`             |
| Event         | `Inbound Fax Events`                                           |
| Method        | `POST` (application/json — verified against a live fax 2026-09-16) |
| Auth          | **Basic Auth** — set username + password on the webhook form   |
| Status        | `ACTIVE`                                                       |

For local dev, expose the endpoint via `ngrok http 3000` and point the
iFax webhook at the ngrok URL. Basic Auth still works because both
sides use the same credentials.

### 4. Environment variables (Vercel)

Add to Production + Preview + Development:

```
FAX_PROVIDER=ifax
IFAX_WEBHOOK_BASIC_USERNAME=<username from iFax webhook form>
IFAX_WEBHOOK_BASIC_PASSWORD=<password from iFax webhook form>
IFAX_API_KEY=<key from Developers → API Keys>
# optional — defaults to hbmedical-bucket-private
SUPABASE_BUCKET=hbmedical-bucket-private
```

After adding, redeploy so the runtime picks up the new envs.

### 5. Webhook payload + download (verified 2026-09-16)

The webhook body is JSON with `jobId`, `transactionId`, `direction`,
`fromNumber`, `toNumber`, `faxReceivedPages`, `faxCallEnd` (epoch
seconds), `faxStatus`, `success`. There is no file in the webhook —
the adapter calls `POST /v1/customer/inbound/fax-download` with
`{ jobId, transactionId }` and `accessToken: IFAX_API_KEY`. The shared
client lives in `lib/fax/ifax.ts`.

Both IDs are persisted on the row (`external_id` = jobId,
`provider_transaction_id` = transactionId). Log lines to watch:

```
[intake.inbound-fax] iFax parsed { jobId, transactionId, ... }
[intake.inbound-fax] iFax: downloaded fax { jobId, bytes, contentType }
[ifax] download response had no usable data field { shape }   ← adapt lib/fax/ifax.ts
```

### 6. Recovering a 0-byte fax

Faxes received before 2026-09-16 (and any future provider hiccup) can
land with `file_size = 0`. The intake modal detects this, hides the
preview, and offers **Re-download from iFax** (admin/support). The
action (`refetchIntakeFile`) recovers a missing `transactionId` via
`POST /v1/customer/inbound/fax-list-all`, re-fetches the bytes, and
overwrites the same storage path so any IVR/order rows that already
reference it heal too.

---

## Option B — Documo (legacy, $200/mo)

### 1. Documo account + BAA

- Sign up at https://www.documo.com/
- Request the **HIPAA BAA** before sending any fax through the account
  (Documo signs a BAA on their Business/Enterprise tiers). No PHI over
  the number until the BAA is countersigned.
- Buy one US number (~$0.05/page inbound + monthly rental).

### 2. Webhook configuration

In the Documo dashboard: **Settings → Webhooks → Inbound Fax Received**.

| Field                | Value                                                          |
|----------------------|----------------------------------------------------------------|
| URL                  | `https://meridianportal.io/api/intake/inbound-fax`             |
| Method               | `POST`                                                         |
| Auth                 | **Basic Auth** — username + password on the webhook form       |
| Payload format       | JSON                                                           |
| Retry policy         | Default (Documo retries 5xx / timeouts several times)          |

For local dev, expose the endpoint via `ngrok http 3000` and point the
Documo webhook at the ngrok URL. Signature verification will still work
because both sides use the same secret.

### 3. Environment variables (Vercel)

Add to Production + Preview + Development:

```
FAX_PROVIDER=documo   # or omit — documo is the default
DOCUMO_WEBHOOK_USERNAME=<username from the Documo webhook form>
DOCUMO_WEBHOOK_PASSWORD=<matching password>
DOCUMO_API_KEY=<REST API key for downloading the fax PDF>
# optional — defaults to hbmedical-bucket-private
SUPABASE_BUCKET=hbmedical-bucket-private
```

---

## Shared: storage, RLS, and inbox

### Storage bucket

No new bucket needed. Intake PDFs land at
`hbmedical-bucket-private/intake/<uuid>.pdf` regardless of provider.
RLS on the bucket keeps them non-public; the portal serves them via
15-minute signed URLs from `getIntakeSignedUrl`.

### RLS + who sees the inbox

- Table: `public.intake_documents`
- Policy: `admin_support_all_intake` — only `admin` and `support_staff`
  roles can SELECT / INSERT / UPDATE.
- Sidebar entry is gated to the same two roles.
- If per-facility fax numbers are added later, loosen the policy to
  include a facility-membership check on `to_number` → facility mapping.

### Idempotency

Every intake row has a unique `(provider, external_id)` index. Both
handlers pre-check that pair before inserting, and the DB unique
constraint (Postgres 23505) is the hard guarantee — a duplicate POST
returns `{ ok: true, duplicate: true }` without creating a second row
or re-downloading the PDF. Safe to leave provider default retries on.

---

## Smoke-testing the pipeline

1. **Send a test fax.** Use faxzero.com (free, up to 3 pages) or any
   physical fax machine. Point it at the number provisioned in the
   active provider's dashboard.
2. **Watch server logs.** You should see one `POST /api/intake/inbound-fax`
   returning `200`. For iFax, look for the `[intake.inbound-fax] iFax
   parsed` line to confirm the exact field names.
3. **Confirm the intake row.** Log in as admin/support, open
   `/dashboard/intake`, and check the Pending tab.
4. **Preview the PDF.** Click the row → detail modal shows the PDF.
5. **Build IVR from this fax** → pick an approver, save → IVR appears
   on `/dashboard/ivrs`, intake row flips to Done (Built as IVR).
6. **Or Build Order** → CreateOrderModal opens with the fax pre-attached
   as facesheet → order flow proceeds as normal → intake row flips to
   Done (Built as Order).

## Switching providers

Because the two adapters live in the same route file, switching is a
one-line env change:

- To move from Documo → iFax: set `FAX_PROVIDER=ifax` and add the
  three `IFAX_*` env vars, then redeploy. Update the fax number
  advertised to clinics; the old Documo number can stay active in
  parallel until forwarding is finalized.
- To roll back: set `FAX_PROVIDER=documo` (or delete the env var) and
  redeploy. Documo env vars must still be present.

The `intake_documents` table, RLS, Redux slice, page, detail modal,
and Build IVR / Build Order handoffs are provider-agnostic.
