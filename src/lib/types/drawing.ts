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
  /** Pre-signed URL for latest_version.thumbnail_path, if available (populated by API) */
  thumbnail_url?: string | null;
}

export interface DrawingVersion {
  id: string;
  drawing_id: string;
  /** Monotonic within a drawing, and also the visible stack order:
   *  highest = top of the stack = current. Moving a version up/down swaps
   *  this number with the adjacent version. */
  version_number: number;
  label: string;
  storage_path: string;
  /** Storage path of the pre-generated JPEG thumbnail (null for legacy versions) */
  thumbnail_path: string | null;
  file_size: number;
  page_count: number | null;
  is_archived: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  status_id: string | null;
  /** Rotation in degrees (0, 90, 180, 270). Applied persistently in the viewer. */
  rotation?: number;
  /** Joined status data (populated by API) */
  status?: DrawingStatus | null;
}

export interface DrawingStatus {
  id: string;
  tenant_id: string;
  name: string;
  color: string;
  sort_order: number;
  is_default: boolean;
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
