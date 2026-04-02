export type ActivityActionType =
  | "drawing.uploaded"
  | "drawing.renamed"
  | "drawing.archived"
  | "drawing.restored"
  | "version.uploaded"
  | "version.archived"
  | "project.created"
  | "project.updated"
  | "project.archived"
  | "project.restored"
  | "member.invited"
  | "member.removed"
  | "marker.created"
  | "marker.deleted"
  | "drawing.status_changed";

export type ActivityTargetType =
  | "drawing"
  | "version"
  | "project"
  | "member"
  | "marker";

export interface ActivityLogEntry {
  id: string;
  project_id: string;
  user_id: string;
  action_type: ActivityActionType;
  target_type: ActivityTargetType;
  target_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Grouped action types for filtering */
export type ActivityFilterGroup =
  | "all"
  | "drawings"
  | "versions"
  | "members"
  | "markers"
  | "project";

/** Maps filter groups to action types */
export const ACTIVITY_FILTER_MAP: Record<ActivityFilterGroup, ActivityActionType[] | null> = {
  all: null,
  drawings: ["drawing.uploaded", "drawing.renamed", "drawing.archived", "drawing.restored", "drawing.status_changed"],
  versions: ["version.uploaded", "version.archived"],
  members: ["member.invited", "member.removed"],
  markers: ["marker.created", "marker.deleted"],
  project: ["project.created", "project.updated", "project.archived", "project.restored"],
};
