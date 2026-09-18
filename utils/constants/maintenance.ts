/** Route that serves the maintenance screen. Always reachable. */
export const MAINTENANCE_PATH = "/maintenance";

/** Global Config item names (Vercel → Storage → meridian-flags-prod). */
export const MAINTENANCE_FLAG_KEY = "maintenance";
export const MAINTENANCE_MESSAGE_KEY = "maintenanceMessage";

/** Local / fallback switch when no Global Config store is connected. */
export const MAINTENANCE_ENV = "UNDER_MAINTENANCE";

/** httpOnly cookie that lets an operator through while users are blocked. */
export const MAINTENANCE_BYPASS_COOKIE = "mp_maintenance_bypass";
/** Query param on /maintenance that sets the bypass cookie. */
export const MAINTENANCE_BYPASS_PARAM = "bypass";
/** Env holding the secret compared against the query param. */
export const MAINTENANCE_BYPASS_TOKEN_ENV = "MAINTENANCE_BYPASS_TOKEN";
/** Bypass cookie lifetime — long enough for a maintenance window. */
export const MAINTENANCE_BYPASS_MAX_AGE_SECONDS = 12 * 60 * 60;
