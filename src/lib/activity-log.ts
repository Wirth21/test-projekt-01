import { SupabaseClient } from "@supabase/supabase-js";

export type ActionType =
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
  | "marker.deleted";

export type TargetType = "drawing" | "version" | "project" | "member" | "marker";

/**
 * Logs an activity entry for a project.
 * This function is best-effort: it will not throw on failure,
 * only log a warning. This ensures that the primary action
 * (e.g., uploading a drawing) is never blocked by a logging failure.
 *
 * The user_name is fetched from the profiles table and stored
 * as a snapshot in metadata, so the log remains readable even
 * if the user is later deleted.
 */
export async function logActivity(
  supabase: SupabaseClient,
  params: {
    projectId: string;
    userId: string;
    actionType: ActionType;
    targetType: TargetType;
    targetId: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  try {
    // Fetch user display_name from profiles for snapshot
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", params.userId)
      .single();

    const userName = profile?.display_name || "Unbekannter Nutzer";

    const enrichedMetadata = {
      user_name: userName,
      ...(params.metadata ?? {}),
    };

    const { error } = await supabase.from("activity_log").insert({
      project_id: params.projectId,
      user_id: params.userId,
      action_type: params.actionType,
      target_type: params.targetType,
      target_id: params.targetId,
      metadata: enrichedMetadata,
    });

    if (error) {
      console.warn("[activity-log] Failed to insert activity log entry:", error.message);
    }
  } catch (err) {
    console.warn("[activity-log] Unexpected error logging activity:", err);
  }
}
