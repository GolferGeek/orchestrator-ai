-- Migration: Index for llm_usage.route for faster route breakdowns
-- Created: 2025-01-21

BEGIN;

CREATE INDEX IF NOT EXISTS llm_usage_route_idx
  ON public.llm_usage (route);

-- Optional: time-sliced index for common analytics windows
-- Uncomment if you frequently filter by started_at
-- CREATE INDEX IF NOT EXISTS llm_usage_route_started_at_idx
--   ON public.llm_usage (route, started_at DESC);

COMMIT;

