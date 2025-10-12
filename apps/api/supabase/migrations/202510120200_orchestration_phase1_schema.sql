-- Migration: Phase 1 orchestration schema updates
-- Created: 2025-10-12

BEGIN;

-- 1. Orchestration definitions table
CREATE TABLE IF NOT EXISTS public.orchestration_definitions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_agent_slug text NOT NULL,
    organization_slug text NOT NULL,
    name text NOT NULL,
    display_name text NOT NULL,
    version text NOT NULL DEFAULT '1.0.0',
    description text,
    definition jsonb NOT NULL,
    status text NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    CONSTRAINT orchestration_definitions_owner_version_unique UNIQUE (owner_agent_slug, organization_slug, name, version)
);

CREATE INDEX IF NOT EXISTS idx_orchestration_definitions_owner
    ON public.orchestration_definitions (owner_agent_slug, organization_slug);

CREATE INDEX IF NOT EXISTS idx_orchestration_definitions_org_name
    ON public.orchestration_definitions (organization_slug, name);

DROP TRIGGER IF EXISTS set_timestamp_updated_at_orchestration_definitions ON public.orchestration_definitions;
CREATE TRIGGER set_timestamp_updated_at_orchestration_definitions
    BEFORE UPDATE ON public.orchestration_definitions
    FOR EACH ROW EXECUTE FUNCTION public.set_timestamp_updated_at();

-- 2. Orchestration runs enhancements
ALTER TABLE public.orchestration_runs
    ADD COLUMN IF NOT EXISTS orchestration_definition_id uuid,
    ADD COLUMN IF NOT EXISTS orchestration_name text,
    ADD COLUMN IF NOT EXISTS conversation_id uuid,
    ADD COLUMN IF NOT EXISTS parent_orchestration_run_id uuid,
    ADD COLUMN IF NOT EXISTS current_step_id text,
    ADD COLUMN IF NOT EXISTS plan jsonb,
    ADD COLUMN IF NOT EXISTS results jsonb,
    ADD COLUMN IF NOT EXISTS error_details jsonb,
    ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
    ADD COLUMN IF NOT EXISTS created_by uuid;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'orchestration_runs'
          AND column_name = 'prompt_inputs'
    ) THEN
        EXECUTE 'ALTER TABLE public.orchestration_runs RENAME COLUMN prompt_inputs TO parameters';
    END IF;
END $$;

ALTER TABLE public.orchestration_runs
    ADD COLUMN IF NOT EXISTS parameters jsonb;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'orchestration_runs'
          AND column_name = 'parameters'
    ) THEN
        EXECUTE 'ALTER TABLE public.orchestration_runs ALTER COLUMN parameters SET DEFAULT ''{}''::jsonb';
        EXECUTE 'UPDATE public.orchestration_runs SET parameters = ''{}''::jsonb WHERE parameters IS NULL';
    END IF;
END $$;

UPDATE public.orchestration_runs
SET plan = '{}'::jsonb
WHERE plan IS NULL;

UPDATE public.orchestration_runs
SET results = '{}'::jsonb
WHERE results IS NULL;

UPDATE public.orchestration_runs
SET error_details = '{}'::jsonb
WHERE error_details IS NULL;

ALTER TABLE public.orchestration_runs
    ALTER COLUMN plan SET DEFAULT '{}'::jsonb,
    ALTER COLUMN results SET DEFAULT '{}'::jsonb,
    ALTER COLUMN error_details SET DEFAULT '{}'::jsonb;

ALTER TABLE public.orchestration_runs
    ADD CONSTRAINT orchestration_runs_definition_fk
        FOREIGN KEY (orchestration_definition_id)
        REFERENCES public.orchestration_definitions(id)
        ON DELETE SET NULL;

ALTER TABLE public.orchestration_runs
    ADD CONSTRAINT orchestration_runs_conversation_fk
        FOREIGN KEY (conversation_id)
        REFERENCES public.conversations(id)
        ON DELETE SET NULL;

ALTER TABLE public.orchestration_runs
    ADD CONSTRAINT orchestration_runs_parent_fk
        FOREIGN KEY (parent_orchestration_run_id)
        REFERENCES public.orchestration_runs(id)
        ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orchestration_runs_status
    ON public.orchestration_runs (status);

CREATE INDEX IF NOT EXISTS idx_orchestration_runs_conversation
    ON public.orchestration_runs (conversation_id);

CREATE INDEX IF NOT EXISTS idx_orchestration_runs_parent
    ON public.orchestration_runs (parent_orchestration_run_id);

CREATE INDEX IF NOT EXISTS idx_orchestration_runs_definition
    ON public.orchestration_runs (orchestration_definition_id);

DROP TRIGGER IF EXISTS set_timestamp_updated_at_orchestration_runs ON public.orchestration_runs;
CREATE TRIGGER set_timestamp_updated_at_orchestration_runs
    BEFORE UPDATE ON public.orchestration_runs
    FOR EACH ROW EXECUTE FUNCTION public.set_timestamp_updated_at();

