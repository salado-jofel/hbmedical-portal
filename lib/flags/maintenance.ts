import { createClient } from "@vercel/global-config";
import {
  MAINTENANCE_ENV,
  MAINTENANCE_FLAG_KEY,
  MAINTENANCE_MESSAGE_KEY,
} from "@/utils/constants/maintenance";

/**
 * Maintenance-mode switch.
 *
 * Source of truth is the Vercel Global Config store connected to the
 * project (`GLOBAL_CONFIG` env → `meridian-flags-prod`). Flipping the
 * `maintenance` item in the Vercel dashboard takes effect on the next
 * request — no redeploy. Reads are edge-cached and cost ~$3 per million.
 *
 * Fallback: when no store is connected (local dev, or the dev project,
 * which intentionally has none) the `UNDER_MAINTENANCE` env var decides.
 *
 * Fail-open by design: any error reading the store means "not in
 * maintenance". A flag-service hiccup must never lock every user out.
 */
export interface MaintenanceState {
  active: boolean;
  /** Optional operator-set line shown on the screen, e.g. "Back by 3 PM ET". */
  message: string | null;
  source: "global-config" | "env" | "off";
}

const client = process.env.GLOBAL_CONFIG
  ? createClient(process.env.GLOBAL_CONFIG)
  : null;

function envFallback(): MaintenanceState {
  const raw = (process.env[MAINTENANCE_ENV] ?? "").trim().toLowerCase();
  const active = raw === "true" || raw === "1";
  return { active, message: null, source: active ? "env" : "off" };
}

export async function getMaintenanceState(): Promise<MaintenanceState> {
  if (!client) return envFallback();
  try {
    const all = await client.getAll<Record<string, unknown>>([
      MAINTENANCE_FLAG_KEY,
      MAINTENANCE_MESSAGE_KEY,
    ]);
    const flag = all?.[MAINTENANCE_FLAG_KEY];
    const active = flag === true || flag === "true";
    const rawMsg = all?.[MAINTENANCE_MESSAGE_KEY];
    const message =
      typeof rawMsg === "string" && rawMsg.trim() ? rawMsg.trim() : null;
    return { active, message, source: "global-config" };
  } catch (err) {
    console.error("[maintenance] Global Config read failed — failing open", err);
    return envFallback();
  }
}
