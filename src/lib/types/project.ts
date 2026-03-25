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
  member_count?: number;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
  profile?: {
    display_name: string | null;
    email: string;
  };
}

export interface ProjectWithRole extends Project {
  role: "owner" | "member";
}