-- 3. Orchestration steps enhancements
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'orchestration_steps'
          AND column_name = 'step_key'
    ) THEN
        EXECUTE 'ALTER TABLE public.orchestration_steps RENAME COLUMN step_key TO step_id';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'orchestration_steps'
          AND column_name = 'error'
    ) THEN
        EXECUTE 'ALTER TABLE public.orchestration_steps RENAME COLUMN error TO error_details';
    END IF;
END $$;

ALTER TABLE public.orchestration_steps
    ADD COLUMN IF NOT EXISTS step_id text,
    ADD COLUMN IF NOT EXISTS mode text,
    ADD COLUMN IF NOT EXISTS conversation_id uuid,
    ADD COLUMN IF NOT EXISTS plan_id uuid,
    ADD COLUMN IF NOT EXISTS deliverable_id uuid,
    ADD COLUMN IF NOT EXISTS depends_on text[],
    ADD COLUMN IF NOT EXISTS attempt_number integer DEFAULT 1,
    ADD COLUMN IF NOT EXISTS checkpoint_decision jsonb,
    ADD COLUMN IF NOT EXISTS checkpoint_decided_by uuid,
    ADD COLUMN IF NOT EXISTS checkpoint_decided_at timestamptz,
    ADD COLUMN IF NOT EXISTS invalidated_at timestamptz,
    ADD COLUMN IF NOT EXISTS invalidated_reason text;

UPDATE public.orchestration_steps
SET depends_on = ARRAY[]::text[]
WHERE depends_on IS NULL;

UPDATE public.orchestration_steps
SET attempt_number = 1
WHERE attempt_number IS NULL;

UPDATE public.orchestration_steps
SET mode = COALESCE(mode, 'BUILD');

ALTER TABLE public.orchestration_steps
    ALTER COLUMN depends_on SET DEFAULT ARRAY[]::text[],
    ALTER COLUMN attempt_number SET DEFAULT 1,
    ALTER COLUMN attempt_number SET NOT NULL,
    ALTER COLUMN mode SET DEFAULT 'BUILD',
    ALTER COLUMN mode SET NOT NULL;

ALTER TABLE public.orchestration_steps
    ADD CONSTRAINT orchestration_steps_conversation_fk
        FOREIGN KEY (conversation_id)
        REFERENCES public.conversations(id)
        ON DELETE SET NULL;

ALTER TABLE public.orchestration_steps
    ADD CONSTRAINT orchestration_steps_plan_fk
        FOREIGN KEY (plan_id)
        REFERENCES public.plans(id)
        ON DELETE SET NULL;

ALTER TABLE public.orchestration_steps
    ADD CONSTRAINT orchestration_steps_deliverable_fk
        FOREIGN KEY (deliverable_id)
        REFERENCES public.deliverables(id)
        ON DELETE SET NULL;

ALTER TABLE public.orchestration_steps
    DROP CONSTRAINT IF EXISTS orchestration_steps_unique_per_run;

ALTER TABLE public.orchestration_steps
    ADD CONSTRAINT orchestration_steps_run_step_attempt_unique
        UNIQUE (orchestration_run_id, step_id, attempt_number);

CREATE INDEX IF NOT EXISTS idx_orchestration_steps_conversation
    ON public.orchestration_steps (conversation_id);

CREATE INDEX IF NOT EXISTS idx_orchestration_steps_deliverable
    ON public.orchestration_steps (deliverable_id);

DROP TRIGGER IF EXISTS set_timestamp_updated_at_orchestration_steps ON public.orchestration_steps;
CREATE TRIGGER set_timestamp_updated_at_orchestration_steps
    BEFORE UPDATE ON public.orchestration_steps
    FOR EACH ROW EXECUTE FUNCTION public.set_timestamp_updated_at();

-- 4. Human approvals extensions
ALTER TABLE public.human_approvals
    ADD COLUMN IF NOT EXISTS orchestration_run_id uuid,
    ADD COLUMN IF NOT EXISTS orchestration_step_id uuid;

ALTER TABLE public.human_approvals
    ADD CONSTRAINT human_approvals_orch_run_fk
        FOREIGN KEY (orchestration_run_id)
        REFERENCES public.orchestration_runs(id)
        ON DELETE SET NULL;

ALTER TABLE public.human_approvals
    ADD CONSTRAINT human_approvals_orch_step_fk
        FOREIGN KEY (orchestration_step_id)
        REFERENCES public.orchestration_steps(id)
        ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_human_approvals_orch_run
    ON public.human_approvals (orchestration_run_id);

CREATE INDEX IF NOT EXISTS idx_human_approvals_orch_step
    ON public.human_approvals (orchestration_step_id);

COMMIT;
