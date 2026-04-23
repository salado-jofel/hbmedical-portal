import { z } from "zod";

// Shape-only UUID validator (8-4-4-4-12 hex), without the RFC 9562 version/variant
// bits that zod's built-in .uuid() enforces. Postgres accepts any 8-4-4-4-12 hex
// string, including seeded fixture UUIDs like 22222222-2222-2222-2222-222222222222
// that fail strict v4 validation. Use this everywhere form input flows into the
// database as a uuid column.
export const UUID_SHAPE_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function uuidString(message = "Invalid ID.") {
  return z.string().regex(UUID_SHAPE_REGEX, message);
}
