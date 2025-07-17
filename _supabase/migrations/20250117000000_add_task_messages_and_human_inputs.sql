-- Migration: Add task_messages and human_inputs tables for four-entity model
-- Date: 2025-01-17
-- Description: Implements the four-entity model (Conversations, Tasks, Messages, Deliverables) with human-in-the-loop support

-- First, enhance the tasks table with new fields for deliverables and human interaction
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS deliverable_type TEXT DEFAULT 'text',
ADD COLUMN IF NOT EXISTS deliverable_metadata JSONB DEFAULT '{}'::jsonb;

-- Update the status check constraint to include waiting_for_human
ALTER TABLE public.tasks 
DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE public.tasks 
ADD CONSTRAINT tasks_status_check 
CHECK (status IN ('pending', 'running', 'waiting_for_human', 'completed', 'failed', 'cancelled'));

-- Create task_messages table for intermediate communications during task execution
CREATE TABLE IF NOT EXISTS public.task_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type TEXT NOT NULL CHECK (message_type IN ('progress', 'status', 'info', 'warning', 'error')),
    progress_percentage INTEGER CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create human_inputs table for human-in-the-loop functionality
CREATE TABLE IF NOT EXISTS public.human_inputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    request_type TEXT NOT NULL CHECK (request_type IN ('confirmation', 'choice', 'input', 'approval')),
    prompt TEXT NOT NULL,
    options JSONB, -- For multiple choice scenarios
    user_response TEXT,
    response_metadata JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'timeout', 'cancelled')),
    timeout_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add indexes for task_messages table
CREATE INDEX IF NOT EXISTS idx_task_messages_task_id ON public.task_messages(task_id);
CREATE INDEX IF NOT EXISTS idx_task_messages_user_id ON public.task_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_task_messages_created_at ON public.task_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_messages_type ON public.task_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_task_messages_task_created ON public.task_messages(task_id, created_at DESC);

-- Add indexes for human_inputs table
CREATE INDEX IF NOT EXISTS idx_human_inputs_task_id ON public.human_inputs(task_id);
CREATE INDEX IF NOT EXISTS idx_human_inputs_user_id ON public.human_inputs(user_id);
CREATE INDEX IF NOT EXISTS idx_human_inputs_status ON public.human_inputs(status);
CREATE INDEX IF NOT EXISTS idx_human_inputs_timeout ON public.human_inputs(timeout_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_human_inputs_created_at ON public.human_inputs(created_at DESC);

-- Enable RLS for new tables
ALTER TABLE public.task_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.human_inputs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for task_messages
CREATE POLICY "Users can view their own task messages"
    ON public.task_messages FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can create their own task messages"
    ON public.task_messages FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can create task messages for any user"
    ON public.task_messages FOR INSERT
    WITH CHECK (true);

-- RLS Policies for human_inputs
CREATE POLICY "Users can view their own human inputs"
    ON public.human_inputs FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can create their own human inputs"
    ON public.human_inputs FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own human inputs"
    ON public.human_inputs FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "System can create human inputs for any user"
    ON public.human_inputs FOR INSERT
    WITH CHECK (true);

CREATE POLICY "System can update human inputs for any user"
    ON public.human_inputs FOR UPDATE
    USING (true);

-- Create function to update updated_at for human_inputs
CREATE OR REPLACE FUNCTION update_human_inputs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at on human_inputs
CREATE TRIGGER update_human_inputs_updated_at_trigger
    BEFORE UPDATE ON public.human_inputs
    FOR EACH ROW
    EXECUTE FUNCTION update_human_inputs_updated_at();

-- Create view for tasks with message counts
CREATE OR REPLACE VIEW public.tasks_with_message_stats AS
SELECT 
    t.*,
    COUNT(tm.id) AS message_count,
    COUNT(tm.id) FILTER (WHERE tm.message_type = 'progress') AS progress_messages,
    COUNT(tm.id) FILTER (WHERE tm.message_type = 'error') AS error_messages,
    COUNT(hi.id) AS human_input_count,
    COUNT(hi.id) FILTER (WHERE hi.status = 'pending') AS pending_human_inputs,
    MAX(tm.created_at) AS last_message_at
FROM public.tasks t
LEFT JOIN public.task_messages tm ON tm.task_id = t.id
LEFT JOIN public.human_inputs hi ON hi.task_id = t.id
GROUP BY t.id;

-- Create view for human inputs with task context
CREATE OR REPLACE VIEW public.human_inputs_with_task_context AS
SELECT 
    hi.*,
    t.method AS task_method,
    t.status AS task_status,
    t.agent_conversation_id,
    ac.agent_name,
    ac.agent_type
FROM public.human_inputs hi
JOIN public.tasks t ON t.id = hi.task_id
JOIN public.agent_conversations ac ON ac.id = t.agent_conversation_id;

-- Grant permissions
GRANT ALL ON public.task_messages TO authenticated;
GRANT ALL ON public.human_inputs TO authenticated;
GRANT SELECT ON public.tasks_with_message_stats TO authenticated;
GRANT SELECT ON public.human_inputs_with_task_context TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE public.task_messages IS 'Stores intermediate messages during task execution for real-time communication';
COMMENT ON TABLE public.human_inputs IS 'Manages human-in-the-loop interactions with timeout and response tracking';
COMMENT ON COLUMN public.tasks.deliverable_type IS 'Type of deliverable produced by the task (text, json, file, etc.)';
COMMENT ON COLUMN public.tasks.deliverable_metadata IS 'Additional metadata about the deliverable structure and content';
COMMENT ON COLUMN public.task_messages.message_type IS 'Type of message: progress, status, info, warning, error';
COMMENT ON COLUMN public.task_messages.progress_percentage IS 'Optional progress percentage (0-100) for progress messages';
COMMENT ON COLUMN public.human_inputs.request_type IS 'Type of human input required: confirmation, choice, input, approval';
COMMENT ON COLUMN public.human_inputs.options IS 'JSON array of options for choice-type inputs';
COMMENT ON COLUMN public.human_inputs.timeout_at IS 'Timestamp when this input request expires';