# After 02-reverse.sql — non-SQL steps

Prerequisites already in place: maintenance mode ON (`meridian-flags-prod` →
`maintenance: true`), client told in writing, client's Claude disconnected
from Supabase.

## 1. Delete the edge function

The reverse removes its cron trigger and secrets; the function itself lives
outside Postgres.

```
npx supabase functions delete crm-scheduler --project-ref ersdsmuybpfvgvaiwcgl
```

(Dashboard alternative: Edge Functions → crm-scheduler → Delete.)

## 2. Verify the history

```
npx supabase link --project-ref ersdsmuybpfvgvaiwcgl
npx supabase migration list -p "<prod db password>"
```

Expected: remote's last applied version is `20260626000000`; the 11 local
files from `20260702000000` to `20260919000000` show as local-only.

## 3. Apply the repo's migrations — plain push, no `--include-all`

```
npx supabase db push --dry-run -p "<prod db password>"   # lists exactly the 11
npx supabase db push -p "<prod db password>"
npx supabase migration list -p "<prod db password>"       # prod == dev now
```

Then relink the CLI to the dev branch so later commands don't hit prod:

```
npx supabase link --project-ref tdqilgjicvlpfvnvgzne
```

## 4. Security advisor

Supabase Dashboard → Advisors → Security on prod. The `crm_*` findings must be
gone; the remaining ones (`function_search_path_mutable`, SECURITY DEFINER
helpers callable by `authenticated`) pre-date the incident and are tracked
separately.

## 5. Promote the code

`main` already contains the fax/IVR release + maintenance mode. Vercel →
`hbmedical-portal` → Deployments → the current `main` build → make sure it is
the Production deployment (it is, if it was promoted while maintenance was on).

## 6. Verify behind the bypass

`https://meridianportal.io/maintenance?bypass=<MAINTENANCE_BYPASS_TOKEN>` then:

- open any existing order → no AI-status spinner, forms load
- IVR Forms page loads (empty is fine)
- Fax Intake page loads (admin)
- create one test order as a clinic user → extraction runs → PDFs generate
- Notifications bell opens without blank rows
- Tasks board shows only real tasks

## 7. Open the doors

`meridian-flags-prod` → `maintenance: false`.

## 8. Afterwards

- Add the pre-release check to the runbook: `supabase migration list` on prod
  must equal dev before any merge to `main`.
- Rebuild the CRM through the pipeline when scheduled; re-import from
  `export/`.
