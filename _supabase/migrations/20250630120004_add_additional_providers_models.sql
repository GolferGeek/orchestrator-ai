-- Add additional LLM providers: Ollama (local models) and Grok (X.AI)
-- This migration extends the initial seed data with local and additional cloud providers

-- Insert additional providers
INSERT INTO public.providers (id, name, api_base_url, auth_type, status) VALUES
('66666666-6666-6666-6666-666666666666', 'Ollama', 'http://localhost:11434/v1', 'none', 'active'),
('77777777-7777-7777-7777-777777777777', 'X.AI (Grok)', 'https://api.x.ai/v1', 'api_key', 'active'),
('88888888-8888-8888-8888-888888888888', 'Together AI', 'https://api.together.xyz/v1', 'api_key', 'active'),
('99999999-9999-9999-9999-999999999999', 'Groq', 'https://api.groq.com/openai/v1', 'api_key', 'active');

-- Insert Ollama Models (popular local models)
INSERT INTO public.models (provider_id, name, model_id, pricing_input_per_1k, pricing_output_per_1k, supports_thinking, max_tokens, context_window, strengths, weaknesses, use_cases, status) VALUES
-- Llama models
('66666666-6666-6666-6666-666666666666', 'Llama 3.3 70B', 'llama3.3:70b', 0.0, 0.0, false, 8192, 128000,
 ARRAY['Free', 'Local privacy', 'Customizable', 'Good performance'], 
 ARRAY['Requires powerful hardware', 'Slower than cloud', 'Setup complexity'], 
 ARRAY['Private data processing', 'Offline usage', 'Cost-sensitive tasks'], 'active'),

('66666666-6666-6666-6666-666666666666', 'Llama 3.2 11B', 'llama3.2:11b', 0.0, 0.0, false, 4096, 128000,
 ARRAY['Free', 'Moderate hardware requirements', 'Good balance', 'Privacy'], 
 ARRAY['Less capable than 70B', 'Still requires good hardware'], 
 ARRAY['Balanced local usage', 'Development testing', 'Medium complexity tasks'], 'active'),

('66666666-6666-6666-6666-666666666666', 'Llama 3.2 3B', 'llama3.2:3b', 0.0, 0.0, false, 4096, 128000,
 ARRAY['Free', 'Low hardware requirements', 'Fast', 'Privacy'], 
 ARRAY['Limited capabilities', 'Basic reasoning only'], 
 ARRAY['Simple tasks', 'Resource-constrained environments', 'Basic chat'], 'active'),

-- Code-focused models
('66666666-6666-6666-6666-666666666666', 'Code Llama 34B', 'codellama:34b', 0.0, 0.0, false, 16384, 16384,
 ARRAY['Free', 'Code-specialized', 'Good for programming', 'Local privacy'], 
 ARRAY['Code-only focus', 'Large model size', 'Limited general knowledge'], 
 ARRAY['Code generation', 'Code review', 'Programming assistance'], 'active'),

('66666666-6666-6666-6666-666666666666', 'Code Llama 13B', 'codellama:13b', 0.0, 0.0, false, 16384, 16384,
 ARRAY['Free', 'Smaller than 34B', 'Code-focused', 'Faster'], 
 ARRAY['Less capable than 34B', 'Code-only'], 
 ARRAY['Code completion', 'Simple programming tasks'], 'active'),

-- Other popular Ollama models
('66666666-6666-6666-6666-666666666666', 'Mistral 7B', 'mistral:7b', 0.0, 0.0, false, 8192, 32768,
 ARRAY['Free', 'Efficient', 'Good performance/size ratio', 'Fast'], 
 ARRAY['Limited context', 'Less capable than larger models'], 
 ARRAY['General chat', 'Quick tasks', 'Resource-efficient usage'], 'active'),

('66666666-6666-6666-6666-666666666666', 'Neural Chat 7B', 'neural-chat:7b', 0.0, 0.0, false, 4096, 4096,
 ARRAY['Free', 'Chat-optimized', 'Conversational', 'Intel-optimized'], 
 ARRAY['Smaller context', 'Limited capabilities'], 
 ARRAY['Casual conversation', 'Simple Q&A'], 'active'),

('66666666-6666-6666-6666-666666666666', 'Phi-3 Mini', 'phi3:mini', 0.0, 0.0, false, 4096, 128000,
 ARRAY['Free', 'Microsoft model', 'Very efficient', 'Good reasoning'], 
 ARRAY['Smaller model', 'Limited knowledge'], 
 ARRAY['Efficient reasoning', 'Mobile deployment', 'Edge computing'], 'active');

