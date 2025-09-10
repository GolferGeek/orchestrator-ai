-- Fix Haiku model name - should be claude-3-haiku-20240307, not claude-3-7-haiku-20240307
-- Migration: 20250909000024_fix_haiku_model_name.sql

UPDATE llm_models 
SET model_name = 'claude-3-haiku-20240307'
WHERE model_name = 'claude-3-7-haiku-20240307' 
AND provider_name = 'anthropic';

-- Verify the fix
SELECT 'After migration - Haiku model name:' as status;
SELECT model_name, provider_name 
FROM llm_models 
WHERE model_name LIKE '%haiku%'
ORDER BY model_name;
