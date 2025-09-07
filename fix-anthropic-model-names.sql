-- Fix Anthropic model names: replace dots with hyphens
-- This fixes the 404 error: model claude-3.5-haiku-20241022 was not found

-- First, insert the corrected model entries
INSERT INTO public.llm_models (
    model_name, provider_name, display_name, model_type, context_window, max_output_tokens,
    pricing_info_json, capabilities, is_active
) VALUES
-- Corrected Claude 3.5 Haiku (dots → hyphens)
('claude-3-5-haiku-20241022', 'anthropic', 'Claude 3.5 Haiku', 'text-generation', 200000, 8192,
 '{"input_cost_per_token": 0.000001, "output_cost_per_token": 0.000005}'::jsonb,
 '["streaming", "fast", "low_latency", "cost_effective"]'::jsonb, true),

-- Corrected Claude 3.5 Sonnet (dots → hyphens)  
('claude-3-5-sonnet-20241022', 'anthropic', 'Claude 3.5 Sonnet', 'text-generation', 200000, 8192,
 '{"input_cost_per_token": 0.000003, "output_cost_per_token": 0.000015}'::jsonb,
 '["function_calling", "streaming", "balanced", "reasoning"]'::jsonb, true);

-- Update speed tiers for the new entries
UPDATE public.llm_models SET speed_tier = 'fast' WHERE provider_name = 'anthropic' AND model_name = 'claude-3-5-haiku-20241022';
UPDATE public.llm_models SET speed_tier = 'medium' WHERE provider_name = 'anthropic' AND model_name = 'claude-3-5-sonnet-20241022';

-- Now delete the old entries with dots
DELETE FROM public.llm_models WHERE provider_name = 'anthropic' AND model_name = 'claude-3.5-haiku-20241022';
DELETE FROM public.llm_models WHERE provider_name = 'anthropic' AND model_name = 'claude-3.5-sonnet';

-- Verify the changes
SELECT model_name, provider_name, display_name 
FROM public.llm_models 
WHERE provider_name = 'anthropic' 
ORDER BY model_name;
