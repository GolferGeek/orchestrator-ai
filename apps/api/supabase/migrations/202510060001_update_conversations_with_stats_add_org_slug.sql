-- Update conversations_with_stats view to include organization_slug
-- Because CREATE OR REPLACE VIEW cannot change the column list/order,
-- we drop and recreate the view, then re-grant permissions.

DROP VIEW IF EXISTS public.conversations_with_stats;

CREATE VIEW public.conversations_with_stats AS
SELECT
  c.id,
  c.user_id,
  c.agent_name,
  c.agent_type,
  c.ended_at,
  c.started_at,
  c.last_active_at,
  c.metadata,
  c.created_at,
  c.updated_at,
  COALESCE(task_stats.task_count, 0)::bigint AS task_count,
  COALESCE(task_stats.completed_tasks, 0)::bigint AS completed_tasks,
  COALESCE(task_stats.failed_tasks, 0)::bigint AS failed_tasks,
  COALESCE(task_stats.active_tasks, 0)::bigint AS active_tasks,
  c.organization_slug
FROM public.conversations c
LEFT JOIN (
  SELECT
    t.conversation_id,
    COUNT(*) AS task_count,
    COUNT(CASE WHEN t.status::text = 'completed' THEN 1 END) AS completed_tasks,
    COUNT(CASE WHEN t.status::text = 'failed' THEN 1 END) AS failed_tasks,
    COUNT(CASE WHEN t.status::text IN ('pending','running') THEN 1 END) AS active_tasks
  FROM public.tasks t
  GROUP BY t.conversation_id
) task_stats ON c.id = task_stats.conversation_id;

-- Re-grant permissions (Supabase roles)
GRANT SELECT ON public.conversations_with_stats TO anon;
GRANT SELECT ON public.conversations_with_stats TO authenticated;
GRANT SELECT ON public.conversations_with_stats TO service_role;
