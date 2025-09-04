-- Fix for view column data type conflict
-- Drop existing conflicting views before running the main migration

-- Drop existing analytics views that might conflict
DROP VIEW IF EXISTS public.llm_usage_analytics CASCADE;
DROP VIEW IF EXISTS public.llm_usage_privacy_summary CASCADE;

-- Also drop any other views that might reference llm_usage with date columns
DROP VIEW IF EXISTS public.llm_usage_summary CASCADE;
DROP VIEW IF EXISTS public.daily_llm_usage CASCADE;

-- Now you can run the main migration without conflicts