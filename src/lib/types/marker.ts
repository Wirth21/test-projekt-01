export interface Marker {
  id: string;
  drawing_id: string;
  drawing_version_id: string;
  target_drawing_id: string;
  project_id: string;
  name: string;
  page_number: number;
  x_percent: number;
  y_percent: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/** Marker with joined target drawing info for display */
export interface MarkerWithTarget extends Marker {
  target_drawing: {
    id: string;
    display_name: string;
    is_archived: boolean;
  } | null;
}
