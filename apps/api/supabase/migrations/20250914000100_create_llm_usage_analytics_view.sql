-- Migration: Create llm_usage_analytics view used by Admin analytics
-- Date: 2025-09-14

-- Recreate the analytics view to avoid dependency errors
DROP VIEW IF EXISTS public.llm_usage_analytics;

CREATE VIEW public.llm_usage_analytics AS
SELECT
  date_trunc('day', started_at)::date AS date,
  COALESCE(caller_type, 'unknown') AS caller_type,
  COUNT(*) AS total_requests,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS successful_requests,
  -- Prefer persisted total_cost; if null, compute from input/output
  COALESCE(SUM(total_cost), SUM(COALESCE(input_cost, 0) + COALESCE(output_cost, 0))) AS total_cost,
  -- Average duration in ms across rows for this day/type
  AVG(COALESCE(duration_ms, 0))::numeric AS avg_duration_ms,
  -- Local vs external split
  SUM(CASE WHEN is_local IS TRUE THEN 1 ELSE 0 END) AS local_requests,
  SUM(CASE WHEN is_local IS NOT TRUE THEN 1 ELSE 0 END) AS external_requests
FROM public.llm_usage
GROUP BY 1, 2
ORDER BY 1 DESC, 2 ASC;

-- Optional: grant select
GRANT SELECT ON public.llm_usage_analytics TO anon, authenticated, service_role;

