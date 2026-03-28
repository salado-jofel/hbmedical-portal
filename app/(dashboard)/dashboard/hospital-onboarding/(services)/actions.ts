"use server";

import { revalidatePath } from "next/cache";
import { STORAGE_BUCKETS, STORAGE_FOLDERS, STORAGE_SIGNED_URL_EXPIRES_IN } from "@/utils/constants/storage";
import { toStorageReference, parseStorageReference, buildStoragePath } from "@/utils/helpers/storage";
import { HospitalOnboardingMaterialRow, HospitalOnboardingMaterial } from "@/utils/interfaces/hospital-onboarding";
import { createClient } from "@/lib/supabase/server";
import { requireAdminOrThrow, getUserRole } from "@/lib/supabase/auth";

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

const HOSPITAL_ONBOARDING_PATH = "/dashboard/hospital-onboarding";

function mapHospitalOnboardingMaterial(row: HospitalOnboardingMaterialRow): HospitalOnboardingMaterial {
  return {
    ...row,
    file_url: toStorageReference({ bucket: row.bucket, file_path: row.file_path }),
  };
}

export async function getHospitalOnboardingMaterials(): Promise<HospitalOnboardingMaterial[]> {
  const supabase = await createClient();
  const role = await getUserRole(supabase);

  let query = supabase
    .from("hospital_onboarding_materials")
    .select(HOSPITAL_ONBOARDING_MATERIALS_SELECT)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (role !== "admin") {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch hospital onboarding materials:", error);
    return [];
  }

  return ((data ?? []) as HospitalOnboardingMaterialRow[]).map(mapHospitalOnboardingMaterial);
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

export async function uploadHospitalOnboardingMaterial(formData: FormData): Promise<void> {
  const supabase = await createClient();
  await requireAdminOrThrow(supabase);

  const file = formData.get("file") as File | null;
  const title = (formData.get("title") as string | null)?.trim();
  const tag = (formData.get("tag") as string | null)?.trim();
  const sortOrder = parseInt((formData.get("sort_order") as string | null) ?? "0", 10);

  if (!file || !title || !tag) {
    throw new Error("File, title, and tag are required.");
  }

  if (file.type !== "application/pdf") {
    throw new Error("Only PDF files are allowed.");
  }

  const fileName = file.name.trim();
  const filePath = buildStoragePath(STORAGE_FOLDERS.hospitalOnboarding, fileName);
  const bucket = STORAGE_BUCKETS.private;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("[uploadHospitalOnboardingMaterial] Storage upload error:", uploadError);
    throw new Error(uploadError.message || "Failed to upload file.");
  }

  const { error: insertError } = await supabase.from("hospital_onboarding_materials").insert({
    title,
    tag,
    bucket,
    file_path: filePath,
    file_name: fileName,
    mime_type: file.type,
    sort_order: isNaN(sortOrder) ? 0 : sortOrder,
    is_active: true,
  });

  if (insertError) {
    await supabase.storage.from(bucket).remove([filePath]);
    console.error("[uploadHospitalOnboardingMaterial] DB insert error:", insertError);
    throw new Error(insertError.message || "Failed to save material record.");
  }

  revalidatePath(HOSPITAL_ONBOARDING_PATH);
}

export async function deleteHospitalOnboardingMaterial(id: string): Promise<void> {
  const supabase = await createClient();
  await requireAdminOrThrow(supabase);

  const { data, error: fetchError } = await supabase
    .from("hospital_onboarding_materials")
    .select("bucket, file_path")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !data) {
    throw new Error("Material not found.");
  }

  await supabase.storage.from(data.bucket).remove([data.file_path]);

  const { error } = await supabase
    .from("hospital_onboarding_materials")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[deleteHospitalOnboardingMaterial] Error:", error);
    throw new Error(error.message || "Failed to delete material.");
  }

  revalidatePath(HOSPITAL_ONBOARDING_PATH);
}

export async function bulkDeleteHospitalOnboardingMaterials(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const supabase = await createClient();
  await requireAdminOrThrow(supabase);

  const { data, error: fetchError } = await supabase
    .from("hospital_onboarding_materials")
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
        supabase.storage.from(bucket).remove(paths),
      ),
    );
  }

  const { error } = await supabase
    .from("hospital_onboarding_materials")
    .delete()
    .in("id", ids);

  if (error) {
    console.error("[bulkDeleteHospitalOnboardingMaterials] Error:", error);
    throw new Error(error.message || "Failed to bulk delete materials.");
  }

  revalidatePath(HOSPITAL_ONBOARDING_PATH);
}
