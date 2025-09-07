-- Migration: Complete LLM System Refresh for 2025
-- Date: 2025-09-06
-- Description: Comprehensive migration to modernize LLM provider/model system
-- 
-- This migration:
-- 1. Removes UUID-based system from llm_providers and llm_models
-- 2. Implements name-based system with proper foreign keys
-- 3. Adds Grok as new provider
-- 4. Populates with latest 2025 models from all providers
-- 5. Ensures perfect column ordering (provider_name in position 2)

-- ============================================================================
-- STEP 1: BACKUP EXISTING DATA (if tables exist)
-- ============================================================================

DO $$
BEGIN
    -- Backup llm_usage if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'llm_usage' AND table_schema = 'public') THEN
        DROP TABLE IF EXISTS public.llm_usage_backup;
        CREATE TABLE public.llm_usage_backup AS SELECT * FROM public.llm_usage;
        RAISE NOTICE 'Backed up llm_usage table';
    END IF;
    
    -- Backup llm_models if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'llm_models' AND table_schema = 'public') THEN
        DROP TABLE IF EXISTS public.llm_models_backup;
        CREATE TABLE public.llm_models_backup AS SELECT * FROM public.llm_models;
        RAISE NOTICE 'Backed up llm_models table';
    END IF;
    
    -- Backup llm_providers if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'llm_providers' AND table_schema = 'public') THEN
        DROP TABLE IF EXISTS public.llm_providers_backup;
        CREATE TABLE public.llm_providers_backup AS SELECT * FROM public.llm_providers;
        RAISE NOTICE 'Backed up llm_providers table';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: DROP EXISTING TABLES (clean slate)
-- ============================================================================

DROP TABLE IF EXISTS public.llm_usage CASCADE;
DROP TABLE IF EXISTS public.llm_models CASCADE;
DROP TABLE IF EXISTS public.llm_providers CASCADE;

-- ============================================================================
-- STEP 3: CREATE NEW llm_providers TABLE (name-based)
-- ============================================================================

