/**
 * Backwards-compat shim — Resend was retired on 2026-04-30 in favor of Paubox
 * (which actually offers a HIPAA BAA — Resend doesn't, see docs/BAA_TRACKER.md
 * row 4). Every existing email module imports `resend` and the two FROM-email
 * constants from this file; rather than rewriting 13 call sites, we just
 * re-export the Paubox client under the legacy name.
 *
 * To finish the migration: search-and-replace `from "@/lib/emails/resend"`
 * with `from "@/lib/emails/paubox"` across the codebase, rename the imported
 * `resend` to `paubox` at each site, then delete this file. Until then, this
 * shim keeps the imports working.
 */
export {
  paubox as resend,
  ACCOUNTS_FROM_EMAIL,
  PAYMENTS_FROM_EMAIL,
} from "./paubox";
