-- Migration: Fix Anthropic Model Names
-- Date: 2025-09-07
-- Description: Fix Anthropic model names by replacing dots with hyphens
-- 
-- This migration:
-- 1. Adds corrected Anthropic model entries with hyphens instead of dots
-- 2. Removes old entries with dots that cause 404 errors with Anthropic API
-- 3. Updates speed tiers for the new entries
-- 
-- Fixes: model claude-3.5-haiku-20241022 was not found (should be claude-3-5-haiku-20241022)

-- ============================================================================
-- STEP 1: ADD CORRECTED ANTHROPIC MODEL ENTRIES
-- ============================================================================

INSERT INTO public.llm_models (
    model_name, provider_name, display_name, model_type, context_window, max_output_tokens,
    pricing_info_json, capabilities, is_active
) VALUES
-- Corrected Claude 3.5 Haiku (dots → hyphens)
('claude-3-5-haiku-20241022', 'anthropic', 'Claude 3.5 Haiku', 'text-generation', 200000, 8192,
 '{"input_cost_per_token": 0.000001, "output_cost_per_token": 0.000005}'::jsonb,
 '["streaming", "fast", "low_latency", "cost_effective"]'::jsonb, true),

-- Corrected Claude 3.5 Sonnet (dots → hyphens)  
('claude-3-5-sonnet-20241022', 'anthropic', 'Claude 3.5 Sonnet', 'text-generation', 200000, 8192,
 '{"input_cost_per_token": 0.000003, "output_cost_per_token": 0.000015}'::jsonb,
 '["function_calling", "streaming", "balanced", "reasoning"]'::jsonb, true);

-- ============================================================================
-- STEP 2: UPDATE SPEED TIERS FOR NEW ENTRIES
-- ============================================================================

UPDATE public.llm_models SET speed_tier = 'fast' WHERE provider_name = 'anthropic' AND model_name = 'claude-3-5-haiku-20241022';
UPDATE public.llm_models SET speed_tier = 'medium' WHERE provider_name = 'anthropic' AND model_name = 'claude-3-5-sonnet-20241022';

-- ============================================================================
-- STEP 3: REMOVE OLD ENTRIES WITH DOTS
-- ============================================================================

-- Remove the problematic entries that cause API 404 errors
DELETE FROM public.llm_models WHERE provider_name = 'anthropic' AND model_name = 'claude-3.5-haiku-20241022';
DELETE FROM public.llm_models WHERE provider_name = 'anthropic' AND model_name = 'claude-3.5-sonnet';

-- ============================================================================
-- STEP 4: VERIFICATION
-- ============================================================================

-- Verify the changes (this will show in migration logs)
DO $$
DECLARE
    model_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO model_count 
    FROM public.llm_models 
    WHERE provider_name = 'anthropic' 
    AND model_name IN ('claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022');
    
    IF model_count = 2 THEN
        RAISE NOTICE 'SUCCESS: Anthropic model names fixed. Found % corrected models.', model_count;
    ELSE
        RAISE EXCEPTION 'ERROR: Expected 2 corrected Anthropic models, found %', model_count;
    END IF;
END $$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.llm_models IS 'LLM models with corrected Anthropic naming (hyphens not dots) - 2025-09-07 fix';
