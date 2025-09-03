-- Migration: Three-Tier Local Model System
-- Date: 2025-01-03
-- Description: Complete three-tier local model configuration system

-- =====================================
-- STEP 1: EXTEND SCHEMA
-- =====================================

-- Add new columns to llm_models table for local model configuration
ALTER TABLE public.llm_models 
ADD COLUMN IF NOT EXISTS is_local BOOLEAN DEFAULT FALSE;

ALTER TABLE public.llm_models 
ADD COLUMN IF NOT EXISTS is_currently_loaded BOOLEAN DEFAULT FALSE;

ALTER TABLE public.llm_models 
ADD COLUMN IF NOT EXISTS model_tier VARCHAR(50);

ALTER TABLE public.llm_models 
ADD COLUMN IF NOT EXISTS loading_priority INTEGER DEFAULT 5;

-- Add comments for documentation
COMMENT ON COLUMN public.llm_models.is_local IS 'Indicates if this model runs locally (e.g., via Ollama)';
COMMENT ON COLUMN public.llm_models.is_currently_loaded IS 'Current loading status of local models';
COMMENT ON COLUMN public.llm_models.model_tier IS 'Performance tier: ultra-fast, general, fast-thinking';
COMMENT ON COLUMN public.llm_models.loading_priority IS 'Priority for loading local models (1-10, higher = more priority)';

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_llm_models_local_tier 
ON public.llm_models(is_local, model_tier, loading_priority) 
WHERE is_local = TRUE;

CREATE INDEX IF NOT EXISTS idx_llm_models_loading_status 
ON public.llm_models(is_currently_loaded, loading_priority) 
WHERE is_local = TRUE;

-- =====================================
-- STEP 2: ENSURE OLLAMA PROVIDER EXISTS
-- =====================================

