-- Seed data for LLM Providers and Models
-- This migration populates initial providers and models with current pricing and capabilities

-- Insert LLM Providers
INSERT INTO public.providers (id, name, api_base_url, auth_type, status) VALUES
('11111111-1111-1111-1111-111111111111', 'OpenAI', 'https://api.openai.com/v1', 'api_key', 'active'),
('22222222-2222-2222-2222-222222222222', 'Anthropic', 'https://api.anthropic.com/v1', 'api_key', 'active'),
('33333333-3333-3333-3333-333333333333', 'Google', 'https://generativelanguage.googleapis.com/v1', 'api_key', 'active'),
('44444444-4444-4444-4444-444444444444', 'Cohere', 'https://api.cohere.ai/v1', 'api_key', 'active'),
('55555555-5555-5555-5555-555555555555', 'Mistral', 'https://api.mistral.ai/v1', 'api_key', 'active');

-- Insert OpenAI Models
INSERT INTO public.models (provider_id, name, model_id, pricing_input_per_1k, pricing_output_per_1k, supports_thinking, max_tokens, context_window, strengths, weaknesses, use_cases, status) VALUES
-- GPT-4o models
('11111111-1111-1111-1111-111111111111', 'GPT-4o', 'gpt-4o', 0.0025, 0.01, false, 4096, 128000, 
 ARRAY['Multimodal', 'Fast', 'General purpose', 'Code generation'], 
 ARRAY['Expensive for high volume', 'No thinking mode'], 
 ARRAY['General chat', 'Code assistance', 'Content creation', 'Analysis'], 'active'),

('11111111-1111-1111-1111-111111111111', 'GPT-4o Mini', 'gpt-4o-mini', 0.00015, 0.0006, false, 16384, 128000,
 ARRAY['Cost effective', 'Fast', 'Good reasoning'], 
 ARRAY['Less capable than full GPT-4o', 'No multimodal'], 
 ARRAY['High volume tasks', 'Simple reasoning', 'Content moderation'], 'active'),

-- o1 models (thinking models)
('11111111-1111-1111-1111-111111111111', 'o1-preview', 'o1-preview', 0.015, 0.06, true, 32768, 128000,
 ARRAY['Advanced reasoning', 'Problem solving', 'Mathematical tasks'], 
 ARRAY['Expensive', 'Slower', 'Limited availability'], 
 ARRAY['Complex reasoning', 'Math problems', 'Code debugging', 'Research'], 'active'),

('11111111-1111-1111-1111-111111111111', 'o1-mini', 'o1-mini', 0.003, 0.012, true, 65536, 128000,
 ARRAY['Cost-effective reasoning', 'Good for coding', 'STEM tasks'], 
 ARRAY['Less capable than o1-preview', 'Still slower than GPT-4o'], 
 ARRAY['Coding problems', 'Math homework', 'Simple reasoning'], 'active');

-- Insert Anthropic Models
INSERT INTO public.models (provider_id, name, model_id, pricing_input_per_1k, pricing_output_per_1k, supports_thinking, max_tokens, context_window, strengths, weaknesses, use_cases, status) VALUES
-- Claude 3.5 Sonnet
('22222222-2222-2222-2222-222222222222', 'Claude 3.5 Sonnet', 'claude-3-5-sonnet-20241022', 0.003, 0.015, false, 8192, 200000,
 ARRAY['Excellent reasoning', 'Large context', 'Code generation', 'Analysis'], 
 ARRAY['More expensive than GPT-4o mini', 'No thinking mode'], 
 ARRAY['Code review', 'Long document analysis', 'Complex reasoning', 'Writing'], 'active'),

-- Claude 3.5 Haiku
('22222222-2222-2222-2222-222222222222', 'Claude 3.5 Haiku', 'claude-3-5-haiku-20241022', 0.001, 0.005, false, 8192, 200000,
 ARRAY['Fast', 'Cost effective', 'Good performance', 'Large context'], 
 ARRAY['Less capable than Sonnet', 'Newer model'], 
 ARRAY['Quick tasks', 'High volume processing', 'Simple analysis'], 'active'),

-- Claude 3 Opus (legacy but still available)
('22222222-2222-2222-2222-222222222222', 'Claude 3 Opus', 'claude-3-opus-20240229', 0.015, 0.075, false, 4096, 200000,
 ARRAY['Highest capability', 'Complex reasoning', 'Creative tasks'], 
 ARRAY['Most expensive', 'Slower', 'Legacy model'], 
 ARRAY['Complex analysis', 'Creative writing', 'Research tasks'], 'active');

