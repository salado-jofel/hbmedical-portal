/**
 * MFA-related constants. Lives outside `"use server"` files so client
 * components can import these without tripping Next.js's rule that
 * server-action modules may only export async functions.
 */

/** Number of backup codes generated per user at enrollment / regenerate. */
export const BACKUP_CODE_COUNT = 10;

/** Length of each half of a backup code (XXXX-XXXX = 4 + 4 = 8 chars). */
export const BACKUP_CODE_HALF_LEN = 4;
