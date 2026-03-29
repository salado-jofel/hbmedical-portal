export interface ContractMaterialRow {
  id: string;
  title: string;
  description: string | null;
  tag: string;
  bucket: string;
  file_path: string;
  file_name: string;
  mime_type: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContractMaterial extends ContractMaterialRow {
  file_url: string;
}
