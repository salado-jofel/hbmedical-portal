export const STORAGE_BUCKETS = {
  private: "hbmedical-bucket-private",
} as const;

export const STORAGE_FOLDERS = {
  marketing: "marketing",
  orders: "orders",
  invoices: "invoices",
  facilities: "facilities",
} as const;

export const STORAGE_SIGNED_URL_EXPIRES_IN = 60 * 5;

export const STORAGE_ALLOWED_MIME_TYPES = {
  marketing: ["application/pdf"] as const,
} as const;
