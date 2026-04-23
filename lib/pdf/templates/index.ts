import fs from "node:fs/promises";
import path from "node:path";

/**
 * Static contract template files live alongside the source code at
 * `lib/pdf/templates/*.pdf`. This helper resolves them relative to the
 * project root (which is `process.cwd()` on both local dev and the Vercel
 * runtime) and returns their bytes.
 *
 * Why local instead of Supabase Storage:
 *  - Templates are static — they only change when we explicitly regenerate
 *    them. Versioning them alongside code means every deploy is atomic with
 *    whatever stamper logic expects that shape.
 *  - Eliminates the Supabase CDN stale-cache dance every time we swap a
 *    template.
 *  - Removes the "upload to dev, upload to prod" step from the workflow.
 *
 * Per-user signed PDFs, uploaded scans, order docs, signatures, etc. still
 * live in Supabase Storage — those are dynamic and user-specific.
 */

/** Whitelist of template filenames — both enforces valid keys AND stops
 *  path traversal from a malicious API call. Add new entries here. */
export const CONTRACT_TEMPLATE_FILES = [
  "baa.pdf",
  "psa.pdf",
  "code-of-conduct.pdf",
  "conflict-of-interest.pdf",
  "hep-b-consent.pdf",
  "i9.pdf",
  "tb-risk-assessment.pdf",
  "w9.pdf",
] as const;

export type ContractTemplateFile = (typeof CONTRACT_TEMPLATE_FILES)[number];

export function isKnownContractTemplate(name: string): name is ContractTemplateFile {
  return (CONTRACT_TEMPLATE_FILES as readonly string[]).includes(name);
}

export function contractTemplatePath(filename: ContractTemplateFile): string {
  return path.join(process.cwd(), "lib", "pdf", "templates", filename);
}

export async function loadContractTemplate(
  filename: ContractTemplateFile,
): Promise<Uint8Array> {
  const buf = await fs.readFile(contractTemplatePath(filename));
  return new Uint8Array(buf);
}
