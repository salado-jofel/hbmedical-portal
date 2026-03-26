"use server";

import { STORAGE_SIGNED_URL_EXPIRES_IN } from "@/lib/constants/storage";
import {
  toStorageReference,
  parseStorageReference,
} from "@/lib/helpers/storage";
import {
  TrainingMaterialRow,
  TrainingMaterial,
} from "@/lib/interfaces/trainings";
import { createClient } from "@/utils/supabase/server";

const TRAINING_MATERIALS_SELECT = `
  id,
  title,
  description,
  tag,
  bucket,
  file_path,
  file_name,
  mime_type,
  sort_order,
  is_active,
  created_at,
  updated_at
`;

function mapTrainingMaterial(row: TrainingMaterialRow): TrainingMaterial {
  return {
    ...row,
    file_url: toStorageReference({
      bucket: row.bucket,
      file_path: row.file_path,
    }),
  };
}

export async function getTrainingMaterials(): Promise<TrainingMaterial[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("training_materials")
    .select(TRAINING_MATERIALS_SELECT)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch training materials:", error);
    return [];
  }

  return ((data ?? []) as TrainingMaterialRow[]).map(mapTrainingMaterial);
}

export async function getSignedDownloadUrl(
  storageRefOrUrl: string,
  downloadFileName?: string,
): Promise<string | null> {
  const parsed = parseStorageReference(storageRefOrUrl);

  if (!parsed) {
    return null;
  }

  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(
      parsed.filePath,
      STORAGE_SIGNED_URL_EXPIRES_IN,
      downloadFileName ? { download: downloadFileName } : undefined,
    );

  if (error) {
    console.error("Failed to create signed URL:", error);
    return null;
  }

  return data?.signedUrl ?? null;
}
