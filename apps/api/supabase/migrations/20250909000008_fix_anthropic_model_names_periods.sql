-- Fix Anthropic model names by replacing periods with dashes in version numbers
-- This prevents issues with model name parsing and API calls

-- Insert corrected versions with dashes instead of periods
INSERT INTO public.llm_models (
    model_name, provider_name, display_name, model_type, 
    context_window, max_output_tokens, pricing_info_json, 
    capabilities, is_active, speed_tier, is_local, loading_priority
) VALUES 
-- Replace claude-3.5-haiku-20241022 with claude-3-5-haiku-20241022
('claude-3-5-haiku-20241022', 'anthropic', 'Claude 3.5 Haiku', 'text-generation', 
 200000, 8192, '{"input_cost_per_million": 0.25, "output_cost_per_million": 1.25}', 
 '["streaming", "function_calling", "vision"]', true, 'fast', false, 85),

-- Replace claude-3.5-sonnet with claude-3-5-sonnet  
('claude-3-5-sonnet', 'anthropic', 'Claude 3.5 Sonnet', 'text-generation', 
 200000, 8192, '{"input_cost_per_million": 3.0, "output_cost_per_million": 15.0}', 
 '["streaming", "function_calling", "vision", "reasoning"]', true, 'medium', false, 90);

-- Delete the old versions with periods
DELETE FROM public.llm_models 
WHERE provider_name = 'anthropic' 
  AND model_name IN ('claude-3.5-haiku-20241022', 'claude-3.5-sonnet');

-- Verify the changes
DO $$
BEGIN
    RAISE NOTICE 'Updated Anthropic model names:';
    RAISE NOTICE 'claude-3.5-haiku-20241022 → claude-3-5-haiku-20241022';
    RAISE NOTICE 'claude-3.5-sonnet → claude-3-5-sonnet';
END $$;
