-- PROJ-15: Activity Log (Audit Log)
-- Tracks all relevant actions within a project

-- Create activity_log table
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'drawing.uploaded',
    'drawing.renamed',
    'drawing.archived',
    'drawing.restored',
    'version.uploaded',
    'version.archived',
    'project.created',
    'project.updated',
    'project.archived',
    'project.restored',
    'member.invited',
    'member.removed',
    'marker.created',
    'marker.deleted'
  )),
  target_type TEXT NOT NULL CHECK (target_type IN (
    'drawing', 'version', 'project', 'member', 'marker'
  )),
  target_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- RLS: Project members can read activity logs for their projects
CREATE POLICY "Project members can read activity log"
  ON activity_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = activity_log.project_id
        AND project_members.user_id = auth.uid()
    )
  );

-- RLS: Admins can read all activity logs
CREATE POLICY "Admins can read all activity logs"
  ON activity_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
        AND profiles.status = 'active'
    )
  );

-- RLS: Only server (service role) inserts via API routes — authenticated users insert through API
-- We allow INSERT for authenticated users since the API routes handle authorization
CREATE POLICY "Authenticated users can insert activity log"
  ON activity_log
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- NO UPDATE policy — activity log entries are immutable (audit requirement)
-- NO DELETE policy — activity log entries cannot be deleted (audit requirement)

-- Indexes for performance
CREATE INDEX idx_activity_log_project_id ON activity_log(project_id);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX idx_activity_log_action_type ON activity_log(action_type);
CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX idx_activity_log_project_created ON activity_log(project_id, created_at DESC);
