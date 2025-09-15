-- Migration: Add pseudonym_mappings JSONB column to llm_usage
-- Purpose: Store actual pseudonym mappings (original, pseudonym, type) per run

ALTER TABLE IF EXISTS public.llm_usage
  ADD COLUMN IF NOT EXISTS pseudonym_mappings jsonb DEFAULT '[]'::jsonb;

-- Optional: comment for clarity
COMMENT ON COLUMN public.llm_usage.pseudonym_mappings IS 'Array of {original, pseudonym, dataType} objects for this run';

