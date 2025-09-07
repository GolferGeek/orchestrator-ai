-- Update LLM models to reflect current available models (2025)
-- This migration updates the model configurations to use currently available models
-- instead of outdated ones like llama3.1 and qwen2.5

-- First, let's clear out the old model configurations
DELETE FROM llm_models WHERE model_name IN (
  'llama3.1:8b',
  'llama3.1:70b', 
  'llama3.2:1b',
  'qwen2.5:1.5b',
  'qwen2.5:7b',
  'qwen2.5:14b'
);

-- Insert or update current available models with updated three-tier configuration
INSERT INTO llm_models (
  provider_id,
  model_name,
  display_name,
  model_type,
  context_window,
  max_output_tokens,
  pricing_info_json,
  model_parameters_json,
  capabilities,
  is_active,
  is_local,
  model_tier,
  loading_priority,
  is_currently_loaded
) VALUES

-- Ultra-Fast Tier Models (for quick responses, simple tasks)
(
  (SELECT id FROM llm_providers WHERE name = 'Ollama'),
  'llama3.2:latest',
  'Llama 3.2 Latest',
  'text-generation',
  128000,
  4096,
  '{"input_cost_per_token": 0.0, "output_cost_per_token": 0.0}'::jsonb,
  '{"local": true, "tier": "ultra-fast", "priority": 1, "description": "Fast, lightweight model for quick responses"}'::jsonb,
  '["streaming", "local", "fast-response"]'::jsonb,
  true,
  true,
  'ultra-fast',
  10,
  false
),

-- General Tier Models (balanced performance and capability)
(
  (SELECT id FROM llm_providers WHERE name = 'Ollama'),
  'qwen3:8b',
  'Qwen 3 8B',
  'text-generation',
  32768,
  4096,
  '{"input_cost_per_token": 0.0, "output_cost_per_token": 0.0}'::jsonb,
  '{"local": true, "tier": "general", "priority": 1, "description": "Latest Qwen model with excellent performance"}'::jsonb,
  '["streaming", "local", "multilingual", "reasoning"]'::jsonb,
  true,
  true,
  'general',
  9,
  false
),

(
  (SELECT id FROM llm_providers WHERE name = 'Ollama'),
  'deepseek-r1:latest',
  'DeepSeek R1 Latest',
  'text-generation',
  64000,
  4096,
  '{"input_cost_per_token": 0.0, "output_cost_per_token": 0.0}'::jsonb,
  '{"local": true, "tier": "general", "priority": 2, "description": "Advanced reasoning model for complex tasks"}'::jsonb,
  '["streaming", "local", "reasoning", "analysis"]'::jsonb,
  true,
  true,
  'general',
  8,
  false
),

-- Fast-Thinking Tier Models (for complex reasoning and analysis)
(
  (SELECT id FROM llm_providers WHERE name = 'Ollama'),
  'deepseek-r1:70b',
  'DeepSeek R1 70B',
  'text-generation',
  64000,
  4096,
  '{"input_cost_per_token": 0.0, "output_cost_per_token": 0.0}'::jsonb,
  '{"local": true, "tier": "fast-thinking", "priority": 1, "description": "Large reasoning model for complex analysis"}'::jsonb,
  '["streaming", "local", "reasoning", "analysis", "complex-tasks"]'::jsonb,
  true,
  true,
  'fast-thinking',
  10,
  false
),

(
  (SELECT id FROM llm_providers WHERE name = 'Ollama'),
  'qwq:latest',
  'QwQ Latest',
  'text-generation',
  32768,
  4096,
  '{"input_cost_per_token": 0.0, "output_cost_per_token": 0.0}'::jsonb,
  '{"local": true, "tier": "fast-thinking", "priority": 2, "description": "Specialized reasoning model for analytical tasks"}'::jsonb,
  '["streaming", "local", "reasoning", "question-answering"]'::jsonb,
  true,
  true,
  'fast-thinking',
  9,
  false
),

-- Bonus: GPT-OSS model (if available)
(
  (SELECT id FROM llm_providers WHERE name = 'Ollama'),
  'gpt-oss:20b',
  'GPT-OSS 20B',
  'text-generation',
  8192,
  4096,
  '{"input_cost_per_token": 0.0, "output_cost_per_token": 0.0}'::jsonb,
  '{"local": true, "tier": "fast-thinking", "priority": 3, "description": "Open source GPT model with good capabilities"}'::jsonb,
  '["streaming", "local", "gpt-style"]'::jsonb,
  true,
  true,
  'fast-thinking',
  7,
  false
)

ON CONFLICT (provider_id, model_name) 
DO UPDATE SET
  display_name = EXCLUDED.display_name,
  model_type = EXCLUDED.model_type,
  context_window = EXCLUDED.context_window,
  max_output_tokens = EXCLUDED.max_output_tokens,
  pricing_info_json = EXCLUDED.pricing_info_json,
  model_parameters_json = EXCLUDED.model_parameters_json,
  capabilities = EXCLUDED.capabilities,
  is_active = EXCLUDED.is_active,
  is_local = EXCLUDED.is_local,
  model_tier = EXCLUDED.model_tier,
  loading_priority = EXCLUDED.loading_priority,
  updated_at = CURRENT_TIMESTAMP;

-- Update any existing routing configurations to use new model names
-- This ensures the system will route to available models
COMMENT ON TABLE llm_models IS 'Updated with current Ollama models available in 2025: llama3.2, qwen3, deepseek-r1, qwq, gpt-oss';