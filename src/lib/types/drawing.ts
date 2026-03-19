export interface Drawing {
  id: string;
  project_id: string;
  display_name: string;
  is_archived: boolean;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  group_id: string | null;
  /** Number of versions (populated by API when available, for badge display) */
  version_count?: number;
  /** Latest active version (populated by API join when available) */
  latest_version?: DrawingVersion | null;
}

export interface DrawingVersion {
  id: string;
  drawing_id: string;
  version_number: number;
  label: string;
  storage_path: string;
  file_size: number;
  page_count: number | null;
  is_archived: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DrawingGroup {
  id: string;
  project_id: string;
  name: string;
  is_archived: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}
