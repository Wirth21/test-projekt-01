-- Extend the activity_log CHECK constraint to accept drawing.status_changed.
-- Without this, every status change silently fails the INSERT because
-- logActivity swallows the constraint violation.

ALTER TABLE public.activity_log
  DROP CONSTRAINT IF EXISTS activity_log_action_type_check;

ALTER TABLE public.activity_log
  ADD CONSTRAINT activity_log_action_type_check
  CHECK (action_type IN (
    'drawing.uploaded',
    'drawing.renamed',
    'drawing.archived',
    'drawing.restored',
    'drawing.status_changed',
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
  ));
