import { StorageRecord } from "./storage";

export interface MarketingMaterialRow extends StorageRecord {
  id: string;
  title: string;
  description: string | null;
  tag: string;
  file_name: string;
  mime_type: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MarketingMaterial extends MarketingMaterialRow {
  /**
   * Storage reference, not a public URL.
   * Example:
   * "hbmedical-bucket-private/marketing/catalog.pdf"
   */
  file_url: string;
}
