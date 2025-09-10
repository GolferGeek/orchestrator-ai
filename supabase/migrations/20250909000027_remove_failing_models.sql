-- Remove models that are failing in testing
-- Migration: 20250909000027_remove_failing_models.sql

-- Remove all Anthropic models (all timing out)
DELETE FROM llm_models WHERE provider_name = 'anthropic';

-- Remove failing Google models (keep only gemini-2.0-flash which works)
DELETE FROM llm_models 
WHERE provider_name = 'google' 
AND model_name IN ('gemini-2.0-pro', 'gemini-2.5-flash', 'gemini-2.5-pro');

-- Remove all Grok models (all returning internal server errors)
DELETE FROM llm_models WHERE provider_name = 'grok';

-- Verify remaining models
SELECT 'After cleanup - remaining models by provider:' as status;
SELECT provider_name, COUNT(*) as model_count, 
       STRING_AGG(model_name, ', ' ORDER BY model_name) as models
FROM llm_models 
GROUP BY provider_name 
ORDER BY provider_name;
