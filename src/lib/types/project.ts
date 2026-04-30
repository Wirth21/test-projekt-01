export interface Project {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  pdf_count?: number;
  marker_count?: number;
  member_count?: number;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: "owner" | "member" | "viewer";
  joined_at: string;
  profile?: {
    display_name: string | null;
    email: string;
  };
}

export interface ProjectWithRole extends Project {
  role: "owner" | "member" | "viewer";
  // True if the user has a row in project_members for this project.
  // Tenant-viewers see all projects (role defaults to "viewer"), but
  // only those with a real membership belong on the Active tab.
  isMember: boolean;
}
