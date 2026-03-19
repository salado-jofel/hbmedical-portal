"use server";

import { getSupabaseClient } from "@/utils/supabase/db";
import type { MarketingMaterial } from "@/app/(interfaces)/marketing";

// ── Parse bucket + file path from any Supabase public storage URL ─────────────
// URL format: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
function parseStorageUrl(
  fileUrl: string,
): { bucket: string; filePath: string } | null {
  const marker = "/storage/v1/object/public/";
  const idx = fileUrl.indexOf(marker);
  if (idx === -1) return null;

  const after = fileUrl.slice(idx + marker.length); // "<bucket>/<path>"
  const slashIdx = after.indexOf("/");
  if (slashIdx === -1) return null;

  return {
    bucket: after.slice(0, slashIdx),
    filePath: after.slice(slashIdx + 1),
  };
}

// ── Fetch all marketing materials ─────────────────────────────────────────────
export async function getMarketingMaterials(): Promise<MarketingMaterial[]> {
  try {
    const supabase = await getSupabaseClient();

    const { data, error } = await supabase
      .from("marketing_materials")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("[getMarketingMaterials] Supabase error:", error.message);
      return [];
    }

    return data ?? [];
  } catch (err) {
    console.error("[getMarketingMaterials] Unexpected error:", err);
    return [];
  }
}

// ── Get signed download URL (5 min expiry) ────────────────────────────────────
export async function getSignedDownloadUrl(fileUrl: string): Promise<string> {
  const parsed = parseStorageUrl(fileUrl);

  if (!parsed) {
    console.error("[getSignedDownloadUrl] Could not parse URL:", fileUrl);
    return fileUrl; // fallback — use public URL as-is
  }

  try {
    const supabase = await getSupabaseClient();

    const { data, error } = await supabase.storage
      .from(parsed.bucket)
      .createSignedUrl(parsed.filePath, 300); // valid for 5 minutes

    if (error || !data) {
      console.error("[getSignedDownloadUrl] error:", error?.message);
      return fileUrl; // fallback — use public URL as-is
    }

    return data.signedUrl;
  } catch (err) {
    console.error("[getSignedDownloadUrl] Unexpected error:", err);
    return fileUrl; // fallback — use public URL as-is
  }
}
