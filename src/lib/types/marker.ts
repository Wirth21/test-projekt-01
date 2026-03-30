export const MARKER_COLORS = ["blue", "red", "green", "orange", "purple"] as const;
export type MarkerColor = (typeof MARKER_COLORS)[number];

export const MARKER_COLOR_MAP: Record<MarkerColor, string> = {
  blue: "#3b82f6",
  red: "#ef4444",
  green: "#22c55e",
  orange: "#f97316",
  purple: "#a855f7",
};

export interface Marker {
  id: string;
  drawing_id: string;
  drawing_version_id: string;
  target_drawing_id: string;
  project_id: string;
  name: string;
  color: MarkerColor;
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