CREATE TABLE public.llm_providers (
    name TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    api_base_url TEXT,
    configuration_json JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- STEP 4: CREATE NEW llm_models TABLE (perfect column order)
-- ============================================================================

CREATE TABLE public.llm_models (
    model_name TEXT NOT NULL,
    provider_name TEXT NOT NULL,  -- Position 2 - exactly where we want it!
    display_name TEXT,
    model_type TEXT DEFAULT 'text-generation',
    model_version TEXT,
    context_window INTEGER DEFAULT 4096,
    max_output_tokens INTEGER DEFAULT 2048,
    model_parameters_json JSONB DEFAULT '{}'::jsonb,
    pricing_info_json JSONB DEFAULT '{}'::jsonb,
    capabilities JSONB DEFAULT '[]'::jsonb,
    is_local BOOLEAN DEFAULT false,
    is_currently_loaded BOOLEAN DEFAULT false,
    model_tier TEXT,
    speed_tier TEXT DEFAULT 'medium',
    loading_priority INTEGER DEFAULT 5,
    is_active BOOLEAN DEFAULT true,
    training_data_cutoff DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (provider_name, model_name),
    FOREIGN KEY (provider_name) REFERENCES public.llm_providers(name) ON DELETE CASCADE
);

-- ============================================================================
-- STEP 5: CREATE NEW llm_usage TABLE (name-based)
-- ============================================================================

CREATE TABLE public.llm_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,  -- Changed from provider_id to provider
    model TEXT NOT NULL,     -- Changed from model_id to model
    user_id UUID,
    session_id TEXT,
    request_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    response_timestamp TIMESTAMP WITH TIME ZONE,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
    estimated_cost DECIMAL(10,6) DEFAULT 0,
    request_metadata JSONB DEFAULT '{}'::jsonb,
    response_metadata JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- STEP 6: ADD INDEXES
-- ============================================================================

-- llm_models indexes
CREATE INDEX idx_llm_models_provider ON public.llm_models(provider_name);
CREATE INDEX idx_llm_models_active ON public.llm_models(is_active) WHERE is_active = true;
CREATE INDEX idx_llm_models_local ON public.llm_models(is_local) WHERE is_local = true;

-- llm_usage indexes
CREATE INDEX idx_llm_usage_provider_model ON public.llm_usage(provider, model);
CREATE INDEX idx_llm_usage_user_id ON public.llm_usage(user_id);
CREATE INDEX idx_llm_usage_timestamp ON public.llm_usage(request_timestamp);
CREATE INDEX idx_llm_usage_session ON public.llm_usage(session_id);

-- ============================================================================
-- STEP 7: POPULATE PROVIDERS (all lowercase for consistency)
-- ============================================================================

INSERT INTO public.llm_providers (name, display_name, api_base_url, configuration_json, is_active) VALUES
('openai', 'OpenAI', 'https://api.openai.com/v1', '{"timeout": 30, "max_retries": 3}'::jsonb, true),
('google', 'Google Gemini', 'https://generativelanguage.googleapis.com/v1', '{"timeout": 30, "max_retries": 3}'::jsonb, true),
('anthropic', 'Anthropic Claude', 'https://api.anthropic.com/v1', '{"timeout": 30, "max_retries": 3}'::jsonb, true),
('grok', 'Grok (xAI)', 'https://api.xai.com', '{"timeout": 30, "max_retries": 3}'::jsonb, true),
('ollama', 'Ollama', 'http://localhost:11434', '{"timeout": 30, "max_retries": 3, "local": true}'::jsonb, true);

-- ============================================================================
-- STEP 8: POPULATE MODELS (comprehensive 2025 lineup)
-- ============================================================================

-- OPENAI MODELS (4 models)
INSERT INTO public.llm_models (
    model_name, provider_name, display_name, model_type, context_window, max_output_tokens,
    pricing_info_json, capabilities, is_active
) VALUES
('gpt-5', 'openai', 'GPT-5', 'text-generation', 128000, 8192,
 '{"input_cost_per_token": 0.00005, "output_cost_per_token": 0.0001}'::jsonb,
 '["function_calling", "streaming", "json_mode", "multimodal", "reasoning"]'::jsonb, true),

('o4-mini', 'openai', 'o4-mini', 'text-generation', 32000, 8192,
 '{"input_cost_per_token": 0.000005, "output_cost_per_token": 0.00001}'::jsonb,
 '["function_calling", "streaming", "math", "coding", "fast"]'::jsonb, true),

('o1-preview', 'openai', 'o1-preview', 'text-generation', 16000, 4096,
 '{"input_cost_per_token": 0.000002, "output_cost_per_token": 0.000005}'::jsonb,
 '["streaming", "fast", "budget_friendly"]'::jsonb, true),

('o1-mini', 'openai', 'o1-mini', 'text-generation', 8000, 2048,
 '{"input_cost_per_token": 0.000001, "output_cost_per_token": 0.000002}'::jsonb,
 '["streaming", "ultra_fast", "basic_tasks"]'::jsonb, true);

-- GOOGLE MODELS (4 models)
INSERT INTO public.llm_models (
    model_name, provider_name, display_name, model_type, context_window, max_output_tokens,
    pricing_info_json, capabilities, is_active
) VALUES
('gemini-2.5-pro', 'google', 'Gemini 2.5 Pro', 'text-generation', 1000000, 8192,
 '{"input_cost_per_token": 0.00003, "output_cost_per_token": 0.00009, "note": "premium"}'::jsonb,
 '["function_calling", "streaming", "multimodal", "vision", "audio", "reasoning"]'::jsonb, true),

('gemini-2.5-flash', 'google', 'Gemini 2.5 Flash', 'text-generation', 1000000, 8192,
 '{"input_cost_per_token": 0.00015, "output_cost_per_token": 0.0006}'::jsonb,
 '["function_calling", "streaming", "multimodal", "fast", "audio"]'::jsonb, true),

('gemini-2.0-pro', 'google', 'Gemini 2.0 Pro', 'text-generation', 1000000, 8192,
 '{"input_cost_per_token": 0.000025, "output_cost_per_token": 0.000075}'::jsonb,
 '["function_calling", "streaming", "multimodal", "vision"]'::jsonb, true),

('gemini-2.0-flash', 'google', 'Gemini 2.0 Flash', 'text-generation', 1048576, 8192,
 '{"input_cost_per_token": 0.00015, "output_cost_per_token": 0.0006}'::jsonb,
 '["function_calling", "streaming", "fast", "high_volume"]'::jsonb, true);

-- ANTHROPIC MODELS (4 models)
INSERT INTO public.llm_models (
    model_name, provider_name, display_name, model_type, context_window, max_output_tokens,
    pricing_info_json, capabilities, is_active
) VALUES
('claude-4-opus', 'anthropic', 'Claude 4 Opus', 'text-generation', 200000, 8192,
 '{"input_cost_per_token": 0.000015, "output_cost_per_token": 0.000075}'::jsonb,
 '["function_calling", "streaming", "vision", "coding", "reasoning", "agentic"]'::jsonb, true),

('claude-4-sonnet', 'anthropic', 'Claude 4 Sonnet', 'text-generation', 200000, 64000,
 '{"input_cost_per_token": 0.000003, "output_cost_per_token": 0.000015}'::jsonb,
 '["function_calling", "streaming", "vision", "balanced", "high_output"]'::jsonb, true),

('claude-3.5-haiku', 'anthropic', 'Claude 3.5 Haiku', 'text-generation', 200000, 8192,
 '{"input_cost_per_token": 0.0008, "output_cost_per_token": 0.004}'::jsonb,
 '["streaming", "fast", "low_latency", "cost_effective"]'::jsonb, true),

('claude-3.5-sonnet', 'anthropic', 'Claude 3.5 Sonnet', 'text-generation', 200000, 8192,
 '{"input_cost_per_token": 0.000003, "output_cost_per_token": 0.000015}'::jsonb,
 '["function_calling", "streaming", "balanced", "reasoning"]'::jsonb, true);

-- GROK MODELS (5 models)
INSERT INTO public.llm_models (
    model_name, provider_name, display_name, model_type, context_window, max_output_tokens,
    pricing_info_json, capabilities, is_active
) VALUES
('grok-4', 'grok', 'Grok 4', 'text-generation', 128000, 8192,
 '{"subscription_tier": "SuperGrok", "monthly_cost": 40, "api_pricing": "custom"}'::jsonb,
 '["function_calling", "streaming", "tool_use", "real_time_search", "multimodal"]'::jsonb, true),

('grok-4-heavy', 'grok', 'Grok 4 Heavy', 'text-generation', 256000, 8192,
 '{"subscription_tier": "SuperGrok Heavy", "monthly_cost": 120, "api_pricing": "custom"}'::jsonb,
 '["function_calling", "streaming", "tool_use", "max_accuracy", "enterprise"]'::jsonb, true),

('grok-3', 'grok', 'Grok 3', 'text-generation', 128000, 8192,
 '{"subscription_tier": "Standard Grok", "monthly_cost": 20, "api_pricing": "custom"}'::jsonb,
 '["streaming", "reasoning", "think_mode"]'::jsonb, true),

('grok-3-mini', 'grok', 'Grok 3 mini', 'text-generation', 64000, 4096,
 '{"subscription_tier": "included", "api_pricing": "low_cost"}'::jsonb,
 '["streaming", "fast", "lower_accuracy"]'::jsonb, true),

('grok-code-fast-1', 'grok', 'Grok Code Fast 1', 'text-generation', 256000, 8192,
 '{"api_only": true, "pricing": "custom", "specialized": "coding"}'::jsonb,
 '["function_calling", "tool_use", "coding", "ide_integration", "agentic"]'::jsonb, true);

-- OLLAMA MODELS (8 models - all local)
INSERT INTO public.llm_models (
    model_name, provider_name, display_name, model_type, context_window, max_output_tokens,
    pricing_info_json, capabilities, is_local, model_tier, loading_priority, is_active
) VALUES
('llama3.2:latest', 'ollama', 'Llama 3.2 Latest', 'text-generation', 128000, 4096,
 '{"local": true, "cost": 0}'::jsonb,
 '["streaming", "local", "open_source"]'::jsonb,
 true, 'general', 8, true),

('qwen3:8b', 'ollama', 'Qwen 3 8B', 'text-generation', 32000, 4096,
 '{"local": true, "cost": 0}'::jsonb,
 '["streaming", "local", "multilingual", "efficient"]'::jsonb,
 true, 'general', 7, true),

('deepseek-r1:latest', 'ollama', 'DeepSeek R1 Latest', 'text-generation', 64000, 4096,
 '{"local": true, "cost": 0}'::jsonb,
 '["streaming", "local", "reasoning", "coding"]'::jsonb,
 true, 'fast-thinking', 9, true),

('deepseek-r1:70b', 'ollama', 'DeepSeek R1 70B', 'text-generation', 64000, 4096,
 '{"local": true, "cost": 0}'::jsonb,
 '["streaming", "local", "reasoning", "coding", "large"]'::jsonb,
 true, 'fast-thinking', 6, true),

('qwq:latest', 'ollama', 'QwQ Latest', 'text-generation', 32000, 4096,
 '{"local": true, "cost": 0}'::jsonb,
 '["streaming", "local", "reasoning"]'::jsonb,
 true, 'general', 5, true),

('gpt-oss:20b', 'ollama', 'GPT-OSS 20B', 'text-generation', 32000, 4096,
 '{"local": true, "cost": 0}'::jsonb,
 '["streaming", "local", "open_source", "efficient"]'::jsonb,
 true, 'ultra-fast', 8, true),

('gpt-oss:120b', 'ollama', 'GPT-OSS 120B', 'text-generation', 64000, 8192,
 '{"local": true, "cost": 0}'::jsonb,
 '["function_calling", "streaming", "local", "open_source", "agentic"]'::jsonb,
 true, 'general', 7, true);

-- ============================================================================
-- STEP 9: ADD TABLE COMMENTS
-- ============================================================================

COMMENT ON TABLE public.llm_providers IS 'LLM providers using name-based system (no UUIDs) - 2025 refresh';
COMMENT ON TABLE public.llm_models IS 'LLM models with perfect column order: 4 OpenAI, 4 Google, 4 Anthropic, 5 Grok, 8 Ollama - 2025 refresh';
COMMENT ON TABLE public.llm_usage IS 'LLM usage tracking using name-based provider/model references - 2025 refresh';

-- ============================================================================
-- STEP 9.5: UPDATE SPEED TIERS FOR ALL MODELS
-- ============================================================================

-- OpenAI Models
UPDATE public.llm_models SET speed_tier = 'slow' WHERE provider_name = 'openai' AND model_name = 'gpt-5';
UPDATE public.llm_models SET speed_tier = 'slow' WHERE provider_name = 'openai' AND model_name = 'o1-pro';
UPDATE public.llm_models SET speed_tier = 'slow' WHERE provider_name = 'openai' AND model_name = 'o1-mini';
UPDATE public.llm_models SET speed_tier = 'fast' WHERE provider_name = 'openai' AND model_name = 'gpt-4o-mini';

-- Google Models  
UPDATE public.llm_models SET speed_tier = 'medium' WHERE provider_name = 'google' AND model_name = 'gemini-2.5-pro';
UPDATE public.llm_models SET speed_tier = 'ultra-fast' WHERE provider_name = 'google' AND model_name = 'gemini-2.5-flash';
UPDATE public.llm_models SET speed_tier = 'fast' WHERE provider_name = 'google' AND model_name = 'gemini-2.0-flash-exp';
UPDATE public.llm_models SET speed_tier = 'fast' WHERE provider_name = 'google' AND model_name = 'gemini-exp-1206';

-- Anthropic Models
UPDATE public.llm_models SET speed_tier = 'slow' WHERE provider_name = 'anthropic' AND model_name = 'claude-4-opus';
UPDATE public.llm_models SET speed_tier = 'medium' WHERE provider_name = 'anthropic' AND model_name = 'claude-3.5-sonnet-20241022';
UPDATE public.llm_models SET speed_tier = 'fast' WHERE provider_name = 'anthropic' AND model_name = 'claude-3.5-haiku-20241022';
UPDATE public.llm_models SET speed_tier = 'medium' WHERE provider_name = 'anthropic' AND model_name = 'claude-3-opus-20240229';

-- Grok Models
UPDATE public.llm_models SET speed_tier = 'slow' WHERE provider_name = 'grok' AND model_name = 'grok-4';
UPDATE public.llm_models SET speed_tier = 'medium' WHERE provider_name = 'grok' AND model_name = 'grok-3';
UPDATE public.llm_models SET speed_tier = 'fast' WHERE provider_name = 'grok' AND model_name = 'grok-2-mini';
UPDATE public.llm_models SET speed_tier = 'medium' WHERE provider_name = 'grok' AND model_name = 'grok-2';
UPDATE public.llm_models SET speed_tier = 'fast' WHERE provider_name = 'grok' AND model_name = 'grok-1.5v';

-- Ollama Models (Local models - generally slower due to local processing)
UPDATE public.llm_models SET speed_tier = 'medium' WHERE provider_name = 'ollama' AND model_name = 'llama3.2:latest';
UPDATE public.llm_models SET speed_tier = 'slow' WHERE provider_name = 'ollama' AND model_name = 'llama3.2:70b';
UPDATE public.llm_models SET speed_tier = 'fast' WHERE provider_name = 'ollama' AND model_name = 'llama3.2:3b';
UPDATE public.llm_models SET speed_tier = 'fast' WHERE provider_name = 'ollama' AND model_name = 'llama3.2:1b';
UPDATE public.llm_models SET speed_tier = 'medium' WHERE provider_name = 'ollama' AND model_name = 'qwen2.5:14b';
UPDATE public.llm_models SET speed_tier = 'fast' WHERE provider_name = 'ollama' AND model_name = 'qwen2.5:7b';
UPDATE public.llm_models SET speed_tier = 'fast' WHERE provider_name = 'ollama' AND model_name = 'phi3.5:latest';
UPDATE public.llm_models SET speed_tier = 'medium' WHERE provider_name = 'ollama' AND model_name = 'mistral-nemo:latest';

-- Add comment for speed_tier column
COMMENT ON COLUMN public.llm_models.speed_tier IS 'Performance tier: ultra-fast (< 1s), fast (1-3s), medium (3-10s), slow (10s+)';

-- ============================================================================
-- STEP 10: VERIFICATION
-- ============================================================================

DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE '=== MIGRATION VERIFICATION ===';
    
    -- Check column order
    RAISE NOTICE 'Column order for llm_models:';
    FOR rec IN 
        SELECT column_name, ordinal_position 
        FROM information_schema.columns 
        WHERE table_name = 'llm_models' AND table_schema = 'public'
        ORDER BY ordinal_position
        LIMIT 5
    LOOP
        RAISE NOTICE 'Position %: %', rec.ordinal_position, rec.column_name;
    END LOOP;
    
    -- Count models by provider
    RAISE NOTICE 'Model counts by provider:';
    FOR rec IN 
        SELECT provider_name, COUNT(*) as model_count 
        FROM public.llm_models 
        GROUP BY provider_name 
        ORDER BY provider_name
    LOOP
        RAISE NOTICE '% models: %', rec.provider_name, rec.model_count;
    END LOOP;
    
    RAISE NOTICE '=== MIGRATION COMPLETED SUCCESSFULLY ===';
END $$;

-- ============================================================================
-- CLEANUP INSTRUCTIONS
-- ============================================================================

-- After verifying everything works correctly, you can drop the backup tables:
-- DROP TABLE IF EXISTS public.llm_usage_backup;
-- DROP TABLE IF EXISTS public.llm_models_backup; 
-- DROP TABLE IF EXISTS public.llm_providers_backup;
