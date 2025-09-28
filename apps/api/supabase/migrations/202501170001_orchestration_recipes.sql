-- Rename legacy project_runs artifacts to orchestration_ equivalents and
-- backfill saved orchestration support for agents.

BEGIN;

-- Rename table and index if they still exist from early migrations.
ALTER TABLE IF EXISTS public.project_runs
    RENAME TO orchestration_runs;

ALTER INDEX IF EXISTS idx_project_runs_plan
    RENAME TO idx_orchestration_runs_plan;

COMMENT ON TABLE public.orchestration_runs IS 'Live orchestration execution state derived from conversation plans or saved orchestrations.';
COMMENT ON COLUMN public.orchestration_runs.step_state IS 'Per-step status metadata including conversations, deliverables, assignments.';

ALTER TABLE IF EXISTS public.orchestration_runs
    ALTER COLUMN plan_id DROP NOT NULL;

ALTER TABLE IF EXISTS public.orchestration_runs
    DROP CONSTRAINT IF EXISTS orchestration_runs_plan_id_fkey;

ALTER TABLE IF EXISTS public.orchestration_runs
    ADD CONSTRAINT orchestration_runs_plan_id_fkey
        FOREIGN KEY (plan_id)
        REFERENCES public.conversation_plans(id)
        ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.orchestration_runs
    ADD COLUMN IF NOT EXISTS origin_type text DEFAULT 'plan';

ALTER TABLE IF EXISTS public.orchestration_runs
    ADD COLUMN IF NOT EXISTS origin_id uuid;

ALTER TABLE IF EXISTS public.orchestration_runs
    ADD COLUMN IF NOT EXISTS orchestration_slug text;

ALTER TABLE IF EXISTS public.orchestration_runs
    ADD COLUMN IF NOT EXISTS prompt_inputs jsonb DEFAULT '{}'::jsonb;

-- Ensure saved orchestration recipes table is available.
CREATE TABLE IF NOT EXISTS public.agent_orchestrations (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    organization_slug text,
    agent_slug text NOT NULL,
    slug text NOT NULL,
    display_name text NOT NULL,
    description text,
    status text DEFAULT 'active',
    orchestration_json jsonb NOT NULL,
    prompt_templates jsonb DEFAULT '[]'::jsonb,
    tags text[] DEFAULT ARRAY[]::text[],
    version text,
    created_by uuid,
    updated_by uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT agent_orchestrations_slug_unique UNIQUE (organization_slug, agent_slug, slug)
);

COMMENT ON TABLE public.agent_orchestrations IS 'Reusable orchestration recipes bound to a specific agent.';
COMMENT ON COLUMN public.agent_orchestrations.orchestration_json IS 'Structured orchestration definition (phases, steps, dependencies).';
COMMENT ON COLUMN public.agent_orchestrations.prompt_templates IS 'Prompt templates with parameter metadata required to launch orchestrations.';

CREATE INDEX IF NOT EXISTS idx_agent_orchestrations_agent ON public.agent_orchestrations(agent_slug);
CREATE INDEX IF NOT EXISTS idx_agent_orchestrations_org ON public.agent_orchestrations(organization_slug);

COMMIT;
