-- Migration: Three-Tier Local Model Configuration
-- Date: 2025-01-03
-- Description: Extend llm_models table with local model configuration, seed with three-tier models, and update existing Ollama models

-- =====================================
-- SCHEMA EXTENSION
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

-- Create index for efficient queries by tier and local status
CREATE INDEX IF NOT EXISTS idx_llm_models_local_tier 
ON public.llm_models(is_local, model_tier, loading_priority) 
WHERE is_local = TRUE;

-- Create index for loading status queries
CREATE INDEX IF NOT EXISTS idx_llm_models_loading_status 
ON public.llm_models(is_currently_loaded, loading_priority) 
WHERE is_local = TRUE;

-- Add unique constraint for provider_id and model_name combination
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'llm_models_provider_model_unique' 
        AND table_name = 'llm_models'
    ) THEN
        ALTER TABLE public.llm_models 
        ADD CONSTRAINT llm_models_provider_model_unique 
        UNIQUE (provider_id, model_name);
    END IF;
END $$;

-- =====================================
-- SEED DATA - THREE-TIER LOCAL MODELS
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

-- Insert ultra-fast tier models (1B-3B parameters)
INSERT INTO public.llm_models (
    id,
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
    is_currently_loaded,
    created_at,
    updated_at
) VALUES 
-- Qwen2.5:1.5b - Ultra-fast, lightweight model
(
    uuid_generate_v4(),
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
    FALSE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
-- Phi-3 Mini - Microsoft's efficient small model
(
    uuid_generate_v4(),
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
    FALSE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
-- Gemma2:2b - Google's compact model
(
    uuid_generate_v4(),
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
    FALSE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (provider_id, model_name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    model_tier = EXCLUDED.model_tier,
    loading_priority = EXCLUDED.loading_priority,
    is_local = EXCLUDED.is_local,
    updated_at = CURRENT_TIMESTAMP;

-- Insert general tier models (7B-8B parameters)
INSERT INTO public.llm_models (
    id,
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
    is_currently_loaded,
    created_at,
    updated_at
) VALUES 
-- Llama3.1:8b - Meta's balanced model
(
    uuid_generate_v4(),
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
    FALSE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
-- Qwen2.5:7b - Alibaba's general purpose model
(
    uuid_generate_v4(),
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
    FALSE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
-- Mistral:7b - Mistral AI's efficient model
(
    uuid_generate_v4(),
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
    FALSE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (provider_id, model_name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    model_tier = EXCLUDED.model_tier,
    loading_priority = EXCLUDED.loading_priority,
    is_local = EXCLUDED.is_local,
    updated_at = CURRENT_TIMESTAMP;

-- Insert fast-thinking tier models (13B+ parameters)
INSERT INTO public.llm_models (
    id,
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
    is_currently_loaded,
    created_at,
    updated_at
) VALUES 
-- Qwen2.5:14b - Alibaba's larger reasoning model
(
    uuid_generate_v4(),
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
    FALSE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
-- Llama3.1:70b - Meta's large reasoning model
(
    uuid_generate_v4(),
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
    FALSE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
-- DeepSeek Coder v2 - Specialized for coding tasks
(
    uuid_generate_v4(),
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
    FALSE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (provider_id, model_name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    model_tier = EXCLUDED.model_tier,
    loading_priority = EXCLUDED.loading_priority,
    is_local = EXCLUDED.is_local,
    updated_at = CURRENT_TIMESTAMP;

-- =====================================
-- UPDATE EXISTING OLLAMA MODELS
-- =====================================

-- Update existing Ollama models to set is_local=TRUE
UPDATE public.llm_models 
SET is_local = TRUE,
    updated_at = CURRENT_TIMESTAMP
WHERE provider_id = '27e27074-94a5-440c-9a5a-6bc8a949819f'
  AND (is_local IS NULL OR is_local = FALSE);

-- Update existing models with tier configuration based on model names
-- Update models that contain "1b" or "3b" to ultra-fast tier
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

-- Update models that contain "7b" or "8b" to general tier
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

-- Update models that contain "13b", "14b", "16b", "20b", "70b" or larger to fast-thinking tier
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

-- Update any remaining Ollama models without a tier to general (fallback)
UPDATE public.llm_models 
SET model_tier = 'general',
    loading_priority = 5,
    is_currently_loaded = FALSE,
    updated_at = CURRENT_TIMESTAMP
WHERE provider_id = '27e27074-94a5-440c-9a5a-6bc8a949819f'
  AND model_tier IS NULL;

-- =====================================
-- FINAL LOGGING AND VALIDATION
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
