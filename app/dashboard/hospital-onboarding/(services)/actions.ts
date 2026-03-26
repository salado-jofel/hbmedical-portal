"use server";

import { STORAGE_SIGNED_URL_EXPIRES_IN } from "@/lib/constants/storage";
import {
  toStorageReference,
  parseStorageReference,
} from "@/lib/helpers/storage";
import {
  HospitalOnboardingMaterialRow,
  HospitalOnboardingMaterial,
} from "@/lib/interfaces/hospital-onboarding";
import { createClient } from "@/utils/supabase/server";

const HOSPITAL_ONBOARDING_MATERIALS_SELECT = `
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

function mapHospitalOnboardingMaterial(
  row: HospitalOnboardingMaterialRow,
): HospitalOnboardingMaterial {
  return {
    ...row,
    file_url: toStorageReference({
      bucket: row.bucket,
      file_path: row.file_path,
    }),
  };
}

export async function getHospitalOnboardingMaterials(): Promise<
  HospitalOnboardingMaterial[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("hospital_onboarding_materials")
    .select(HOSPITAL_ONBOARDING_MATERIALS_SELECT)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch hospital onboarding materials:", error);
    return [];
  }

  return ((data ?? []) as HospitalOnboardingMaterialRow[]).map(
    mapHospitalOnboardingMaterial,
  );
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
