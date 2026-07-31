# Fax Intake — Documo Setup Guide

Meridian receives inbound faxes via a dedicated Documo number. Each fax
lands as an `intake_documents` row on `/dashboard/intake`, where admin
and support staff triage it into an IVR or a full order.

## 1. Documo account + BAA

- Sign up at https://www.documo.com/
- Request the **HIPAA BAA** before sending any fax through the account
  (Documo signs a BAA on their Business/Enterprise tiers). No PHI over
  the number until the BAA is countersigned.
- Buy one US number (~$0.05/page inbound + monthly rental).

## 2. Webhook configuration

In the Documo dashboard: **Settings → Webhooks → Inbound Fax Received**.

| Field                | Value                                                          |
|----------------------|----------------------------------------------------------------|
| URL                  | `https://meridianportal.io/api/intake/inbound-fax`             |
| Method               | `POST`                                                         |
| Signing              | HMAC-SHA256 (header `x-documo-signature`)                      |
| Signing secret       | Generate a strong secret, save it into Vercel env vars         |
| Payload format       | JSON                                                           |
| Retry policy         | Default (Documo retries 5xx / timeouts several times)          |

For local dev, expose the endpoint via `ngrok http 3000` and point the
Documo webhook at the ngrok URL. Signature verification will still work
because both sides use the same secret.

## 3. Environment variables (Vercel)

Add to Production + Preview + Development:

```
DOCUMO_WEBHOOK_SECRET=<the secret you configured in Documo>
# optional — defaults to hbmedical-bucket-private
SUPABASE_BUCKET=hbmedical-bucket-private
```

After adding, redeploy so the runtime picks up the new envs.

## 4. Storage bucket

No new bucket needed. Intake PDFs land at
`hbmedical-bucket-private/intake/<uuid>.pdf`. RLS on the bucket keeps
them non-public; the portal serves them via 15-minute signed URLs from
`getIntakeSignedUrl`.

## 5. RLS + who sees the inbox

- Table: `public.intake_documents`
- Policy: `admin_support_all_intake` — only `admin` and `support_staff`
  roles can SELECT / INSERT / UPDATE.
- Sidebar entry is gated to the same two roles.
- If per-facility fax numbers are added later, loosen the policy to
  include a facility-membership check on `to_number` → facility mapping.

## 6. Smoke test the pipeline

1. Sign a test PDF into Documo's test-fax utility (or send a real fax
   to the number from any physical fax).
2. Watch server logs — you should see one `POST /api/intake/inbound-fax`
   with a `200`.
3. Log in as admin/support, open `/dashboard/intake`, and confirm the
   row appears in the Pending tab.
4. Click the row → detail modal shows the PDF preview.
5. **Build IVR from this fax** → picks an approver, saves → IVR appears
   on `/dashboard/ivrs`, intake row flips to Done (Built as IVR).
6. Alternate path: **Build Order from this fax** → CreateOrderModal
   opens with the fax pre-attached as facesheet → order flow proceeds
   as normal → intake row flips to Done (Built as Order).

## 7. Idempotency

Documo retries 5xx responses. Every intake row has a unique
`(provider, external_id)` index; the second identical POST returns
`{ ok: true, duplicate: true }` without creating a duplicate row or
re-downloading the PDF. Safe to leave Documo's default retry policy on.

## 8. Rate limits / costs

- Documo inbound: ~$0.05/page. A typical IVR is 4-6 pages.
- Number rental: ~$5/month per US local, ~$15/month toll-free.
- No hard rate limit; a spike of ~200 faxes/hour would still deliver
  each within a few seconds.

## 9. Switching providers later

If Documo ever needs replacing, only two files change:

- `app/api/intake/inbound-fax/route.ts` — swap the HMAC scheme + the
  `parseDocumoPayload` helper for the new provider's shape.
- This doc — update env var names and dashboard steps.

The `intake_documents` table, RLS, Redux slice, page, detail modal,
and Build IVR/Build Order handoffs are all provider-agnostic.
