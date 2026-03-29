"use client";

import { uploadFileDirectToSupabase } from "@/utils/hooks/client-upload";
import { prepareContractUpload, completeContractUpload } from "./actions";

export async function uploadContractMaterial(
  formData: FormData,
): Promise<void> {
  const file = formData.get("file") as File | null;
  const title = (formData.get("title") as string | null)?.trim();
  const tag = (formData.get("tag") as string | null)?.trim();
  const sortOrderRaw = (formData.get("sort_order") as string | null) ?? "0";
  const sortOrder = Number.parseInt(sortOrderRaw, 10);

  if (!file || !title || !tag) {
    throw new Error("File, title, and tag are required.");
  }

  if (file.type !== "application/pdf") {
    throw new Error("Only PDF files are allowed.");
  }

  await uploadFileDirectToSupabase({
    file,
    prepareUpload: () =>
      prepareContractUpload({
        fileName: file.name,
        contentType: file.type,
      }),
    buildCompleteInput: ({ bucket, filePath }) => ({
      title,
      tag,
      bucket,
      filePath,
      fileName: file.name.trim(),
      mimeType: file.type,
      sortOrder: Number.isNaN(sortOrder) ? 0 : sortOrder,
    }),
    completeUpload: completeContractUpload,
  });
}
