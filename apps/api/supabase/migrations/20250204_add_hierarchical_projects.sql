-- Migration: Add hierarchical projects and project steps for orchestrator system
-- This enhances the existing conversation + tasks paradigm with project capabilities

-- Projects table - extends conversations with long-running, multi-step workflows
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.agent_conversations(id) ON DELETE CASCADE,
    name TEXT, -- Optional, user-defined or auto-generated project name
    description TEXT, -- Project description/goal
    plan_json JSONB, -- The structured plan definition (PlanDefinition)
    status TEXT NOT NULL DEFAULT 'planning' CHECK (
        status IN ('planning', 'running', 'paused_for_human', 'paused_on_error', 'completed', 'aborted')
    ),
    current_step_id TEXT, -- Current executing step (references project_steps.step_id)
    error_details JSONB, -- Error information when status is 'paused_on_error'
    metadata JSONB DEFAULT '{}', -- Additional project metadata
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Project steps table - individual execution steps within a project
CREATE TABLE IF NOT EXISTS public.project_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    step_id TEXT NOT NULL, -- Unique identifier within the project (from PlanDefinition)
    step_index INTEGER NOT NULL, -- Execution order
    step_type TEXT NOT NULL CHECK (step_type IN ('agent_step', 'human_approval')),
    step_name TEXT NOT NULL, -- Human-readable step name
    agent_name TEXT, -- Target agent for 'agent_step' type
    prompt TEXT, -- The prompt/instruction for this step
    dependencies TEXT[] DEFAULT '{}', -- Array of step_ids this step depends on
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'running', 'completed', 'failed', 'skipped')
    ),
    result JSONB, -- Step execution result
    error_details JSONB, -- Error information if step failed
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}', -- Additional step metadata
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Ensure unique step_id within each project
    UNIQUE(project_id, step_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_projects_conversation_id ON public.projects(conversation_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_steps_project_id ON public.project_steps(project_id);
CREATE INDEX IF NOT EXISTS idx_project_steps_status ON public.project_steps(status);
CREATE INDEX IF NOT EXISTS idx_project_steps_step_index ON public.project_steps(project_id, step_index);

-- Triggers for auto-updating timestamps
CREATE TRIGGER handle_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER handle_project_steps_updated_at
    BEFORE UPDATE ON public.project_steps
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Grant appropriate permissions
GRANT ALL ON public.projects TO authenticated;
GRANT ALL ON public.project_steps TO authenticated;
GRANT ALL ON public.projects TO anon;
GRANT ALL ON public.project_steps TO anon;

-- Verification queries
SELECT 'Projects table created' as status, count(*) as row_count FROM public.projects;
SELECT 'Project steps table created' as status, count(*) as row_count FROM public.project_steps;