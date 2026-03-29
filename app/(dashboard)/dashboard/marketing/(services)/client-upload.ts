"use client";

import { createClient } from "@/lib/supabase/client";
import { prepareMarketingUpload, completeMarketingUpload } from "./actions";

export async function uploadMarketingMaterial(
  formData: FormData,
): Promise<void> {
  const file = formData.get("file");
  const title = (formData.get("title") as string | null)?.trim();
  const tag = (formData.get("tag") as string | null)?.trim();
  const description =
    (formData.get("description") as string | null)?.trim() || null;
  const sortOrderRaw = (formData.get("sort_order") as string | null) ?? "0";
  const sortOrder = parseInt(sortOrderRaw, 10);

  if (!(file instanceof File) || !title || !tag) {
    throw new Error("File, title, and tag are required.");
  }

  if (file.type !== "application/pdf") {
    throw new Error("Only PDF files are allowed.");
  }

  const prepared = await prepareMarketingUpload({
    fileName: file.name,
    contentType: file.type,
  });

  const supabase = createClient();

  const { error: uploadError } = await supabase.storage
    .from(prepared.bucket)
    .uploadToSignedUrl(prepared.filePath, prepared.token, file, {
      contentType: file.type,
    });

  if (uploadError) {
    console.error(
      "[uploadMarketingMaterial] Storage upload error:",
      uploadError,
    );
    throw new Error(uploadError.message || "Failed to upload file.");
  }

  try {
    await completeMarketingUpload({
      title,
      tag,
      description,
      sortOrder: Number.isNaN(sortOrder) ? 0 : sortOrder,
      bucket: prepared.bucket,
      filePath: prepared.filePath,
      fileName: prepared.fileName,
      mimeType: prepared.mimeType,
    });
  } catch (error) {
    await supabase.storage.from(prepared.bucket).remove([prepared.filePath]);
    throw error;
  }
}
