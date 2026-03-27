"use server";

import { STORAGE_SIGNED_URL_EXPIRES_IN } from "@/utils/constants/storage";
import {
  toStorageReference,
  parseStorageReference,
} from "@/utils/helpers/storage";
import {
  ContractMaterialRow,
  ContractMaterial,
} from "@/utils/interfaces/contracts";
import { createClient } from "@/lib/supabase/server";

const CONTRACT_MATERIALS_SELECT = `
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

function mapContractMaterial(row: ContractMaterialRow): ContractMaterial {
  return {
    ...row,
    file_url: toStorageReference({
      bucket: row.bucket,
      file_path: row.file_path,
    }),
  };
}

export async function getContractMaterials(): Promise<ContractMaterial[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contract_materials")
    .select(CONTRACT_MATERIALS_SELECT)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch contract materials:", error);
    return [];
  }

  return ((data ?? []) as ContractMaterialRow[]).map(mapContractMaterial);
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