-- Insert Google Models
INSERT INTO public.models (provider_id, name, model_id, pricing_input_per_1k, pricing_output_per_1k, supports_thinking, max_tokens, context_window, strengths, weaknesses, use_cases, status) VALUES
-- Gemini Pro
('33333333-3333-3333-3333-333333333333', 'Gemini 1.5 Pro', 'gemini-1.5-pro', 0.00125, 0.005, false, 8192, 2000000,
 ARRAY['Massive context window', 'Multimodal', 'Cost effective', 'Google integration'], 
 ARRAY['Less mature ecosystem', 'API limitations'], 
 ARRAY['Long document processing', 'Video analysis', 'Large context tasks'], 'active'),

-- Gemini Flash
('33333333-3333-3333-3333-333333333333', 'Gemini 1.5 Flash', 'gemini-1.5-flash', 0.000075, 0.0003, false, 8192, 1000000,
 ARRAY['Very fast', 'Extremely cost effective', 'Large context', 'Multimodal'], 
 ARRAY['Lower capability than Pro', 'Rate limits'], 
 ARRAY['High volume tasks', 'Real-time applications', 'Cost-sensitive use cases'], 'active');

-- Insert Cohere Models
INSERT INTO public.models (provider_id, name, model_id, pricing_input_per_1k, pricing_output_per_1k, supports_thinking, max_tokens, context_window, strengths, weaknesses, use_cases, status) VALUES
-- Command R+
('44444444-4444-4444-4444-444444444444', 'Command R+', 'command-r-plus', 0.003, 0.015, false, 4096, 128000,
 ARRAY['RAG optimized', 'Tool use', 'Multilingual', 'Enterprise focused'], 
 ARRAY['Less general purpose', 'Smaller ecosystem'], 
 ARRAY['RAG applications', 'Tool calling', 'Enterprise chat'], 'active'),

-- Command R
('44444444-4444-4444-4444-444444444444', 'Command R', 'command-r', 0.0005, 0.0015, false, 4096, 128000,
 ARRAY['Cost effective', 'RAG optimized', 'Fast', 'Tool use'], 
 ARRAY['Less capable than R+', 'Limited use cases'], 
 ARRAY['Simple RAG', 'High volume tool calling', 'Basic chat'], 'active');

-- Insert Mistral Models
INSERT INTO public.models (provider_id, name, model_id, pricing_input_per_1k, pricing_output_per_1k, supports_thinking, max_tokens, context_window, strengths, weaknesses, use_cases, status) VALUES
-- Mistral Large
('55555555-5555-5555-5555-555555555555', 'Mistral Large', 'mistral-large-latest', 0.004, 0.012, false, 32768, 128000,
 ARRAY['Strong reasoning', 'Code generation', 'Multilingual', 'European provider'], 
 ARRAY['Smaller ecosystem', 'Less documentation'], 
 ARRAY['Code generation', 'Reasoning tasks', 'European compliance'], 'active'),

-- Mistral Medium (deprecated but keeping for reference)
('55555555-5555-5555-5555-555555555555', 'Mistral Medium', 'mistral-medium-latest', 0.0027, 0.0081, false, 32768, 32000,
 ARRAY['Balanced performance', 'Cost effective'], 
 ARRAY['Deprecated', 'Limited context'], 
 ARRAY['Legacy applications'], 'deprecated');

-- Add helpful comments about pricing (as of Dec 2024)
COMMENT ON COLUMN public.models.pricing_input_per_1k IS 'Input pricing per 1K tokens in USD (as of Dec 2024)';
COMMENT ON COLUMN public.models.pricing_output_per_1k IS 'Output pricing per 1K tokens in USD (as of Dec 2024)';
COMMENT ON COLUMN public.models.supports_thinking IS 'Whether model supports internal reasoning/thinking mode';
COMMENT ON COLUMN public.models.context_window IS 'Maximum context window size in tokens';
COMMENT ON COLUMN public.models.strengths IS 'Array of model strengths and capabilities';
COMMENT ON COLUMN public.models.weaknesses IS 'Array of model limitations';
COMMENT ON COLUMN public.models.use_cases IS 'Array of recommended use cases';