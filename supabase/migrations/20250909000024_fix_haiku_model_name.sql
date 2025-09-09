-- Fix Haiku model name (3.5 -> 3-5)
-- Migration: 20250909000024_fix_haiku_model_name.sql

-- Fix Anthropic Haiku model name (3.5 -> 3-5)
UPDATE llm_models 
SET model_name = 'claude-3-5-haiku-20241022'
WHERE model_name = 'claude-3.5-haiku-20241022' AND provider_name = 'anthropic';

-- Verify the change
SELECT 'After migration - Anthropic models:' as status;
SELECT model_name, provider_name 
FROM llm_models 
WHERE provider_name = 'anthropic'
ORDER BY model_name;
