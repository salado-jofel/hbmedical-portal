"use server";

import { revalidatePath } from "next/cache";
import {
  STORAGE_BUCKETS,
  STORAGE_FOLDERS,
  STORAGE_SIGNED_URL_EXPIRES_IN,
} from "@/utils/constants/storage";
import {
  toStorageReference,
  parseStorageReference,
  buildStoragePath,
} from "@/utils/helpers/storage";
import {
  MarketingMaterialRow,
  MarketingMaterial,
} from "@/utils/interfaces/marketing";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrThrow, getUserRole } from "@/lib/supabase/auth";
import { isAdmin } from "@/utils/helpers/role";

const MARKETING_MATERIALS_SELECT = `
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

const MARKETING_PATH = "/dashboard/marketing";

function mapMarketingMaterial(row: MarketingMaterialRow): MarketingMaterial {
  return {
    ...row,
    file_url: toStorageReference({
      bucket: row.bucket,
      file_path: row.file_path,
    }),
  };
}

function sanitizePdfBaseName(fileName: string) {
  const withoutExt = fileName.replace(/\.pdf$/i, "").trim();
  const sanitized = withoutExt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return sanitized || "marketing-material";
}

export async function getMarketingMaterials(): Promise<MarketingMaterial[]> {
  const supabase = await createClient();
  const role = await getUserRole(supabase);

  let query = supabase
    .from("marketing_materials")
    .select(MARKETING_MATERIALS_SELECT)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (!isAdmin(role)) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch marketing materials:", error);
    return [];
  }

  return ((data ?? []) as MarketingMaterialRow[]).map(mapMarketingMaterial);
}

export async function getSignedDownloadUrl(
  storageRefOrUrl: string,
  downloadFileName?: string,
): Promise<string | null> {
  const parsed = parseStorageReference(storageRefOrUrl);
  if (!parsed) return null;

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

export async function prepareMarketingUpload(input: {
  fileName: string;
  contentType: string;
}) {
  const supabase = await createClient();
  await requireAdminOrThrow(supabase);

  const { fileName, contentType } = input;

  if (!fileName?.trim()) {
    throw new Error("File name is required.");
  }

  if (contentType !== "application/pdf") {
    throw new Error("Only PDF files are allowed.");
  }

  const bucket = STORAGE_BUCKETS.private;
  const safeBase = sanitizePdfBaseName(fileName);
  const finalFileName = `${Date.now()}-${crypto.randomUUID()}-${safeBase}.pdf`;
  const filePath = buildStoragePath(STORAGE_FOLDERS.marketing, finalFileName);

  const admin = createAdminClient();

  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUploadUrl(filePath);

  if (error || !data?.token) {
    console.error("[prepareMarketingUpload] Signed upload error:", error);
    throw new Error(error?.message || "Failed to prepare upload.");
  }

  return {
    bucket,
    filePath,
    token: data.token,
    fileName: finalFileName,
    mimeType: contentType,
  };
}

export async function completeMarketingUpload(input: {
  title: string;
  tag: string;
  sortOrder?: number;
  description?: string | null;
  bucket: string;
  filePath: string;
  fileName: string;
  mimeType: string;
}) {
  const supabase = await createClient();
  await requireAdminOrThrow(supabase);

  const title = input.title?.trim();
  const tag = input.tag?.trim();
  const description = input.description?.trim() || null;
  const sortOrder = Number.isFinite(input.sortOrder)
    ? Number(input.sortOrder)
    : 0;

  if (!title || !tag) {
    throw new Error("Title and tag are required.");
  }

  const admin = createAdminClient();

  const { error: insertError } = await admin
    .from("marketing_materials")
    .insert({
      title,
      description,
      tag,
      bucket: input.bucket,
      file_path: input.filePath,
      file_name: input.fileName,
      mime_type: input.mimeType,
      sort_order: sortOrder,
      is_active: true,
    });

  if (insertError) {
    await admin.storage.from(input.bucket).remove([input.filePath]);
    console.error("[completeMarketingUpload] DB insert error:", insertError);
    throw new Error(insertError.message || "Failed to save material record.");
  }

  revalidatePath(MARKETING_PATH);
}

export async function deleteMarketingMaterial(id: string): Promise<void> {
  const supabase = await createClient();
  await requireAdminOrThrow(supabase);

  const admin = createAdminClient();

  const { data, error: fetchError } = await admin
    .from("marketing_materials")
    .select("bucket, file_path")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !data) {
    throw new Error("Material not found.");
  }

  await admin.storage.from(data.bucket).remove([data.file_path]);

  const { error } = await admin
    .from("marketing_materials")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[deleteMarketingMaterial] Error:", error);
    throw new Error(error.message || "Failed to delete material.");
  }

  revalidatePath(MARKETING_PATH);
}

export async function bulkDeleteMarketingMaterials(
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;

  const supabase = await createClient();
  await requireAdminOrThrow(supabase);

  const admin = createAdminClient();

  const { data, error: fetchError } = await admin
    .from("marketing_materials")
    .select("bucket, file_path")
    .in("id", ids);

  if (fetchError) {
    throw new Error("Failed to fetch materials for deletion.");
  }

  if (data && data.length > 0) {
    const byBucket = data.reduce<Record<string, string[]>>((acc, row) => {
      acc[row.bucket] = acc[row.bucket] ?? [];
      acc[row.bucket].push(row.file_path);
      return acc;
    }, {});

    await Promise.all(
      Object.entries(byBucket).map(([bucket, paths]) =>
        admin.storage.from(bucket).remove(paths),
      ),
    );
  }

  const { error } = await admin
    .from("marketing_materials")
    .delete()
    .in("id", ids);

  if (error) {
    console.error("[bulkDeleteMarketingMaterials] Error:", error);
    throw new Error(error.message || "Failed to bulk delete materials.");
  }

  revalidatePath(MARKETING_PATH);
}
