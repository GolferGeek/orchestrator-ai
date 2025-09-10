-- Sample Environment Seed Data
-- Complete demo data for both orchestrator and company schemas

-- =====================================
-- ORCHESTRATOR SCHEMA SEED DATA
-- =====================================

-- Insert Sample Users
INSERT INTO public.users (id, email, display_name, created_at, updated_at, phone_verified, timezone, locale, status, roles) VALUES
('e2ee07ca-397d-40fa-9196-74cbf02c65ad', 'sample.user@demo.com', 'Sample User', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, false, 'UTC', 'en-US', 'active', '["user"]'::jsonb),
('09f41d4d-1697-4141-a0de-3e258faae92b', 'demo.admin@demo.com', 'Demo Admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, false, 'UTC', 'en-US', 'active', '["user","admin"]'::jsonb),
('936d0d6c-7d2f-40cf-b0a6-8824fd8e989e', 'business.owner@demo.com', 'Business Owner', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, false, 'UTC', 'en-US', 'active', '["user","admin"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Insert LLM Providers
INSERT INTO public.llm_providers (id, name, display_name, api_base_url, configuration_json, is_active, created_at, updated_at) VALUES
('7e157b23-07bb-47cd-9fe6-2c024d69ef6f', 'openai', 'OpenAI', 'https://api.openai.com/v1', '{"timeout":30,"organization":null}'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('8e42c293-a4ea-4735-84a3-5fe9d88585f9', 'anthropic', 'Anthropic', 'https://api.anthropic.com', '{"timeout":30,"max_retries":3}'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('27e27074-94a5-440c-9a5a-6bc8a949819f', 'ollama', 'Ollama Local', 'http://localhost:11434', '{"local":true,"streaming_supported":true}'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- Insert LLM Models
INSERT INTO public.llm_models (id, provider_id, model_name, display_name, model_type, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, is_active, created_at, updated_at) VALUES
('494308ba-afb1-4bc8-983f-5acdec5920d4', '7e157b23-07bb-47cd-9fe6-2c024d69ef6f', 'gpt-4o', 'GPT-4o', 'text-generation', 128000, 4096, '{}'::jsonb, '{"input_cost_per_token":0.0000025,"output_cost_per_token":0.00001}'::jsonb, '["function_calling","streaming","json_mode","vision"]'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('c1e5d3b2-9876-4321-a0bc-def123456789', '7e157b23-07bb-47cd-9fe6-2c024d69ef6f', 'gpt-4-turbo', 'GPT-4 Turbo', 'text-generation', 128000, 4096, '{}'::jsonb, '{"input_cost_per_token":0.00001,"output_cost_per_token":0.00003}'::jsonb, '["function_calling","streaming","json_mode"]'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('b9e8f706-5432-1098-c7de-f12345678901', '8e42c293-a4ea-4735-84a3-5fe9d88585f9', 'claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet', 'text-generation', 200000, 8192, '{}'::jsonb, '{"input_cost_per_token":0.000003,"output_cost_per_token":0.000015}'::jsonb, '["function_calling","streaming","vision","computer_use"]'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('fdc21100-9876-5432-01b2-345678901245', '27e27074-94a5-440c-9a5a-6bc8a949819f', 'llama3.1:8b', 'Llama 3.1 8B', 'text-generation', 128000, 4096, '{}'::jsonb, '{"local":true}'::jsonb, '["streaming","local"]'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('aed32211-0987-6543-12c3-456789012356', '27e27074-94a5-440c-9a5a-6bc8a949819f', 'qwen2.5:7b', 'Qwen 2.5 7B', 'text-generation', 32768, 4096, '{}'::jsonb, '{"local":true}'::jsonb, '["streaming","local","multilingual"]'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- Insert CIDAFM Commands
INSERT INTO public.cidafm_commands (id, type, name, description, default_active, is_builtin, created_at, updated_at) VALUES
('842e1239-f1eb-4226-b912-5cce37795f46', '!', 'import-cid', 'Read a CID and process its contents. If a [Context] section is present, add its contents to current chat memory. If an [AFMs] section is present, store the AFMs without activating them.', false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('95d887ff-1bc7-4516-8d28-b30f72a317f8', '!', 'export-context', 'Summarize the current chat memory in preparation for transfer to a new chat. Returns a detailed, cold-start compatible summary under a [Context] tag.', false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('a1b2c3d4-e5f6-7890-1234-56789abcdef0', '!', 'list-afms', 'Display all available AFMs (Automatic Function Modifiers) with their descriptions and current activation status.', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('b2c3d4e5-f607-8901-2345-6789abcdef01', '!', 'activate-afm', 'Activate one or more AFMs by name. Usage: !activate-afm <afm-name> [additional-afm-names...]', false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('c3d4e5f6-0708-9012-3456-789abcdef012', '!', 'deactivate-afm', 'Deactivate one or more AFMs by name. Usage: !deactivate-afm <afm-name> [additional-afm-names...]', false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('d4e5f607-0809-0123-4567-89abcdef0123', '@', 'deep-analysis', 'Perform comprehensive analysis with enhanced critical thinking and multiple perspectives on the given topic.', false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('e5f60708-0910-1234-5678-9abcdef01234', '@', 'creative-mode', 'Switch to highly creative mode with enhanced imagination and unconventional thinking patterns.', false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('f6070809-1011-2345-6789-abcdef012345', '@', 'technical-expert', 'Activate technical expert mode with deep domain knowledge and implementation focus.', false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('07080910-1112-3456-789a-bcdef0123456', '@', 'teaching-mode', 'Switch to educational mode with step-by-step explanations and learning-focused responses.', false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('08091011-1213-4567-89ab-cdef01234567', '@', 'business-analyst', 'Switch to business analysis mode with focus on strategic thinking and business metrics.', false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- =====================================
-- COMPANY SCHEMA SEED DATA
-- =====================================

-- Insert Demo Companies
INSERT INTO company.companies (id, name, industry, founded_year, created_at) VALUES
('11111111-1111-1111-1111-111111111111', 'TechCorp Industries', 'Technology', 2018, CURRENT_TIMESTAMP),
('22222222-2222-2222-2222-222222222222', 'RetailMax Solutions', 'Retail', 2015, CURRENT_TIMESTAMP),
('33333333-3333-3333-3333-333333333333', 'ServicePro Consulting', 'Consulting', 2020, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- Insert Demo Departments
INSERT INTO company.departments (id, company_id, name, head_of_department, budget, created_at) VALUES
('871b8ca4-b161-4d68-87e6-38e47be3a8f0', '11111111-1111-1111-1111-111111111111', 'Sales', 'John Smith', 500000.00, CURRENT_TIMESTAMP),
('78c75643-d272-42f7-a67d-39491a7caf66', '11111111-1111-1111-1111-111111111111', 'Marketing', 'Sarah Johnson', 350000.00, CURRENT_TIMESTAMP),
('d1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Engineering', 'Mike Chen', 800000.00, CURRENT_TIMESTAMP),
('d2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Sales', 'Lisa Anderson', 450000.00, CURRENT_TIMESTAMP),
('d3333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Operations', 'Robert Wilson', 300000.00, CURRENT_TIMESTAMP),
('d4444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'Consulting', 'Amanda Davis', 275000.00, CURRENT_TIMESTAMP),
('d5555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333', 'Business Development', 'Carlos Rodriguez', 200000.00, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- Insert Demo KPI Metrics
INSERT INTO company.kpi_metrics (id, name, metric_type, unit, description, created_at) VALUES
('a1111111-1111-1111-1111-111111111111', 'Revenue', 'financial', 'USD', 'Total revenue generated', CURRENT_TIMESTAMP),
('a2111111-1111-1111-1111-111111111111', 'Customer Satisfaction', 'customer', 'percentage', 'Customer satisfaction score', CURRENT_TIMESTAMP),
('a2222222-2222-2222-2222-222222222222', 'Monthly Revenue', 'financial', 'USD', 'Monthly revenue', CURRENT_TIMESTAMP),
('a3333333-3333-3333-3333-333333333333', 'Conversion Rate', 'marketing', 'percentage', 'Lead to customer conversion rate', CURRENT_TIMESTAMP),
('a4444444-4444-4444-4444-444444444444', 'Employee Retention', 'hr', 'percentage', 'Employee retention rate', CURRENT_TIMESTAMP),
('a5555555-5555-5555-5555-555555555555', 'Response Time', 'operational', 'minutes', 'Average customer response time', CURRENT_TIMESTAMP),
('b1111111-1111-1111-1111-111111111111', 'Net Profit Margin', 'financial', 'percentage', 'Net profit margin', CURRENT_TIMESTAMP),
('b2222222-2222-2222-2222-222222222222', 'Customer Acquisition Cost', 'marketing', 'USD', 'Cost to acquire new customer', CURRENT_TIMESTAMP),
('b3333333-3333-3333-3333-333333333333', 'Operational Efficiency', 'operational', 'percentage', 'Overall operational efficiency', CURRENT_TIMESTAMP),
('b4444444-4444-4444-4444-444444444444', 'Market Share', 'business', 'percentage', 'Market share percentage', CURRENT_TIMESTAMP),
('b5555555-5555-5555-5555-555555555555', 'Quality Score', 'quality', 'score', 'Product/service quality score (1-10)', CURRENT_TIMESTAMP),
('b6666666-6666-6666-6666-666666666666', 'Innovation Index', 'innovation', 'score', 'Innovation capability index', CURRENT_TIMESTAMP),
('b7777777-7777-7777-7777-777777777777', 'Cost Per Lead', 'marketing', 'USD', 'Average cost per marketing lead', CURRENT_TIMESTAMP),
('b8888888-8888-8888-8888-888888888888', 'Project Delivery Time', 'operational', 'days', 'Average project delivery time', CURRENT_TIMESTAMP),
('b9999999-9999-9999-9999-999999999999', 'Client Retention Rate', 'customer', 'percentage', 'Percentage of clients retained annually', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- Insert Demo KPI Goals (target values for departments)
INSERT INTO company.kpi_goals (id, department_id, metric_id, target_value, period_start, period_end, created_at) VALUES
-- TechCorp Sales Goals
('01111111-1111-1111-1111-111111111111', '871b8ca4-b161-4d68-87e6-38e47be3a8f0', 'a1111111-1111-1111-1111-111111111111', 1200000.00, '2025-01-01', '2025-12-31', CURRENT_TIMESTAMP),
('02111111-1111-1111-1111-111111111111', '871b8ca4-b161-4d68-87e6-38e47be3a8f0', 'a3333333-3333-3333-3333-333333333333', 15.5, '2025-01-01', '2025-12-31', CURRENT_TIMESTAMP),
('03111111-1111-1111-1111-111111111111', '871b8ca4-b161-4d68-87e6-38e47be3a8f0', 'b9999999-9999-9999-9999-999999999999', 92.0, '2025-01-01', '2025-12-31', CURRENT_TIMESTAMP),

-- TechCorp Marketing Goals
('04111111-1111-1111-1111-111111111111', '78c75643-d272-42f7-a67d-39491a7caf66', 'b2222222-2222-2222-2222-222222222222', 150.00, '2025-01-01', '2025-12-31', CURRENT_TIMESTAMP),
('05111111-1111-1111-1111-111111111111', '78c75643-d272-42f7-a67d-39491a7caf66', 'b7777777-7777-7777-7777-777777777777', 75.00, '2025-01-01', '2025-12-31', CURRENT_TIMESTAMP),
('06111111-1111-1111-1111-111111111111', '78c75643-d272-42f7-a67d-39491a7caf66', 'a3333333-3333-3333-3333-333333333333', 12.0, '2025-01-01', '2025-12-31', CURRENT_TIMESTAMP),

-- TechCorp Engineering Goals
('07111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'b3333333-3333-3333-3333-333333333333', 95.0, '2025-01-01', '2025-12-31', CURRENT_TIMESTAMP),
('08111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'b8888888-8888-8888-8888-888888888888', 30.0, '2025-01-01', '2025-12-31', CURRENT_TIMESTAMP),
('09111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'b5555555-5555-5555-5555-555555555555', 8.5, '2025-01-01', '2025-12-31', CURRENT_TIMESTAMP),

-- RetailMax and ServicePro Goals
('0a111111-1111-1111-1111-111111111111', 'd2222222-2222-2222-2222-222222222222', 'a1111111-1111-1111-1111-111111111111', 850000.00, '2025-01-01', '2025-12-31', CURRENT_TIMESTAMP),
('0b111111-1111-1111-1111-111111111111', 'd3333333-3333-3333-3333-333333333333', 'b3333333-3333-3333-3333-333333333333', 85.0, '2025-01-01', '2025-12-31', CURRENT_TIMESTAMP),
('0c111111-1111-1111-1111-111111111111', 'd4444444-4444-4444-4444-444444444444', 'b9999999-9999-9999-9999-999999999999', 95.0, '2025-01-01', '2025-12-31', CURRENT_TIMESTAMP),
('0d111111-1111-1111-1111-111111111111', 'd5555555-5555-5555-5555-555555555555', 'b4444444-4444-4444-4444-444444444444', 25.0, '2025-01-01', '2025-12-31', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- Insert Demo KPI Data (historical performance data showing trends)
INSERT INTO company.kpi_data (id, department_id, metric_id, value, date_recorded, created_at) VALUES
-- TechCorp Sales - Monthly Revenue Trends (showing growth)
('1d111111-1111-1111-1111-111111111111', '871b8ca4-b161-4d68-87e6-38e47be3a8f0', 'a2222222-2222-2222-2222-222222222222', 85000.00, '2025-01-01', CURRENT_TIMESTAMP),
('1d222222-2222-2222-2222-222222222222', '871b8ca4-b161-4d68-87e6-38e47be3a8f0', 'a2222222-2222-2222-2222-222222222222', 92000.00, '2025-02-01', CURRENT_TIMESTAMP),
('1d333333-3333-3333-3333-333333333333', '871b8ca4-b161-4d68-87e6-38e47be3a8f0', 'a2222222-2222-2222-2222-222222222222', 88500.00, '2025-03-01', CURRENT_TIMESTAMP),
('1d444444-4444-4444-4444-444444444444', '871b8ca4-b161-4d68-87e6-38e47be3a8f0', 'a2222222-2222-2222-2222-222222222222', 96000.00, '2025-04-01', CURRENT_TIMESTAMP),
('1d555555-5555-5555-5555-555555555555', '871b8ca4-b161-4d68-87e6-38e47be3a8f0', 'a2222222-2222-2222-2222-222222222222', 101000.00, '2025-05-01', CURRENT_TIMESTAMP),
('1d666666-6666-6666-6666-666666666666', '871b8ca4-b161-4d68-87e6-38e47be3a8f0', 'a2222222-2222-2222-2222-222222222222', 105500.00, '2025-06-01', CURRENT_TIMESTAMP),

-- TechCorp Marketing - Conversion Rate Trends
('1d777777-7777-7777-7777-777777777777', '78c75643-d272-42f7-a67d-39491a7caf66', 'a3333333-3333-3333-3333-333333333333', 14.2, '2025-01-01', CURRENT_TIMESTAMP),
('1d888888-8888-8888-8888-888888888888', '78c75643-d272-42f7-a67d-39491a7caf66', 'a3333333-3333-3333-3333-333333333333', 13.8, '2025-02-01', CURRENT_TIMESTAMP),
('1d999999-9999-9999-9999-999999999999', '78c75643-d272-42f7-a67d-39491a7caf66', 'a3333333-3333-3333-3333-333333333333', 15.1, '2025-03-01', CURRENT_TIMESTAMP),
('1da11111-1111-1111-1111-111111111111', '78c75643-d272-42f7-a67d-39491a7caf66', 'a3333333-3333-3333-3333-333333333333', 14.7, '2025-04-01', CURRENT_TIMESTAMP),

-- TechCorp Engineering - Operational Efficiency
('1da22222-2222-2222-2222-222222222222', 'd1111111-1111-1111-1111-111111111111', 'b3333333-3333-3333-3333-333333333333', 94.2, '2025-01-01', CURRENT_TIMESTAMP),
('1da33333-3333-3333-3333-333333333333', 'd1111111-1111-1111-1111-111111111111', 'b3333333-3333-3333-3333-333333333333', 95.1, '2025-02-01', CURRENT_TIMESTAMP),
('1da44444-4444-4444-4444-444444444444', 'd1111111-1111-1111-1111-111111111111', 'b3333333-3333-3333-3333-333333333333', 94.8, '2025-03-01', CURRENT_TIMESTAMP),

-- Cross-Company Customer Satisfaction Trends
('1da55555-5555-5555-5555-555555555555', 'd2222222-2222-2222-2222-222222222222', 'a2111111-1111-1111-1111-111111111111', 87.5, '2025-01-01', CURRENT_TIMESTAMP),
('1da66666-6666-6666-6666-666666666666', 'd2222222-2222-2222-2222-222222222222', 'a2111111-1111-1111-1111-111111111111', 89.2, '2025-02-01', CURRENT_TIMESTAMP),
('1da77777-7777-7777-7777-777777777777', 'd2222222-2222-2222-2222-222222222222', 'a2111111-1111-1111-1111-111111111111', 88.8, '2025-03-01', CURRENT_TIMESTAMP),

-- ServicePro Consulting - Client Retention and Market Growth
('1da88888-8888-8888-8888-888888888888', 'd4444444-4444-4444-4444-444444444444', 'b9999999-9999-9999-9999-999999999999', 94.2, '2025-01-01', CURRENT_TIMESTAMP),
('1da99999-9999-9999-9999-999999999999', 'd4444444-4444-4444-4444-444444444444', 'b9999999-9999-9999-9999-999999999999', 95.8, '2025-02-01', CURRENT_TIMESTAMP),
('1daa1111-1111-1111-1111-111111111111', 'd4444444-4444-4444-4444-444444444444', 'b9999999-9999-9999-9999-999999999999', 96.1, '2025-03-01', CURRENT_TIMESTAMP),
('1daa2222-2222-2222-2222-222222222222', 'd5555555-5555-5555-5555-555555555555', 'b4444444-4444-4444-4444-444444444444', 22.8, '2025-01-01', CURRENT_TIMESTAMP),
('1daa3333-3333-3333-3333-333333333333', 'd5555555-5555-5555-5555-555555555555', 'b4444444-4444-4444-4444-444444444444', 23.4, '2025-02-01', CURRENT_TIMESTAMP),
('1daa4444-4444-4444-4444-444444444444', 'd5555555-5555-5555-5555-555555555555', 'b4444444-4444-4444-4444-444444444444', 24.1, '2025-03-01', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;