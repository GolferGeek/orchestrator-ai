-- Migration: Ensure llm_usage has metrics and PII columns
-- Date: 2025-09-14
-- Purpose: Backfill schema in environments missing newer columns used by RunMetadataService

-- Tokens and timing
ALTER TABLE IF EXISTS public.llm_usage
  ADD COLUMN IF NOT EXISTS input_tokens integer,
  ADD COLUMN IF NOT EXISTS output_tokens integer,
  ADD COLUMN IF NOT EXISTS duration_ms integer;

-- Cost fields (some environments may already have input/output_cost)
ALTER TABLE IF EXISTS public.llm_usage
  ADD COLUMN IF NOT EXISTS input_cost numeric,
  ADD COLUMN IF NOT EXISTS output_cost numeric,
  ADD COLUMN IF NOT EXISTS total_cost numeric;

-- Sanitization and PII fields
ALTER TABLE IF EXISTS public.llm_usage
  ADD COLUMN IF NOT EXISTS data_sanitization_applied boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sanitization_level text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS pii_detected boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pii_types jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pseudonyms_used integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pseudonym_types jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS redactions_applied integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS redaction_types jsonb DEFAULT '[]'::jsonb;

-- Optional helpful index to quickly retrieve a specific run
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND indexname = 'idx_llm_usage_run_id'
  ) THEN
    CREATE INDEX idx_llm_usage_run_id ON public.llm_usage(run_id);
  END IF;
END $$;