-- Ensure Ollama provider exists (using INSERT ... ON CONFLICT for safety)
INSERT INTO public.llm_providers (
    id,
    name,
    display_name,
    api_base_url,
    is_active,
    created_at,
    updated_at
) VALUES (
    '27e27074-94a5-440c-9a5a-6bc8a949819f',
    'Ollama',
    'Ollama Local',
    'http://localhost:11434',
    TRUE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    display_name = EXCLUDED.display_name,
    api_base_url = EXCLUDED.api_base_url,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

-- =====================================
-- STEP 3: SEED THREE-TIER MODELS
-- =====================================

-- Insert ultra-fast tier models (1B-3B parameters)
INSERT INTO public.llm_models (
    provider_id,
    model_name,
    display_name,
    model_type,
    context_window,
    pricing_info_json,
    is_active,
    is_local,
    model_tier,
    loading_priority,
    is_currently_loaded
) VALUES 
-- Qwen2.5:1.5b - Ultra-fast, lightweight model
(
    '27e27074-94a5-440c-9a5a-6bc8a949819f',
    'qwen2.5:1.5b',
    'Qwen2.5 1.5B',
    'text-generation',
    32768,
    '{"input_cost_per_token": 0.0, "output_cost_per_token": 0.0, "currency": "USD"}'::jsonb,
    TRUE,
    TRUE,
    'ultra-fast',
    10,
    FALSE
),
-- Phi-3 Mini - Microsoft's efficient small model
(
    '27e27074-94a5-440c-9a5a-6bc8a949819f',
    'phi3:mini',
    'Phi-3 Mini',
    'text-generation',
    4096,
    '{"input_cost_per_token": 0.0, "output_cost_per_token": 0.0, "currency": "USD"}'::jsonb,
    TRUE,
    TRUE,
    'ultra-fast',
    9,
    FALSE
),
-- Gemma2:2b - Google's compact model
(
    '27e27074-94a5-440c-9a5a-6bc8a949819f',
    'gemma2:2b',
    'Gemma2 2B',
    'text-generation',
    8192,
    '{"input_cost_per_token": 0.0, "output_cost_per_token": 0.0, "currency": "USD"}'::jsonb,
    TRUE,
    TRUE,
    'ultra-fast',
    8,
    FALSE
)
ON CONFLICT (provider_id, model_name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    model_tier = EXCLUDED.model_tier,
    loading_priority = EXCLUDED.loading_priority,
    is_local = EXCLUDED.is_local,
    updated_at = CURRENT_TIMESTAMP;

-- Insert general tier models (7B-8B parameters)
INSERT INTO public.llm_models (
    provider_id,
    model_name,
    display_name,
    model_type,
    context_window,
    pricing_info_json,
    is_active,
    is_local,
    model_tier,
    loading_priority,
    is_currently_loaded
) VALUES 
-- Llama3.1:8b - Meta's balanced model
(
    '27e27074-94a5-440c-9a5a-6bc8a949819f',
    'llama3.1:8b',
    'Llama 3.1 8B',
    'text-generation',
    131072,
    '{"input_cost_per_token": 0.0, "output_cost_per_token": 0.0, "currency": "USD"}'::jsonb,
    TRUE,
    TRUE,
    'general',
    8,
    FALSE
),
-- Qwen2.5:7b - Alibaba's general purpose model
(
    '27e27074-94a5-440c-9a5a-6bc8a949819f',
    'qwen2.5:7b',
    'Qwen2.5 7B',
    'text-generation',
    32768,
    '{"input_cost_per_token": 0.0, "output_cost_per_token": 0.0, "currency": "USD"}'::jsonb,
    TRUE,
    TRUE,
    'general',
    7,
    FALSE
),
-- Mistral:7b - Mistral AI's efficient model
(
    '27e27074-94a5-440c-9a5a-6bc8a949819f',
    'mistral:7b',
    'Mistral 7B',
    'text-generation',
    32768,
    '{"input_cost_per_token": 0.0, "output_cost_per_token": 0.0, "currency": "USD"}'::jsonb,
    TRUE,
    TRUE,
    'general',
    6,
    FALSE
)
ON CONFLICT (provider_id, model_name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    model_tier = EXCLUDED.model_tier,
    loading_priority = EXCLUDED.loading_priority,
    is_local = EXCLUDED.is_local,
    updated_at = CURRENT_TIMESTAMP;

-- Insert fast-thinking tier models (13B+ parameters)
INSERT INTO public.llm_models (
    provider_id,
    model_name,
    display_name,
    model_type,
    context_window,
    pricing_info_json,
    is_active,
    is_local,
    model_tier,
    loading_priority,
    is_currently_loaded
) VALUES 
-- Qwen2.5:14b - Alibaba's larger reasoning model
(
    '27e27074-94a5-440c-9a5a-6bc8a949819f',
    'qwen2.5:14b',
    'Qwen2.5 14B',
    'text-generation',
    32768,
    '{"input_cost_per_token": 0.0, "output_cost_per_token": 0.0, "currency": "USD"}'::jsonb,
    TRUE,
    TRUE,
    'fast-thinking',
    8,
    FALSE
),
-- Llama3.1:70b - Meta's large reasoning model
(
    '27e27074-94a5-440c-9a5a-6bc8a949819f',
    'llama3.1:70b',
    'Llama 3.1 70B',
    'text-generation',
    131072,
    '{"input_cost_per_token": 0.0, "output_cost_per_token": 0.0, "currency": "USD"}'::jsonb,
    TRUE,
    TRUE,
    'fast-thinking',
    10,
    FALSE
),
-- DeepSeek Coder v2 - Specialized for coding tasks
(
    '27e27074-94a5-440c-9a5a-6bc8a949819f',
    'deepseek-coder-v2:16b',
    'DeepSeek Coder V2 16B',
    'text-generation',
    16384,
    '{"input_cost_per_token": 0.0, "output_cost_per_token": 0.0, "currency": "USD"}'::jsonb,
    TRUE,
    TRUE,
    'fast-thinking',
    9,
    FALSE
)
ON CONFLICT (provider_id, model_name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    model_tier = EXCLUDED.model_tier,
    loading_priority = EXCLUDED.loading_priority,
    is_local = EXCLUDED.is_local,
    updated_at = CURRENT_TIMESTAMP;

-- =====================================
-- STEP 4: UPDATE EXISTING OLLAMA MODELS
-- =====================================

-- Update existing Ollama models to set is_local=TRUE
UPDATE public.llm_models 
SET is_local = TRUE,
    updated_at = CURRENT_TIMESTAMP
WHERE provider_id = '27e27074-94a5-440c-9a5a-6bc8a949819f'
  AND (is_local IS NULL OR is_local = FALSE);

-- Update models by size patterns to assign appropriate tiers
-- Ultra-fast tier (1B-3B parameters)
UPDATE public.llm_models 
SET model_tier = 'ultra-fast',
    loading_priority = CASE 
        WHEN model_name LIKE '%1b%' OR model_name LIKE '%1.5b%' THEN 10
        WHEN model_name LIKE '%2b%' THEN 9
        WHEN model_name LIKE '%3b%' THEN 8
        ELSE 7
    END,
    is_currently_loaded = FALSE,
    updated_at = CURRENT_TIMESTAMP
WHERE provider_id = '27e27074-94a5-440c-9a5a-6bc8a949819f'
  AND (model_name LIKE '%1b%' OR model_name LIKE '%1.5b%' OR model_name LIKE '%2b%' OR model_name LIKE '%3b%')
  AND (model_tier IS NULL OR model_tier != 'ultra-fast');

-- General tier (7B-8B parameters)
UPDATE public.llm_models 
SET model_tier = 'general',
    loading_priority = CASE 
        WHEN model_name LIKE '%8b%' THEN 8
        WHEN model_name LIKE '%7b%' THEN 7
        ELSE 6
    END,
    is_currently_loaded = FALSE,
    updated_at = CURRENT_TIMESTAMP
WHERE provider_id = '27e27074-94a5-440c-9a5a-6bc8a949819f'
  AND (model_name LIKE '%7b%' OR model_name LIKE '%8b%')
  AND (model_tier IS NULL OR model_tier != 'general');

-- Fast-thinking tier (13B+ parameters)
UPDATE public.llm_models 
SET model_tier = 'fast-thinking',
    loading_priority = CASE 
        WHEN model_name LIKE '%70b%' THEN 10
        WHEN model_name LIKE '%20b%' THEN 9
        WHEN model_name LIKE '%16b%' THEN 9
        WHEN model_name LIKE '%14b%' THEN 8
        WHEN model_name LIKE '%13b%' THEN 8
        ELSE 7
    END,
    is_currently_loaded = FALSE,
    updated_at = CURRENT_TIMESTAMP
WHERE provider_id = '27e27074-94a5-440c-9a5a-6bc8a949819f'
  AND (model_name LIKE '%13b%' OR model_name LIKE '%14b%' OR model_name LIKE '%16b%' OR model_name LIKE '%20b%' OR model_name LIKE '%70b%')
  AND (model_tier IS NULL OR model_tier != 'fast-thinking');

-- Fallback: assign general tier to any remaining Ollama models
UPDATE public.llm_models 
SET model_tier = 'general',
    loading_priority = 5,
    is_currently_loaded = FALSE,
    updated_at = CURRENT_TIMESTAMP
WHERE provider_id = '27e27074-94a5-440c-9a5a-6bc8a949819f'
  AND model_tier IS NULL;

-- =====================================
-- STEP 5: VERIFICATION AND LOGGING
-- =====================================

-- Log the migration results
DO $$
DECLARE
    total_local_models INTEGER;
    ultra_fast_count INTEGER;
    general_count INTEGER;
    fast_thinking_count INTEGER;
BEGIN
    -- Count total local models
    SELECT COUNT(*) INTO total_local_models
    FROM public.llm_models 
    WHERE is_local = TRUE;
    
    -- Count by tier
    SELECT COUNT(*) INTO ultra_fast_count
    FROM public.llm_models 
    WHERE is_local = TRUE AND model_tier = 'ultra-fast';
    
    SELECT COUNT(*) INTO general_count
    FROM public.llm_models 
    WHERE is_local = TRUE AND model_tier = 'general';
    
    SELECT COUNT(*) INTO fast_thinking_count
    FROM public.llm_models 
    WHERE is_local = TRUE AND model_tier = 'fast-thinking';
    
    -- Log the results
    RAISE NOTICE '=== Three-Tier Local Model Configuration Complete ===';
    RAISE NOTICE 'Total local models: %', total_local_models;
    RAISE NOTICE 'Ultra-fast tier: % models', ultra_fast_count;
    RAISE NOTICE 'General tier: % models', general_count;
    RAISE NOTICE 'Fast-thinking tier: % models', fast_thinking_count;
    RAISE NOTICE '=== Migration completed successfully ===';
END $$;
