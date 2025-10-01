-- Migration: Add `route` column to llm_usage and backfill from is_local
-- Created: 2025-01-21

BEGIN;

-- 1) Add column if it does not exist
ALTER TABLE public.llm_usage
  ADD COLUMN IF NOT EXISTS route text;

-- 2) Backfill existing rows where route is NULL
UPDATE public.llm_usage
   SET route = CASE WHEN is_local IS TRUE THEN 'local' ELSE 'remote' END
 WHERE route IS NULL;

-- 3) Optional: basic check constraint to keep route normalized
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'llm_usage_route_check'
  ) THEN
    ALTER TABLE public.llm_usage
      ADD CONSTRAINT llm_usage_route_check
      CHECK (route IS NULL OR route IN ('local','remote'));
  END IF;
END $$;

COMMIT;

