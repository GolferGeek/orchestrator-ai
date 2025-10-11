-- Migration: add orchestration_steps and orchestration_checkpoints tables
-- Created: 2025-02-09

BEGIN;

-- 1) Ensure orchestration_runs exists (created in prior migrations)
--    so we can safely reference it as a foreign key.

-- 2) Persistent storage for per-step state within an orchestration run.
CREATE TABLE IF NOT EXISTS public.orchestration_steps (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    orchestration_run_id uuid NOT NULL REFERENCES public.orchestration_runs(id) ON DELETE CASCADE,
    step_index integer NOT NULL,
    step_key text,
    status text NOT NULL DEFAULT 'pending',
    agent_slug text,
    input jsonb DEFAULT '{}'::jsonb,
    output jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    error jsonb,
    started_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT orchestration_steps_unique_per_run UNIQUE (orchestration_run_id, step_index)
);

COMMENT ON TABLE public.orchestration_steps IS 'Durable record of each orchestration step state.';
COMMENT ON COLUMN public.orchestration_steps.step_key IS 'Optional identifier from plan/orchestration definition.';
COMMENT ON COLUMN public.orchestration_steps.metadata IS 'Execution metadata (progress markers, retries, etc.).';
COMMENT ON COLUMN public.orchestration_steps.error IS 'Latest error payload if the step failed.';

CREATE INDEX IF NOT EXISTS idx_orchestration_steps_run
    ON public.orchestration_steps (orchestration_run_id);

CREATE INDEX IF NOT EXISTS idx_orchestration_steps_status
    ON public.orchestration_steps (status);

-- 3) Checkpoints allow long-running orchestrations to resume.
CREATE TABLE IF NOT EXISTS public.orchestration_checkpoints (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    orchestration_run_id uuid NOT NULL REFERENCES public.orchestration_runs(id) ON DELETE CASCADE,
    step_index integer,
    label text,
    state jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_by uuid,
    created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.orchestration_checkpoints IS 'Serializable snapshots that allow orchestration resumes.';
COMMENT ON COLUMN public.orchestration_checkpoints.state IS 'Serializable execution state at checkpoint.';

CREATE INDEX IF NOT EXISTS idx_orchestration_checkpoints_run
    ON public.orchestration_checkpoints (orchestration_run_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orchestration_checkpoints_label
    ON public.orchestration_checkpoints (label);

COMMIT;
