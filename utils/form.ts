// utils/form.ts  ← CREATE THIS FILE

/**
 * Extracts a required string from FormData.
 * Throws if the field is missing, null, or empty after trimming.
 */
export function requireString(
  formData: FormData,
  key: string,
  maxLength = 255,
): string {
  const val = formData.get(key);
  if (typeof val !== "string" || val.trim() === "") {
    throw new Error(`Missing or empty required field: "${key}"`);
  }
  if (val.length > maxLength) {
    throw new Error(
      `Field "${key}" exceeds max length of ${maxLength} characters`,
    );
  }
  return val.trim();
}

/**
 * Extracts a required string from FormData and validates it
 * against a fixed set of allowed values.
 */
export function requireEnum<T extends string>(
  formData: FormData,
  key: string,
  allowed: readonly T[],
): T {
  const val = requireString(formData, key);
  if (!(allowed as readonly string[]).includes(val)) {
    throw new Error(
      `Invalid value for "${key}": "${val}". Allowed: ${allowed.join(", ")}`,
    );
  }
  return val as T;
}
