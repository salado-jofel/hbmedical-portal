"use client";

/**
 * Browser-side image compression for upload-bound files.
 *
 * Phone-camera photos run 4-12 MB at native resolution. Vercel's serverless
 * request body cap is 4.5 MB (hard infrastructure limit), so for ID photos /
 * passport scans we compress before the upload hits the wire. Even with our
 * direct-to-Supabase upload pipeline, smaller files = faster uploads on
 * mobile networks, especially in healthcare settings with spotty Wi-Fi.
 *
 * Strategy:
 *  - PDFs and non-image files pass through unchanged (can't compress
 *    losslessly client-side without external libraries).
 *  - Images load via createImageBitmap, draw to a canvas resized so the
 *    longest edge is ≤ DEFAULT_MAX_DIMENSION, then re-encode as JPEG at
 *    DEFAULT_QUALITY. ID/passport photos at 1600 px long edge are fully
 *    legible; quality 0.85 is the sweet spot before visible artifacts.
 *  - Returns the same File reference on error/no-op so callers don't need
 *    to special-case failure.
 */

const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_QUALITY = 0.85;
const COMPRESSIBLE_MIMES = new Set(["image/png", "image/jpeg", "image/jpg"]);

export interface CompressImageOptions {
  /** Longest side, in pixels. Default 1600. */
  maxDimension?: number;
  /** JPEG quality 0-1. Default 0.85. */
  quality?: number;
}

/**
 * Compress an image file. Returns the original File unchanged for non-images,
 * for already-small images (under 1 MB), or on any compression error — so
 * callers can always pass the result straight to the upload step.
 */
export async function compressImage(
  file: File,
  options: CompressImageOptions = {},
): Promise<File> {
  const { maxDimension = DEFAULT_MAX_DIMENSION, quality = DEFAULT_QUALITY } =
    options;

  // PDFs / unknown types: pass through.
  if (!COMPRESSIBLE_MIMES.has(file.type)) return file;

  // Already small enough that compression isn't worth the quality loss.
  if (file.size < 1024 * 1024) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > maxDimension ? maxDimension / longest : 1;
    const targetW = Math.round(bitmap.width * scale);
    const targetH = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality),
    );
    if (!blob) return file;

    // If compression somehow produced a larger file (rare — happens with
    // already-optimized JPEGs from professional cameras), keep the original.
    if (blob.size >= file.size) return file;

    // Replace extension with .jpg since we re-encoded as JPEG. Keep the
    // base name so users see something familiar in the upload toast.
    const baseName = file.name.replace(/\.[^.]+$/, "");
    const compressedName = `${baseName}.jpg`;
    return new File([blob], compressedName, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch (err) {
    console.error("[compressImage] failed; using original:", err);
    return file;
  }
}
