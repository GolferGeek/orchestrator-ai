-- Create agent_conversations_with_stats view
-- This view provides conversation data with task statistics

CREATE OR REPLACE VIEW public.agent_conversations_with_stats AS
SELECT 
    ac.*,
    COALESCE(task_stats.task_count, 0) as task_count,
    COALESCE(task_stats.completed_tasks, 0) as completed_tasks,
    COALESCE(task_stats.failed_tasks, 0) as failed_tasks,
    COALESCE(task_stats.active_tasks, 0) as active_tasks
FROM public.agent_conversations ac
LEFT JOIN (
    SELECT 
        agent_conversation_id,
        COUNT(*) as task_count,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_tasks,
        COUNT(CASE WHEN status IN ('pending', 'running') THEN 1 END) as active_tasks
    FROM public.tasks
    GROUP BY agent_conversation_id
) task_stats ON ac.id = task_stats.agent_conversation_id;

-- Grant appropriate permissions
GRANT SELECT ON public.agent_conversations_with_stats TO authenticated;
GRANT SELECT ON public.agent_conversations_with_stats TO anon;
