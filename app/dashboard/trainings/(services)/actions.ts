"use server";

import { TrainingMaterial } from "@/app/(interfaces)/trainings";
import { getSupabaseClient } from "@/utils/supabase/db";

const TRAINING_TABLE = "training_materials";

// URL format:
// https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
function parseStorageUrl(
  fileUrl: string,
): { bucket: string; filePath: string } | null {
  const marker = "/storage/v1/object/public/";
  const idx = fileUrl.indexOf(marker);

  if (idx === -1) return null;

  const after = fileUrl.slice(idx + marker.length);
  const slashIdx = after.indexOf("/");

  if (slashIdx === -1) return null;

  return {
    bucket: after.slice(0, slashIdx),
    filePath: decodeURIComponent(after.slice(slashIdx + 1)),
  };
}

export async function getTrainingMaterials(): Promise<TrainingMaterial[]> {
  try {
    const supabase = await getSupabaseClient();

    const { data, error } = await supabase
      .from(TRAINING_TABLE)
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("[getTrainingMaterials] error:", error.message);
      return [];
    }

    return data ?? [];
  } catch (err) {
    console.error("[getTrainingMaterials] Unexpected error:", err);
    return [];
  }
}

export async function getSignedDownloadUrl(fileUrl: string): Promise<string> {
  const parsed = parseStorageUrl(fileUrl);

  if (!parsed) {
    console.error("[getSignedDownloadUrl] Could not parse URL:", fileUrl);
    return fileUrl; // fallback to public URL
  }

  try {
    const supabase = await getSupabaseClient();

    const { data, error } = await supabase.storage
      .from(parsed.bucket)
      .createSignedUrl(parsed.filePath, 300);

    if (error || !data) {
      console.error("[getSignedDownloadUrl] Supabase error:", error?.message);
      return fileUrl; // fallback to public URL
    }

    return data.signedUrl;
  } catch (err) {
    console.error("[getSignedDownloadUrl] Unexpected error:", err);
    return fileUrl; // fallback to public URL
  }
}
