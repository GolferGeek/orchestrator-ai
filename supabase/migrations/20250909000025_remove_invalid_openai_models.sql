-- Remove invalid OpenAI models that don't work or don't exist
-- Migration: 20250909000025_remove_invalid_openai_models.sql

-- Remove o1 models that are not working
-- o1-mini: times out (60+ seconds)
-- o1-preview: model not found (404 error from OpenAI API)
DELETE FROM llm_models 
WHERE model_name IN ('o1-mini', 'o1-preview') 
AND provider_name = 'openai';

-- Verify the remaining OpenAI models
SELECT 'After migration - remaining OpenAI models:' as status;
SELECT model_name, provider_name 
FROM llm_models 
WHERE provider_name = 'openai'
ORDER BY model_name;
