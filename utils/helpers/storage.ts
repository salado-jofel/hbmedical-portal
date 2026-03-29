import { StorageRecord, StorageReference } from "../interfaces/storage";

export function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

export function normalizeStoragePath(path: string): string {
  return trimSlashes(path);
}

export function buildStoragePath(folder: string, fileName: string): string {
  return `${trimSlashes(folder)}/${trimSlashes(fileName)}`;
}

export function buildStorageReference(
  bucket: string,
  filePath: string,
): string {
  return `${trimSlashes(bucket)}/${trimSlashes(filePath)}`;
}

export function toStorageReference(record: StorageRecord): string {
  return buildStorageReference(record.bucket, record.file_path);
}

export function isStoragePathInFolder(
  filePath: string,
  folder: string,
): boolean {
  return normalizeStoragePath(filePath).startsWith(`${trimSlashes(folder)}/`);
}

export function parseStorageReference(
  value: string | null | undefined,
): StorageReference | null {
  if (!value) return null;

  const raw = value.trim();
  if (!raw) return null;

  // Direct storage reference format:
  // "bucket/path/to/file.pdf"
  if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
    const firstSlash = raw.indexOf("/");

    if (firstSlash <= 0) return null;

    const bucket = raw.slice(0, firstSlash).trim();
    const filePath = raw.slice(firstSlash + 1).trim();

    if (!bucket || !filePath) return null;

    return {
      bucket,
      filePath: trimSlashes(filePath),
    };
  }

  // Legacy / signed / public Supabase storage URL formats:
  // /storage/v1/object/public/<bucket>/<path>
  // /storage/v1/object/sign/<bucket>/<path>
  // /storage/v1/object/authenticated/<bucket>/<path>
  try {
    const url = new URL(raw);
    const parts = url.pathname.split("/").filter(Boolean);
    const objectIndex = parts.indexOf("object");

    if (objectIndex === -1) return null;

    const bucket = parts[objectIndex + 2];
    const filePathParts = parts.slice(objectIndex + 3);

    if (!bucket || filePathParts.length === 0) return null;

    return {
      bucket,
      filePath: trimSlashes(filePathParts.join("/")),
    };
  } catch {
    return null;
  }
}
