/** Shape common to all material types for content-based classification. */
export interface MaterialItem {
  title?: string | null;
  tag?: string | null;
  description?: string | null;
  file_name?: string | null;
  file_path?: string | null;
}

/** Lower-cases and trims a string value. */
export function normalizeMaterialText(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Builds a lower-cased, space-joined search string from common material fields.
 * Used by all getDisplayKind functions to classify materials by content.
 */
export function getMaterialSearchText(item: MaterialItem): string {
  return [item.title, item.tag, item.description, item.file_name, item.file_path]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * Applies acronym-case fixes to a raw material title (e.g. "Nda" → "NDA").
 * Each card file passes its own domain-specific replacement pairs.
 */
export function prettifyMaterialTitle(
  raw: string | null | undefined,
  replacements: Array<[pattern: RegExp, replacement: string]>,
): string {
  const title = (raw ?? "").trim();
  if (!title) return "";
  return replacements.reduce((t, [pattern, replacement]) => t.replace(pattern, replacement), title);
}
