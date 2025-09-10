-- Add project_steps table for multi-step project orchestration
-- This table tracks individual steps within projects, enabling complex workflows

CREATE TABLE IF NOT EXISTS public.project_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    step_id VARCHAR(255) NOT NULL,
    step_index INTEGER NOT NULL,
    step_type VARCHAR(50) NOT NULL CHECK (step_type IN ('agent_step', 'human_approval')),
    step_name VARCHAR(255) NOT NULL,
    agent_name VARCHAR(255),
    prompt TEXT,
    dependencies TEXT[] DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
    result JSONB,
    error_details JSONB,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX idx_project_steps_project_id ON public.project_steps(project_id);
CREATE INDEX idx_project_steps_status ON public.project_steps(status);
CREATE INDEX idx_project_steps_step_index ON public.project_steps(project_id, step_index);

-- Add trigger for updated_at timestamp
CREATE TRIGGER update_project_steps_updated_at BEFORE UPDATE ON public.project_steps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.project_steps ENABLE ROW LEVEL SECURITY;

-- Project steps are visible to project owners
CREATE POLICY "Users can view own project steps" ON public.project_steps
    FOR ALL USING (auth.uid() = (SELECT user_id FROM public.projects WHERE id = project_id));

-- Grant permissions
GRANT ALL ON public.project_steps TO authenticated;
GRANT SELECT ON public.project_steps TO anon;

-- Add comment explaining the table purpose
COMMENT ON TABLE public.project_steps IS 'Individual steps within multi-step projects, enabling complex orchestration workflows with agent execution and human approval points';