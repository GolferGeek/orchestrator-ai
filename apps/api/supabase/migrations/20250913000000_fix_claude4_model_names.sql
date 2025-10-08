-- Fix Claude 4 model names to match Anthropic API
-- Migration to update database model names to correct Anthropic API model names

-- Update Claude 4 Opus model name to Opus 4.1
UPDATE public.llm_models
SET model_name = 'claude-opus-4-1-20250805',
    display_name = 'Claude Opus 4.1'
WHERE model_name = 'claude-4-opus' AND provider_name = 'anthropic';

-- Update Claude 4 Sonnet model name
UPDATE public.llm_models
SET model_name = 'claude-sonnet-4-20250514',
    display_name = 'Claude Sonnet 4'
WHERE model_name = 'claude-4-sonnet' AND provider_name = 'anthropic';

-- Verify the updates
-- SELECT model_name, provider_name, display_name FROM public.llm_models 
-- WHERE provider_name = 'anthropic' AND model_name LIKE '%4%';