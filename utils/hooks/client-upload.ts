"use client";

import { createClient } from "@/lib/supabase/client";
import { DirectUploadHooks } from "../interfaces/documents";

export async function uploadFileDirectToSupabase<TCompleteInput>(
  hooks: DirectUploadHooks<TCompleteInput>,
): Promise<void> {
  const { file, prepareUpload, buildCompleteInput, completeUpload } = hooks;

  const prepared = await prepareUpload();

  const supabase = createClient();

  const { error: uploadError } = await supabase.storage
    .from(prepared.bucket)
    .uploadToSignedUrl(prepared.filePath, prepared.token, file);

  if (uploadError) {
    console.error(
      "[uploadFileDirectToSupabase] Storage upload error:",
      uploadError,
    );
    throw new Error(uploadError.message || "Failed to upload file.");
  }

  await completeUpload(
    buildCompleteInput({
      bucket: prepared.bucket,
      filePath: prepared.filePath,
    }),
  );
}
