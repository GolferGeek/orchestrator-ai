-- ============================================================================
-- Remove problematic LLM models that cause quota/access issues for demo users
-- ============================================================================
-- 
-- This migration removes:
-- 1. o1-preview (OpenAI) - Not available in most accounts, causes 404 errors
-- 2. gemini-2.0-pro (Google) - Causes quota exceeded errors for demo users
--
-- These models were causing test failures and could impact demo user experience
-- by hitting API quota limits or access restrictions.
-- ============================================================================

-- Remove o1-preview (OpenAI) - Not available in most accounts
DELETE FROM public.llm_models 
WHERE provider_id = (SELECT id FROM public.llm_providers WHERE name = 'openai')
AND model_name = 'o1-preview';

-- Remove gemini-2.0-pro (Google) - Quota issues for demo users  
DELETE FROM public.llm_models 
WHERE provider_id = (SELECT id FROM public.llm_providers WHERE name = 'google')
AND model_name = 'gemini-2.0-pro';

-- Add comment for tracking
COMMENT ON TABLE public.llm_models IS 'LLM models - removed o1-preview and gemini-2.0-pro for demo stability (2025-01-09)';
