-- Add back gpt-oss-20b model for Ollama
-- Migration: 20250909000026_add_back_gpt_oss_20b.sql

-- Insert gpt-oss-20b back into the models (if not already exists)
INSERT INTO llm_models (model_name, provider_name, context_window, max_output_tokens, is_local, created_at, updated_at)
VALUES (
  'gpt-oss:20b',
  'ollama',
  8192,
  4096,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (provider_name, model_name) DO NOTHING;

-- Verify the addition
SELECT 'After migration - Ollama models:' as status;
SELECT model_name, provider_name 
FROM llm_models 
WHERE provider_name = 'ollama'
ORDER BY model_name;
