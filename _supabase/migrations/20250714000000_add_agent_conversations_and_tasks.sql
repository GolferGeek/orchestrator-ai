-- Migration: Add agent_conversations and tasks tables for direct agent access
-- Date: 2025-07-14
-- Description: Enables tracking of agent-specific conversations and task lifecycle with real-time progress

-- Create agent_conversations table
CREATE TABLE IF NOT EXISTS public.agent_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    agent_type TEXT NOT NULL CHECK (agent_type IN ('specialist', 'orchestrator', 'external', 'api')),
    started_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    ended_at TIMESTAMPTZ,
    last_active_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add indexes for agent_conversations
CREATE INDEX idx_agent_conversations_user ON public.agent_conversations(user_id);
CREATE INDEX idx_agent_conversations_agent ON public.agent_conversations(agent_name, agent_type);
CREATE INDEX idx_agent_conversations_active ON public.agent_conversations(user_id, ended_at) WHERE ended_at IS NULL;
CREATE INDEX idx_agent_conversations_last_active ON public.agent_conversations(last_active_at DESC);

-- Create tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_conversation_id UUID NOT NULL REFERENCES public.agent_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    -- Request fields
    method TEXT NOT NULL,
    prompt TEXT NOT NULL,
    params JSONB DEFAULT '{}'::jsonb,
    -- Response fields
    response TEXT,
    response_metadata JSONB DEFAULT '{}'::jsonb,
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    progress_message TEXT,
    -- Evaluation fields
    evaluation JSONB DEFAULT '{}'::jsonb,
    llm_metadata JSONB DEFAULT '{}'::jsonb,
    -- Error tracking
    error_code TEXT,
    error_message TEXT,
    error_data JSONB,
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    timeout_seconds INTEGER DEFAULT 300,
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add indexes for tasks
CREATE INDEX idx_tasks_conversation ON public.tasks(agent_conversation_id);
CREATE INDEX idx_tasks_user ON public.tasks(user_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_created ON public.tasks(created_at DESC);
CREATE INDEX idx_tasks_method ON public.tasks(method);

-- Create function to update last_active_at on agent_conversations
CREATE OR REPLACE FUNCTION update_agent_conversation_last_active()
RETURNS TRIGGER AS $$
BEGIN
    -- Update last_active_at when a new task is created or updated
    UPDATE public.agent_conversations
    SET last_active_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE id = NEW.agent_conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update last_active_at
CREATE TRIGGER update_conversation_last_active
AFTER INSERT OR UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION update_agent_conversation_last_active();

-- Enable RLS
ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agent_conversations
CREATE POLICY "Users can view their own agent conversations"
    ON public.agent_conversations FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can create their own agent conversations"
    ON public.agent_conversations FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own agent conversations"
    ON public.agent_conversations FOR UPDATE
    USING (user_id = auth.uid());

-- RLS Policies for tasks
CREATE POLICY "Users can view their own tasks"
    ON public.tasks FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can create their own tasks"
    ON public.tasks FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own tasks"
    ON public.tasks FOR UPDATE
    USING (user_id = auth.uid());

-- Create view for active conversations with task counts
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
GRANT ALL ON public.agent_conversations TO authenticated;
GRANT ALL ON public.tasks TO authenticated;
GRANT SELECT ON public.agent_conversations_with_stats TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE public.agent_conversations IS 'Tracks conversations between users and specific agents';
COMMENT ON TABLE public.tasks IS 'Stores individual tasks within agent conversations with full lifecycle tracking';
COMMENT ON COLUMN public.tasks.evaluation IS 'Stores evaluation results from LLM evaluation system';
COMMENT ON COLUMN public.tasks.llm_metadata IS 'Stores LLM usage metrics, model information, and processing details';

-- Update existing tables' updated_at column triggers to work with new tables
CREATE TRIGGER update_agent_conversations_updated_at BEFORE UPDATE ON public.agent_conversations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();