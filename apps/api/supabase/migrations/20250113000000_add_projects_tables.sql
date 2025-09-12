-- Create projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  name TEXT,
  description TEXT,
  plan_json JSONB,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'pending_approval', 'running', 'paused_for_approval', 'paused_on_error', 'completed', 'aborted')),
  current_step_id TEXT,
  error_details JSONB,
  metadata JSONB DEFAULT '{}',
  parent_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  hierarchy_level INTEGER DEFAULT 0,
  subproject_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create project_steps table
CREATE TABLE IF NOT EXISTS public.project_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL,
  step_index INTEGER NOT NULL,
  step_type TEXT NOT NULL CHECK (step_type IN ('agent_step', 'human_approval')),
  step_name TEXT NOT NULL,
  agent_name TEXT,
  prompt TEXT NOT NULL,
  dependencies TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'pending_approval', 'skipped')),
  result JSONB,
  error_details JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_projects_conversation_id ON public.projects(conversation_id);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_projects_parent_project_id ON public.projects(parent_project_id);
CREATE INDEX idx_projects_created_at ON public.projects(created_at);
CREATE INDEX idx_projects_updated_at ON public.projects(updated_at);

CREATE INDEX idx_project_steps_project_id ON public.project_steps(project_id);
CREATE INDEX idx_project_steps_status ON public.project_steps(status);
CREATE INDEX idx_project_steps_step_index ON public.project_steps(step_index);

-- Add RLS (Row Level Security) policies
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_steps ENABLE ROW LEVEL SECURITY;

-- Projects RLS policies
CREATE POLICY "Users can view their own projects" ON public.projects
  FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own projects" ON public.projects
  FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own projects" ON public.projects
  FOR UPDATE
  USING (
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own projects" ON public.projects
  FOR DELETE
  USING (
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE user_id = auth.uid()
    )
  );

-- Project steps RLS policies
CREATE POLICY "Users can view their own project steps" ON public.project_steps
  FOR SELECT
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.conversations c ON p.conversation_id = c.id
      WHERE c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own project steps" ON public.project_steps
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.conversations c ON p.conversation_id = c.id
      WHERE c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own project steps" ON public.project_steps
  FOR UPDATE
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.conversations c ON p.conversation_id = c.id
      WHERE c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own project steps" ON public.project_steps
  FOR DELETE
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.conversations c ON p.conversation_id = c.id
      WHERE c.user_id = auth.uid()
    )
  );

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_steps_updated_at BEFORE UPDATE ON public.project_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();