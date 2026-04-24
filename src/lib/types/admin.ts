export type UserStatus = "pending" | "active" | "disabled" | "deleted";
export type TenantRole = "user" | "viewer" | "guest";

export interface AdminProfile {
  id: string;
  display_name: string | null;
  email: string;
  status: UserStatus;
  is_admin: boolean;
  tenant_role: TenantRole;
  tenant_id: string;
  created_at: string;
  updated_at: string;
  project_count?: number;
}

export interface AdminProfileWithProjects extends AdminProfile {
  projects: AdminUserProject[];
}

export interface AdminUserProject {
  id: string;
  project_id: string;
  project_name: string;
  role: "owner" | "member";
  joined_at: string;
}

export interface PendingUser {
  id: string;
  display_name: string | null;
  email: string;
  created_at: string;
}

/**
 * Admin "Projects" tab — one entry per tenant project.
 * Used in /admin/projects list and the delete confirm dialog.
 */
export interface AdminTenantProject {
  id: string;
  name: string;
  is_archived: boolean;
  created_at: string;
  drawings_count: number;
  versions_count: number;
  members_count: number;
  groups_count: number;
  storage_bytes: number;
}

export interface AdminProjectDeleteResult {
  deleted: {
    project_id: string;
    project_name: string;
    drawings: number;
    members: number;
    storage_bytes: number;
  };
}
