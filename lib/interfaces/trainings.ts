export interface TrainingMaterialRow {
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

export interface TrainingMaterial extends TrainingMaterialRow {
  file_url: string;
}
