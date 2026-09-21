# Incident: unreviewed CRM applied directly to production (2026-09-17)

Six migrations (`20260917122004` … `20260917122739`, all `crm_*`) were applied
straight to the production Supabase project `ersdsmuybpfvgvaiwcgl` on
2026-09-17 12:20–12:27 UTC, outside the repo / dev / main pipeline. They exist
in no git branch and were never applied to the dev branch
(`tdqilgjicvlpfvnvgzne`).

Consequences:
- Production's newest migration version became `20260917…`, so the repo's
  pending IVR / fax-intake migrations (`20260702…` – `20260919…`) could no
  longer be applied by the GitHub integration (Supabase refuses out-of-order
  versions). The 2026-09-19 merge of `dev` → `main` therefore deployed code
  against a database missing 11 migrations. Maintenance mode was enabled.
- Triggers were attached to `orders`, `facilities`, `invite_tokens`,
  `activities`, `tasks`; columns/constraints were added to `tasks`,
  `notifications`, `contacts`, `activities`; a `pg_cron` job + `crm-scheduler`
  edge function + two Vault secrets were created; 22 functions, 2 views,
  6 tables (with seed data) were added.

Decision (2026-09-21): remove the CRM entirely, restore production to the last
shared version `20260626000000 allow_uploaded_ivr_document_type`, then apply
the repo's 11 migrations with a plain `supabase db push`. The CRM will be
rebuilt later through the normal pipeline with the client's data re-imported.

Files:
- `original-migrations/` — the six migrations exactly as stored by Supabase
  (copied from Dashboard → Database → Migrations → View migration SQL).
- `00-inspect.sql` — read-only queries to run BEFORE the reverse (what data
  exists, what would be deleted).
- `01-export.sql` — copies the client's CRM data out as JSON (keep the output).
- `02-reverse.sql` — the one-transaction reverse migration.
- `03-after.md` — the non-SQL steps (edge function, migration history repair,
  db push, verification).
