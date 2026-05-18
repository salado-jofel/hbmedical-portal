-- =============================================================================
-- Grant SELECT on provider_credentials.medical_license_number to authenticated.
--
-- The 2026-04-29 RLS hardening migration revoked table-level SELECT on
-- public.provider_credentials and re-granted only specific columns to the
-- `authenticated` role. The intent was to strip `pin_hash` (bcrypt) from
-- facility-co-member reads. But the grant list also omitted
-- `medical_license_number` — almost certainly an oversight, not a security
-- decision. A license number is far less sensitive than pin_hash; it's
-- printed on every prescription the provider writes.
--
-- The omission meant every call site that does `select("*")` on the table
-- fails with 42501 (permission_denied) because Postgres requires SELECT
-- on every column the projection expands to. We patched the one known
-- caller (getMyCredentials) to use an explicit column list, but adding
-- medical_license_number back to the grant is the safer long-term fix.
-- pin_hash stays revoked — that part of the hardening was intentional.
-- =============================================================================

GRANT SELECT (medical_license_number) ON public.provider_credentials TO authenticated;
