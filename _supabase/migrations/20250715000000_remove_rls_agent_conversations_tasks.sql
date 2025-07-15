-- Migration: Remove RLS and support lazy conversation creation
-- Date: 2025-07-15
-- Description: Remove row-level security and enable lazy conversation creation pattern

-- Disable RLS on tables (all access controlled through API)
ALTER TABLE public.agent_conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks DISABLE ROW LEVEL SECURITY;

-- Drop all RLS policies for agent_conversations
DROP POLICY IF EXISTS "Users can view their own agent conversations" ON public.agent_conversations;
DROP POLICY IF EXISTS "Users can create their own agent conversations" ON public.agent_conversations;
DROP POLICY IF EXISTS "Users can update their own agent conversations" ON public.agent_conversations;

-- Drop all RLS policies for tasks
DROP POLICY IF EXISTS "Users can view their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can create their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON public.tasks;

-- Make agent_conversation_id nullable to support lazy conversation creation
-- This allows creating tasks without a conversation, which will trigger conversation creation
ALTER TABLE public.tasks 
ALTER COLUMN agent_conversation_id DROP NOT NULL;

-- Add foreign key constraint if not exists (maintains referential integrity when set)
ALTER TABLE public.tasks
DROP CONSTRAINT IF EXISTS tasks_agent_conversation_id_fkey,
ADD CONSTRAINT tasks_agent_conversation_id_fkey 
FOREIGN KEY (agent_conversation_id) 
REFERENCES public.agent_conversations(id) 
ON DELETE CASCADE;

-- Add index for tasks without conversations (for cleanup/maintenance)
CREATE INDEX IF NOT EXISTS idx_tasks_no_conversation 
ON public.tasks(user_id) 
WHERE agent_conversation_id IS NULL;

-- Add index for finding orphaned tasks
CREATE INDEX IF NOT EXISTS idx_tasks_by_conversation 
ON public.tasks(agent_conversation_id, created_at DESC);

-- Update comments explaining the new pattern
COMMENT ON TABLE public.agent_conversations IS 
'Tracks conversations between users and specific agents. Created lazily on first task. Access controlled via API authentication.';

COMMENT ON TABLE public.tasks IS 
'Stores individual tasks within agent conversations. Can be created without conversation_id (triggers lazy conversation creation). Access controlled via API authentication.';

COMMENT ON COLUMN public.tasks.agent_conversation_id IS 
'Reference to conversation. NULL initially for lazy creation - conversation created with first task.';

-- Recreate the view to handle nullable conversation IDs
DROP VIEW IF EXISTS public.agent_conversations_with_stats;
CREATE OR REPLACE VIEW public.agent_conversations_with_stats AS
SELECT 
    ac.*,
    COUNT(t.id) AS task_count,
    COUNT(t.id) FILTER (WHERE t.status = 'completed') AS completed_tasks,
    COUNT(t.id) FILTER (WHERE t.status = 'failed') AS failed_tasks,
    COUNT(t.id) FILTER (WHERE t.status IN ('pending', 'running')) AS active_tasks
FROM public.agent_conversations ac
LEFT JOIN public.tasks t ON t.agent_conversation_id = ac.id
GROUP BY ac.id;

-- Grant permissions
GRANT SELECT ON public.agent_conversations_with_stats TO authenticated;