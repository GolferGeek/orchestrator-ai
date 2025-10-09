BEGIN;

-- Drop legacy projects tables if exist
DROP TABLE IF EXISTS public.project_steps CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;

-- Drop legacy conversation_plans if present (we're moving to plans)
DROP TABLE IF EXISTS public.conversation_plans CASCADE;

-- Create plans table
CREATE TABLE IF NOT EXISTS public.plans (
  id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  organization_slug text,
  agent_slug text,
  title text,
  status text DEFAULT 'draft',
  summary text,
  plan_json jsonb NOT NULL,
  created_by uuid,
  approved_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.plans IS 'Structured execution plans, replacing conversation_plans.';
COMMENT ON COLUMN public.plans.plan_json IS 'Plan structure with phases, steps, dependencies, checkpoints.';

-- Create plan_deliverables table
CREATE TABLE IF NOT EXISTS public.plan_deliverables (
  id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  deliverable_id uuid REFERENCES public.deliverables(id) ON DELETE SET NULL,
  label text,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_plans_conversation ON public.plans(conversation_id);
CREATE INDEX IF NOT EXISTS idx_plans_org_slug ON public.plans(organization_slug);
CREATE INDEX IF NOT EXISTS idx_plan_deliverables_plan ON public.plan_deliverables(plan_id);

COMMIT;
