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

-- Backfill columns when plans table existed prior to this migration.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'plans'
      AND column_name = 'organization_slug'
  ) THEN
    ALTER TABLE public.plans ADD COLUMN organization_slug text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'plans'
      AND column_name = 'agent_slug'
  ) THEN
    ALTER TABLE public.plans ADD COLUMN agent_slug text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'plans'
      AND column_name = 'title'
  ) THEN
    ALTER TABLE public.plans ADD COLUMN title text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'plans'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE public.plans ADD COLUMN status text DEFAULT 'draft';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'plans'
      AND column_name = 'summary'
  ) THEN
    ALTER TABLE public.plans ADD COLUMN summary text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'plans'
      AND column_name = 'plan_json'
  ) THEN
    ALTER TABLE public.plans ADD COLUMN plan_json jsonb DEFAULT '{}'::jsonb;
    UPDATE public.plans SET plan_json = '{}'::jsonb WHERE plan_json IS NULL;
    ALTER TABLE public.plans ALTER COLUMN plan_json SET NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'plans'
      AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.plans ADD COLUMN created_by uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'plans'
      AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE public.plans ADD COLUMN approved_by uuid;
  END IF;
END $$;

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
