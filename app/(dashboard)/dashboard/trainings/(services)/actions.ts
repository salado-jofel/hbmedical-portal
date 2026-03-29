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
  TrainingMaterialRow,
  TrainingMaterial,
} from "@/utils/interfaces/trainings";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrThrow, getUserRole } from "@/lib/supabase/auth";

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

const TRAININGS_PATH = "/dashboard/trainings";

export type PrepareTrainingUploadInput = {
  fileName: string;
  contentType: string;
};

export type PrepareTrainingUploadResult = {
  bucket: string;
  filePath: string;
  token: string;
};

export type CompleteTrainingUploadInput = {
  title: string;
  tag: string;
  bucket: string;
  filePath: string;
  fileName: string;
  mimeType: string;
  sortOrder: number;
};

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
  const role = await getUserRole(supabase);

  let query = supabase
    .from("training_materials")
    .select(TRAINING_MATERIALS_SELECT)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (role !== "admin") {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

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

function sanitizePdfBaseName(fileName: string): string {
  const withoutExt = fileName.replace(/\.pdf$/i, "").trim();

  return (
    withoutExt
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "document"
  );
}

export async function prepareTrainingUpload(
  input: PrepareTrainingUploadInput,
): Promise<PrepareTrainingUploadResult> {
  const supabase = await createClient();
  await requireAdminOrThrow(supabase);

  const originalFileName = input.fileName?.trim();
  const contentType = input.contentType?.trim();

  if (!originalFileName || !contentType) {
    throw new Error("File metadata is required.");
  }

  const extension = originalFileName.split(".").pop()?.toLowerCase();
  if (contentType !== "application/pdf" || extension !== "pdf") {
    throw new Error("Only PDF files are allowed.");
  }

  const bucket = STORAGE_BUCKETS.private;
  const safeBaseName = sanitizePdfBaseName(originalFileName);
  const uniqueFileName = `${safeBaseName}-${crypto.randomUUID()}.pdf`;
  const filePath = buildStoragePath(STORAGE_FOLDERS.trainings, uniqueFileName);

  const admin = createAdminClient();

  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUploadUrl(filePath);

  if (error || !data?.token) {
    console.error("[prepareTrainingUpload] Signed upload error:", error);
    throw new Error(error?.message || "Failed to prepare upload.");
  }

  return {
    bucket,
    filePath,
    token: data.token,
  };
}

export async function completeTrainingUpload(
  input: CompleteTrainingUploadInput,
): Promise<void> {
  const supabase = await createClient();
  await requireAdminOrThrow(supabase);

  const title = input.title?.trim();
  const tag = input.tag?.trim();
  const bucket = input.bucket?.trim();
  const filePath = input.filePath?.trim();
  const fileName = input.fileName?.trim();
  const mimeType = input.mimeType?.trim();
  const sortOrder = Number.isFinite(input.sortOrder) ? input.sortOrder : 0;

  if (!title || !tag || !bucket || !filePath || !fileName || !mimeType) {
    throw new Error("Missing upload metadata.");
  }

  if (
    mimeType !== "application/pdf" ||
    !fileName.toLowerCase().endsWith(".pdf")
  ) {
    throw new Error("Only PDF files are allowed.");
  }

  const admin = createAdminClient();

  const { error: insertError } = await admin.from("training_materials").insert({
    title,
    tag,
    bucket,
    file_path: filePath,
    file_name: fileName,
    mime_type: mimeType,
    sort_order: sortOrder,
    is_active: true,
  });

  if (insertError) {
    await admin.storage.from(bucket).remove([filePath]);
    console.error("[completeTrainingUpload] DB insert error:", insertError);
    throw new Error(insertError.message || "Failed to save material record.");
  }

  revalidatePath(TRAININGS_PATH);
}

export async function deleteTrainingMaterial(id: string): Promise<void> {
  const supabase = await createClient();
  await requireAdminOrThrow(supabase);

  const admin = createAdminClient();

  const { data, error: fetchError } = await admin
    .from("training_materials")
    .select("bucket, file_path")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !data) {
    throw new Error("Material not found.");
  }

  await admin.storage.from(data.bucket).remove([data.file_path]);

  const { error } = await admin
    .from("training_materials")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[deleteTrainingMaterial] Error:", error);
    throw new Error(error.message || "Failed to delete material.");
  }

  revalidatePath(TRAININGS_PATH);
}

export async function bulkDeleteTrainingMaterials(
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;

  const supabase = await createClient();
  await requireAdminOrThrow(supabase);

  const admin = createAdminClient();

  const { data, error: fetchError } = await admin
    .from("training_materials")
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
    .from("training_materials")
    .delete()
    .in("id", ids);

  if (error) {
    console.error("[bulkDeleteTrainingMaterials] Error:", error);
    throw new Error(error.message || "Failed to bulk delete materials.");
  }

  revalidatePath(TRAININGS_PATH);
}
