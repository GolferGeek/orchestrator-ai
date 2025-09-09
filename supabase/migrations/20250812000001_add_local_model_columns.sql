-- Migration: Add Local Model Columns to llm_models table
-- Date: 2025-01-03
-- Description: Add columns needed for three-tier local model configuration

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
