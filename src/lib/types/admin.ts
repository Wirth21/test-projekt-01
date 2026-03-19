export type UserStatus = "pending" | "active" | "disabled" | "deleted";

export interface AdminProfile {
  id: string;
  display_name: string | null;
  email: string;
  status: UserStatus;
  is_admin: boolean;
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
