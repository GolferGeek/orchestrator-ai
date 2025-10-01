-- Migration: Composite index for llm_usage (route, started_at)
-- Created: 2025-01-21

BEGIN;

CREATE INDEX IF NOT EXISTS llm_usage_route_started_at_idx
  ON public.llm_usage (route, started_at DESC);

COMMIT;

