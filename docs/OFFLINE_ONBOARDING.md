# Manual / Offline Clinic Onboarding

Admins and sales reps can onboard a clinic whose provider signed the **Business
Associate Agreement** and **Product & Services Agreement** on paper. The
onboarding rules are unchanged — only the *evidence* for the documents step
differs (a scanned PDF instead of an inline e-signature).

## Who

| Actor | Can onboard manually? | Rep assignment |
| --- | --- | --- |
| admin | yes | picks the rep from a dropdown |
| sales_representative (incl. sub-reps) | yes, once office setup is complete | always themselves — `facilities.assigned_rep = auth.uid()`, the form value is ignored |
| everyone else | no | — |

Only **clinical providers** are onboarded this way. Clinic staff are still
invited by their provider from the Onboarding page.

## Flow

```
Onboarding page → "Onboard manually" → /dashboard/onboarding/manual
  1 Provider   name, email, mobile, credential, NPI (+ rep picker for admin)
  2 Practice   name, phone, address            → facilities (clinic)
  3 Enrollment same document as invite signup  → facility_enrollment
  4 Documents  BAA + P&S PDF scans, signer name/title/date as on paper
  5 Review     → manualOnboardProvider()
```

`manualOnboardProvider` (`app/(dashboard)/dashboard/onboarding/(services)/manual-onboarding-actions.ts`):

1. `requireOnboarder()` — admin or rep with completed setup.
2. Zod-validates the payload (`utils/validators/manual-onboarding.ts`).
3. Downloads both uploaded PDFs and checks the `%PDF-` header (rejects empty / non-PDF files) **before** any auth write.
4. `auth.admin.generateLink({ type: "invite" })` → auth user (no password) + action link to `/set-password`.
5. Inserts `profiles` (status `pending`, `has_completed_setup` true), `facilities` (clinic, `assigned_rep`), `facility_members` (provider, primary, can sign), `facility_enrollment`, `provider_credentials` (**`pin_hash` NULL**, `baa_signed_at` / `terms_signed_at` = dates on paper), two `provider_contract_signatures` rows (`signature_method = 'offline'`, `uploaded_by` = actor, `invite_token = 'offline-<batchId>'`), and a consumed `invite_tokens` row for the tokens list.
6. Emails (fire-and-forget): welcome + set-password link + PDF copies to the provider; the usual internal "signed contracts" notification with attachments (`SIGNED_CONTRACTS_NOTIFY_TO`).
7. Any failure after the auth user exists → `cleanupManualOnboarding` deletes the facility and the auth user (cascades the rest).

Uploads go straight from the browser to the private bucket via
`prepareOfflineContractUpload` (signed upload URL, PDF only, 25 MB), at
`provider-contracts-signed/offline-<batchId>/<contract_type>.pdf` — the same
prefix inline e-signatures use.

## Provider's first login

1. Email link → `/set-password` → sign in.
2. `/onboarding/phone` — SMS verification (existing MFA gate; the mobile number entered by the admin/rep is pre-filled).
3. **`/onboarding/pin`** — blocking step (new `evaluatePinGate`, `lib/supabase/pin-gate.ts`). Fires only while `provider_credentials.pin_hash` is NULL, i.e. only for offline-onboarded providers. Nobody at Meridian ever sees the password or PIN.
4. Dashboard. `profiles.status` flips to `active` on first sign-in as before.

## Where the documents show up

Resources → signed contracts: identical listing, with a **"Signed on paper ·
uploaded by <name>"** badge for `signature_method = 'offline'`. The contracts
gate (`CONTRACTS_GATE_ENABLED`) needs no change — it only checks that a row
exists per contract type.

## Migration

`supabase/migrations/20260922000000_offline_provider_onboarding.sql` —
extends the `signature_method` CHECK with `'offline'` and adds
`provider_contract_signatures.uploaded_by`.

## Test plan (dev)

Pre-req: migration applied on dev; `npm run dev` running; a sales rep with
completed office setup; two small PDF files.

| # | Step | Expect |
| --- | --- | --- |
| 1 | Sign in as **admin** → Onboarding | "Clinic signed on paper?" card with *Onboard manually* button |
| 2 | Sign in as **sales rep** (setup complete) → Onboarding | same card; rep with `has_completed_setup=false` sees no card and `/dashboard/onboarding/manual` redirects back |
| 3 | Sign in as **provider** → `/dashboard/onboarding/manual` | redirect to `/dashboard` |
| 4 | Admin wizard, step 1: Continue with empty form | inline errors on rep, first/last name, email, mobile, NPI |
| 5 | Fill step 1 with an **existing** provider email, complete all steps, Create | "An account with this email already exists." under Email, wizard jumps back to step 1 |
| 6 | Step 4: upload a `.txt` renamed `.pdf` | client accepts it, server rejects on Create: "The BAA file is not a valid PDF…" |
| 7 | Step 4: upload two real PDFs, leave signer date blank → Continue | "Signed date is required." |
| 8 | Full happy path as admin (new email) | success screen; row in `profiles` (pending), `facilities` (clinic, assigned_rep = chosen rep), `facility_members`, `facility_enrollment`, `provider_credentials` (pin_hash NULL), 2× `provider_contract_signatures` (offline, uploaded_by = admin), `invite_tokens` used; storage has both PDFs |
| 9 | Full happy path as **rep** | `facilities.assigned_rep` = the rep's own id regardless of payload |
| 10 | Provider inbox | "Your Meridian Portal account is ready" with two PDF attachments; internal recipients get "Signed contracts — …" |
| 11 | Provider: set password → sign in | `/onboarding/phone` (number pre-filled) → SMS → **`/onboarding/pin`** → after PIN, dashboard |
| 12 | Provider → Resources | both contracts listed with the *Signed on paper* badge; View opens the scan |
| 13 | Admin → Resources → Onboarding Signatures | same rows with Provider + Signed on paper badges and "uploaded by <admin>" |
| 14 | Provider signs an order | PIN verifies (proves the gate wrote `pin_hash` correctly) |

Dev DB checks (read-only MCP):

```sql
select p.email, p.status, pc.pin_hash is null as no_pin, f.assigned_rep
from profiles p
join provider_credentials pc on pc.user_id = p.id
join facilities f on f.user_id = p.id
where p.email = '<test email>';

select contract_type, signature_method, uploaded_by, signed_path, signed_at
from provider_contract_signatures
where invite_token like 'offline-%'
order by created_at desc;
```