-- Insert Grok Models (X.AI)
INSERT INTO public.models (provider_id, name, model_id, pricing_input_per_1k, pricing_output_per_1k, supports_thinking, max_tokens, context_window, strengths, weaknesses, use_cases, status) VALUES
('77777777-7777-7777-7777-777777777777', 'Grok-2', 'grok-2', 0.002, 0.01, false, 8192, 131072,
 ARRAY['Real-time data access', 'X/Twitter integration', 'Humor and personality', 'Current events'], 
 ARRAY['Limited availability', 'Newer provider', 'Less documentation'], 
 ARRAY['Current events analysis', 'Social media content', 'Real-time information'], 'active'),

('77777777-7777-7777-7777-777777777777', 'Grok-2 Mini', 'grok-2-mini', 0.0002, 0.001, false, 8192, 131072,
 ARRAY['Cost effective', 'Fast', 'Real-time data', 'Good performance'], 
 ARRAY['Less capable than full Grok-2', 'Limited ecosystem'], 
 ARRAY['High volume real-time tasks', 'Cost-sensitive current events'], 'active');

-- Insert Together AI Models (hosting various open source models)
INSERT INTO public.models (provider_id, name, model_id, pricing_input_per_1k, pricing_output_per_1k, supports_thinking, max_tokens, context_window, strengths, weaknesses, use_cases, status) VALUES
('88888888-8888-8888-8888-888888888888', 'Llama 3 70B (Together)', 'meta-llama/Llama-3-70b-chat-hf', 0.0009, 0.0009, false, 4096, 8192,
 ARRAY['Open source', 'Cost effective', 'Good performance', 'Fast inference'], 
 ARRAY['Limited context', 'Third-party hosting'], 
 ARRAY['Cost-effective general tasks', 'Open source preference'], 'active'),

('88888888-8888-8888-8888-888888888888', 'Mixtral 8x7B', 'mistralai/Mixtral-8x7B-Instruct-v0.1', 0.0006, 0.0006, false, 4096, 32768,
 ARRAY['Mixture of experts', 'Cost effective', 'Good reasoning', 'Multilingual'], 
 ARRAY['Complex architecture', 'Moderate context'], 
 ARRAY['Multilingual tasks', 'Cost-effective reasoning'], 'active'),

('88888888-8888-8888-8888-888888888888', 'Code Llama 34B (Together)', 'codellama/CodeLlama-34b-Instruct-hf', 0.00045, 0.00045, false, 16384, 16384,
 ARRAY['Code specialized', 'Large model', 'Good at programming', 'Hosted inference'], 
 ARRAY['Code-focused only', 'Higher cost than smaller models'], 
 ARRAY['Complex code generation', 'Code review', 'Architecture planning'], 'active');

-- Insert Groq Models (fast inference)
INSERT INTO public.models (provider_id, name, model_id, pricing_input_per_1k, pricing_output_per_1k, supports_thinking, max_tokens, context_window, strengths, weaknesses, use_cases, status) VALUES
('99999999-9999-9999-9999-999999999999', 'Llama 3 70B (Groq)', 'llama3-70b-8192', 0.00059, 0.00079, false, 8192, 8192,
 ARRAY['Extremely fast inference', 'Low latency', 'Good performance', 'Cost effective'], 
 ARRAY['Limited context window', 'Queue limitations'], 
 ARRAY['Real-time applications', 'Speed-critical tasks', 'Interactive chat'], 'active'),

('99999999-9999-9999-9999-999999999999', 'Mixtral 8x7B (Groq)', 'mixtral-8x7b-32768', 0.00024, 0.00024, false, 4096, 32768,
 ARRAY['Very fast', 'Larger context than Llama', 'Mixture of experts', 'Affordable'], 
 ARRAY['Queue limitations', 'Less capable than larger models'], 
 ARRAY['Fast reasoning tasks', 'Real-time chat', 'Speed + context balance'], 'active'),

('99999999-9999-9999-9999-999999999999', 'Gemma 7B (Groq)', 'gemma-7b-it', 0.00015, 0.00015, false, 8192, 8192,
 ARRAY['Very fast', 'Very cheap', 'Google model', 'Good efficiency'], 
 ARRAY['Smaller model capabilities', 'Limited context'], 
 ARRAY['High-speed simple tasks', 'Cost-sensitive applications'], 'active');

-- Update comments to reflect the additional providers
COMMENT ON TABLE public.providers IS 'LLM providers including cloud APIs (OpenAI, Anthropic, etc.), local solutions (Ollama), and specialized inference platforms (Groq)';

-- Add specific notes about local and specialized providers
UPDATE public.providers SET 
    api_base_url = 'http://localhost:11434/v1' 
WHERE name = 'Ollama';

COMMENT ON COLUMN public.providers.auth_type IS 'Authentication type: api_key for cloud providers, none for local providers like Ollama';
COMMENT ON COLUMN public.models.pricing_input_per_1k IS 'Input pricing per 1K tokens in USD. 0.0 for free/local models';
COMMENT ON COLUMN public.models.pricing_output_per_1k IS 'Output pricing per 1K tokens in USD. 0.0 for free/local models';