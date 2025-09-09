-- Fix model names and remove problematic models
-- Migration: 20250909000023_fix_model_names.sql

-- Fix Anthropic Sonnet model name (3.5 -> 3-5)
UPDATE llm_models 
SET model_name = 'claude-3-5-sonnet'
WHERE model_name = 'claude-3.5-sonnet' AND provider_name = 'anthropic';

-- Remove problematic Ollama models
DELETE FROM llm_models 
WHERE model_name IN ('deepseek-r1:70b', 'gpt-oss:120b', 'gpt-oss:20b') 
AND provider_name = 'ollama';

-- Verify the changes
SELECT 'After migration - remaining models:' as status;
SELECT model_name, provider_name 
FROM llm_models 
WHERE provider_name IN ('anthropic', 'ollama')
ORDER BY provider_name, model_name;
