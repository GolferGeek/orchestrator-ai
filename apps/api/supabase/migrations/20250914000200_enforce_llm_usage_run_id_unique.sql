-- Migration: Enforce uniqueness and presence of run_id in llm_usage
-- Date: 2025-09-14

-- Ensure run_id is not null
ALTER TABLE IF EXISTS public.llm_usage
  ALTER COLUMN run_id SET NOT NULL;

-- Create unique index on run_id to guarantee single update target per run
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'llm_usage_run_id_unique'
  ) THEN
    CREATE UNIQUE INDEX llm_usage_run_id_unique ON public.llm_usage(run_id);
  END IF;
END $$;

