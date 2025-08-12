-- Production Environment Seed Data
-- Essential platform data only - no demo companies or KPI data

-- =====================================
-- ORCHESTRATOR SCHEMA SEED DATA
-- =====================================

-- Insert LLM Providers (Production configurations)
INSERT INTO orchestrator.llm_providers (id, name, display_name, api_base_url, configuration_json, is_active, created_at, updated_at) VALUES
('7e157b23-07bb-47cd-9fe6-2c024d69ef6f', 'openai', 'OpenAI', 'https://api.openai.com/v1', '{"timeout":30,"organization":null}'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('8e42c293-a4ea-4735-84a3-5fe9d88585f9', 'anthropic', 'Anthropic', 'https://api.anthropic.com', '{"timeout":30,"max_retries":3}'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('27e27074-94a5-440c-9a5a-6bc8a949819f', 'ollama', 'Ollama Local', 'http://localhost:11434', '{"local":true,"streaming_supported":true}'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- Insert LLM Models (Production models)
INSERT INTO orchestrator.llm_models (id, provider_id, model_name, display_name, model_type, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, is_active, created_at, updated_at) VALUES
-- OpenAI Models
('494308ba-afb1-4bc8-983f-5acdec5920d4', '7e157b23-07bb-47cd-9fe6-2c024d69ef6f', 'gpt-4o', 'GPT-4o', 'text-generation', 128000, 4096, '{}'::jsonb, '{"input_cost_per_token":0.0000025,"output_cost_per_token":0.00001}'::jsonb, '["function_calling","streaming","json_mode","vision"]'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('c1e5d3b2-9876-4321-a0bc-def123456789', '7e157b23-07bb-47cd-9fe6-2c024d69ef6f', 'gpt-4-turbo', 'GPT-4 Turbo', 'text-generation', 128000, 4096, '{}'::jsonb, '{"input_cost_per_token":0.00001,"output_cost_per_token":0.00003}'::jsonb, '["function_calling","streaming","json_mode"]'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('d2f6e4c3-a987-5432-b1cd-ef0123456789', '7e157b23-07bb-47cd-9fe6-2c024d69ef6f', 'gpt-3.5-turbo', 'GPT-3.5 Turbo', 'text-generation', 16385, 4096, '{}'::jsonb, '{"input_cost_per_token":0.0000005,"output_cost_per_token":0.0000015}'::jsonb, '["function_calling","streaming","json_mode"]'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Anthropic Models
('b9e8f706-5432-1098-c7de-f12345678901', '8e42c293-a4ea-4735-84a3-5fe9d88585f9', 'claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet', 'text-generation', 200000, 8192, '{}'::jsonb, '{"input_cost_per_token":0.000003,"output_cost_per_token":0.000015}'::jsonb, '["function_calling","streaming","vision","computer_use"]'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('e3070504-6543-2109-d8ef-023456789012', '8e42c293-a4ea-4735-84a3-5fe9d88585f9', 'claude-3-haiku-20240307', 'Claude 3 Haiku', 'text-generation', 200000, 4096, '{}'::jsonb, '{"input_cost_per_token":0.00000025,"output_cost_per_token":0.00000125}'::jsonb, '["function_calling","streaming","vision"]'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Ollama Local Models
('fdc21100-9876-5432-01b2-345678901245', '27e27074-94a5-440c-9a5a-6bc8a949819f', 'llama3.1:8b', 'Llama 3.1 8B', 'text-generation', 128000, 4096, '{}'::jsonb, '{"local":true}'::jsonb, '["streaming","local"]'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('0ed32211-0987-6543-12c3-456789012356', '27e27074-94a5-440c-9a5a-6bc8a949819f', 'qwen2.5:7b', 'Qwen 2.5 7B', 'text-generation', 32768, 4096, '{}'::jsonb, '{"local":true}'::jsonb, '["streaming","local","multilingual"]'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('04080302-1098-7654-23d4-567890123467', '27e27074-94a5-440c-9a5a-6bc8a949819f', 'mistral:7b', 'Mistral 7B', 'text-generation', 32768, 4096, '{}'::jsonb, '{"local":true}'::jsonb, '["streaming","local"]'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('05090403-2109-8765-34e5-678901234578', '27e27074-94a5-440c-9a5a-6bc8a949819f', 'phi3:medium', 'Phi-3 Medium', 'text-generation', 128000, 4096, '{}'::jsonb, '{"local":true}'::jsonb, '["streaming","local","efficient"]'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- Insert CIDAFM Commands (Core platform commands)
INSERT INTO orchestrator.cidafm_commands (id, type, name, description, default_active, is_builtin, created_at, updated_at) VALUES
-- Context Import/Export Commands
('842e1239-f1eb-4226-b912-5cce37795f46', '!', 'import-cid', 'Read a CID and process its contents. If a [Context] section is present, add its contents to current chat memory. If an [AFMs] section is present, store the AFMs without activating them.', false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('95d887ff-1bc7-4516-8d28-b30f72a317f8', '!', 'export-context', 'Summarize the current chat memory in preparation for transfer to a new chat. Returns a detailed, cold-start compatible summary under a [Context] tag.', false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- AFM Management Commands
('a1b2c3d4-e5f6-7890-1234-56789abcdef0', '!', 'list-afms', 'Display all available AFMs (Automatic Function Modifiers) with their descriptions and current activation status.', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('b2c3d4e5-f607-8901-2345-6789abcdef01', '!', 'activate-afm', 'Activate one or more AFMs by name. Usage: !activate-afm <afm-name> [additional-afm-names...]', false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('c3d4e5f6-0708-9012-3456-789abcdef012', '!', 'deactivate-afm', 'Deactivate one or more AFMs by name. Usage: !deactivate-afm <afm-name> [additional-afm-names...]', false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Agent Mode Modifiers (@-commands)
('d4e5f607-0809-0123-4567-89abcdef0123', '@', 'deep-analysis', 'Perform comprehensive analysis with enhanced critical thinking and multiple perspectives on the given topic.', false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('e5f60708-0910-1234-5678-9abcdef01234', '@', 'creative-mode', 'Switch to highly creative mode with enhanced imagination and unconventional thinking patterns.', false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('f6070809-1011-2345-6789-abcdef012345', '@', 'technical-expert', 'Activate technical expert mode with deep domain knowledge and implementation focus.', false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('07080910-1112-3456-789a-bcdef0123456', '@', 'teaching-mode', 'Switch to educational mode with step-by-step explanations and learning-focused responses.', false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('08091011-1213-4567-89ab-cdef01234567', '@', 'business-analyst', 'Switch to business analysis mode with focus on strategic thinking and business metrics.', false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Project Management Commands
('00010203-0405-6789-abcd-ef0123456789', '!', 'create-project', 'Create a new multi-step project with defined goals and deliverables.', false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('01020304-0506-789a-bcde-f01234567890', '!', 'list-projects', 'Display all active projects with their current status and progress.', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('02030405-0607-89ab-cdef-012345678901', '!', 'project-status', 'Show detailed status of a specific project including completed and pending steps.', false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- System Commands
('03040506-0708-9abc-def0-123456789012', '!', 'system-status', 'Display system status including active agents, model availability, and resource usage.', false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('04050607-0809-abcd-ef01-234567890123', '!', 'clear-memory', 'Clear current conversation memory while preserving user preferences and settings.', false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- =====================================
-- COMPANY SCHEMA SEED DATA
-- =====================================

-- No demo companies or KPI data in production environment
-- Tables are created empty and ready for real business data