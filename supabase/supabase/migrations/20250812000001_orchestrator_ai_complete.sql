-- Orchestrator AI Complete Database Setup
-- Single migration with schema, data, and views for turnkey demo playground
-- Core platform tables in public schema, company KPI data in company schema
-- This follows standard Supabase patterns for SaaS applications

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================
-- CREATE SCHEMAS
-- =====================================

-- Company schema for KPI/business data  
CREATE SCHEMA IF NOT EXISTS company;

-- =====================================
-- PUBLIC SCHEMA - CORE PLATFORM TABLES
-- =====================================

-- Users table - Core user management with full profile support
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    phone VARCHAR(50),
    phone_verified BOOLEAN DEFAULT FALSE,
    company VARCHAR(255),
    role VARCHAR(50),
    department VARCHAR(255),
    location VARCHAR(255),
    timezone VARCHAR(50) DEFAULT 'UTC',
    locale VARCHAR(10) DEFAULT 'en-US',
    status VARCHAR(50) DEFAULT 'active',
    roles JSONB DEFAULT '["user"]'::jsonb
);

-- LLM Providers table - AI service provider configurations
CREATE TABLE public.llm_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    api_base_url VARCHAR(500),
    api_key_encrypted TEXT,
    configuration_json JSONB,
    is_active BOOLEAN DEFAULT true,
    rate_limit_rpm INTEGER,
    rate_limit_tpm INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- LLM Models table - AI model specifications and capabilities
CREATE TABLE public.llm_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID NOT NULL REFERENCES public.llm_providers(id) ON DELETE CASCADE,
    model_name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    model_type VARCHAR(100) DEFAULT 'text-generation',
    context_window INTEGER DEFAULT 4096,
    max_output_tokens INTEGER DEFAULT 2048,
    model_parameters_json JSONB,
    pricing_info_json JSONB,
    capabilities JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider_id, model_name)
);

-- CIDAFM Commands table - Command interface definitions and function modifiers
CREATE TABLE public.cidafm_commands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(10) NOT NULL CHECK (type IN ('!', '@')),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    implementation_details JSONB,
    parameters_schema JSONB,
    default_active BOOLEAN DEFAULT false,
    is_builtin BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Agent Conversations table - Core conversation management with work product binding
CREATE TABLE public.agent_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    agent_name VARCHAR(255) NOT NULL,
    agent_type VARCHAR(50) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB,
    work_product JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tasks table - Individual task execution and tracking with comprehensive metadata
CREATE TABLE public.tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_conversation_id UUID REFERENCES public.agent_conversations(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    method VARCHAR(255) NOT NULL,
    prompt TEXT NOT NULL,
    params JSONB,
    response TEXT,
    response_metadata JSONB,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    progress_message TEXT,
    evaluation JSONB,
    llm_metadata JSONB,
    error_code VARCHAR(100),
    error_message TEXT,
    error_data JSONB,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    timeout_seconds INTEGER DEFAULT 300,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Projects table - Multi-step project orchestration with hierarchical task management
CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    goal TEXT,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    target_completion_date TIMESTAMP WITH TIME ZONE,
    actual_completion_date TIMESTAMP WITH TIME ZONE,
    metadata JSONB,
    deliverable_specifications JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Deliverables table - Work products and outputs with versioning
CREATE TABLE public.deliverables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.agent_conversations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content TEXT,
    type VARCHAR(100),
    format VARCHAR(100),
    version INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published', 'archived')),
    metadata JSONB,
    file_attachments JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================
-- COMPANY SCHEMA - KPI & BUSINESS DATA
-- =====================================

-- Companies table - Basic company information
CREATE TABLE company.companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    industry VARCHAR(255),
    founded_year INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Departments table - Organizational structure
CREATE TABLE company.departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES company.companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    head_of_department VARCHAR(255),
    budget DECIMAL(15,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- KPI Metrics table - Key performance indicator definitions
CREATE TABLE company.kpi_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    metric_type VARCHAR(100),
    unit VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- KPI Goals table - Target values for metrics
CREATE TABLE company.kpi_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_id UUID NOT NULL REFERENCES company.departments(id) ON DELETE CASCADE,
    metric_id UUID NOT NULL REFERENCES company.kpi_metrics(id) ON DELETE CASCADE,
    target_value DECIMAL(15,4),
    period_start DATE,
    period_end DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- KPI Data table - Historical performance data
CREATE TABLE company.kpi_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_id UUID NOT NULL REFERENCES company.departments(id) ON DELETE CASCADE,
    metric_id UUID NOT NULL REFERENCES company.kpi_metrics(id) ON DELETE CASCADE,
    value DECIMAL(15,4),
    date_recorded DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================
-- INDEXES FOR PERFORMANCE
-- =====================================

-- Public schema indexes
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_status ON public.users(status);
CREATE INDEX idx_agent_conversations_user_id ON public.agent_conversations(user_id);
CREATE INDEX idx_agent_conversations_last_active ON public.agent_conversations(last_active_at DESC);
CREATE INDEX idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX idx_tasks_conversation_id ON public.tasks(agent_conversation_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_created_at ON public.tasks(created_at DESC);
CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_deliverables_user_id ON public.deliverables(user_id);
CREATE INDEX idx_deliverables_conversation_id ON public.deliverables(conversation_id);
CREATE INDEX idx_deliverables_project_id ON public.deliverables(project_id);
CREATE INDEX idx_deliverables_task_id ON public.deliverables(task_id);

-- Company schema indexes
CREATE INDEX idx_departments_company_id ON company.departments(company_id);
CREATE INDEX idx_kpi_goals_department_id ON company.kpi_goals(department_id);
CREATE INDEX idx_kpi_goals_metric_id ON company.kpi_goals(metric_id);
CREATE INDEX idx_kpi_data_department_id ON company.kpi_data(department_id);
CREATE INDEX idx_kpi_data_metric_id ON company.kpi_data(metric_id);
CREATE INDEX idx_kpi_data_date_recorded ON company.kpi_data(date_recorded DESC);

-- =====================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- =====================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to public schema tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_llm_providers_updated_at BEFORE UPDATE ON public.llm_providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_llm_models_updated_at BEFORE UPDATE ON public.llm_models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cidafm_commands_updated_at BEFORE UPDATE ON public.cidafm_commands
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_conversations_updated_at BEFORE UPDATE ON public.agent_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deliverables_updated_at BEFORE UPDATE ON public.deliverables
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply triggers to company schema tables
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON company.companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON company.departments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kpi_metrics_updated_at BEFORE UPDATE ON company.kpi_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kpi_goals_updated_at BEFORE UPDATE ON company.kpi_goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kpi_data_updated_at BEFORE UPDATE ON company.kpi_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================
-- FUNCTIONS
-- =====================================

-- SQL execution function for dynamic queries (simplified for demo)
CREATE OR REPLACE FUNCTION public.exec_sql(query text)
RETURNS json AS $$
BEGIN
    -- This is a simplified implementation for demo purposes
    -- In production, you'd want proper security and SQL parsing
    RETURN json_build_object('status', 'executed', 'query', query);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions on function
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO anon;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO authenticated;

-- =====================================
-- VIEWS
-- =====================================

-- Create agent_conversations_with_stats view in public schema
-- This view adds task statistics to agent conversations
CREATE OR REPLACE VIEW public.agent_conversations_with_stats AS
SELECT 
    ac.*,
    COALESCE(task_stats.task_count, 0) as task_count,
    COALESCE(task_stats.completed_tasks, 0) as completed_tasks,
    COALESCE(task_stats.failed_tasks, 0) as failed_tasks,
    COALESCE(task_stats.active_tasks, 0) as active_tasks
FROM public.agent_conversations ac
LEFT JOIN (
    SELECT 
        agent_conversation_id,
        COUNT(*) as task_count,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_tasks,
        COUNT(CASE WHEN status IN ('pending', 'running') THEN 1 END) as active_tasks
    FROM public.tasks
    WHERE agent_conversation_id IS NOT NULL
    GROUP BY agent_conversation_id
) task_stats ON ac.id = task_stats.agent_conversation_id;

-- =====================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================

-- Enable RLS on sensitive tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverables ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Conversations are visible to their owners
CREATE POLICY "Users can view own conversations" ON public.agent_conversations
    FOR ALL USING (auth.uid() = user_id);

-- Tasks are visible to their owners  
CREATE POLICY "Users can view own tasks" ON public.tasks
    FOR ALL USING (auth.uid() = user_id);

-- Projects are visible to their owners
CREATE POLICY "Users can view own projects" ON public.projects
    FOR ALL USING (auth.uid() = user_id);

-- Deliverables are visible to their owners
CREATE POLICY "Users can view own deliverables" ON public.deliverables
    FOR ALL USING (auth.uid() = user_id);

-- =====================================
-- GRANTS
-- =====================================

-- Grant permissions on public tables
GRANT ALL ON public.users TO authenticated;
GRANT SELECT ON public.users TO anon;

GRANT ALL ON public.llm_providers TO authenticated;
GRANT SELECT ON public.llm_providers TO anon;

GRANT ALL ON public.llm_models TO authenticated;
GRANT SELECT ON public.llm_models TO anon;

GRANT ALL ON public.cidafm_commands TO authenticated;
GRANT SELECT ON public.cidafm_commands TO anon;

GRANT ALL ON public.agent_conversations TO authenticated;
GRANT SELECT ON public.agent_conversations TO anon;

GRANT ALL ON public.tasks TO authenticated;
GRANT SELECT ON public.tasks TO anon;

GRANT ALL ON public.projects TO authenticated;
GRANT SELECT ON public.projects TO anon;

GRANT ALL ON public.deliverables TO authenticated;
GRANT SELECT ON public.deliverables TO anon;

-- Grant permissions on company tables
GRANT ALL ON company.companies TO authenticated;
GRANT SELECT ON company.companies TO anon;

GRANT ALL ON company.departments TO authenticated;
GRANT SELECT ON company.departments TO anon;

GRANT ALL ON company.kpi_metrics TO authenticated;
GRANT SELECT ON company.kpi_metrics TO anon;

GRANT ALL ON company.kpi_goals TO authenticated;
GRANT SELECT ON company.kpi_goals TO anon;

GRANT ALL ON company.kpi_data TO authenticated;
GRANT SELECT ON company.kpi_data TO anon;

-- Grant permissions on views
GRANT SELECT ON public.agent_conversations_with_stats TO anon;
GRANT SELECT ON public.agent_conversations_with_stats TO authenticated;

-- =====================================
-- DEMO DATA
-- =====================================

-- Insert Demo Users
INSERT INTO public.users (id, email, display_name, created_at, updated_at, phone_verified, timezone, locale, status, roles) VALUES
('d219748a-f7b5-449f-a4cf-dc0551057fbe', 'demo.user@playground.com', 'Demo Playground User', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, false, 'UTC', 'en-US', 'active', '["user"]'::jsonb),
('e2ee07ca-397d-40fa-9196-74cbf02c65ad', 'demo.user2@playground.com', 'Demo User 2', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, false, 'UTC', 'en-US', 'active', '["user"]'::jsonb),
('09f41d4d-1697-4141-a0de-3e258faae92b', 'demo.admin@playground.com', 'Demo Admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, false, 'UTC', 'en-US', 'active', '["user","admin"]'::jsonb),
('936d0d6c-7d2f-40cf-b0a6-8824fd8e989e', 'business.owner@playground.com', 'Business Owner', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, false, 'UTC', 'en-US', 'active', '["user","admin"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Insert LLM Providers (Demo configurations)
INSERT INTO public.llm_providers (id, name, display_name, api_base_url, configuration_json, is_active, created_at, updated_at) VALUES
('7e157b23-07bb-47cd-9fe6-2c024d69ef6f', 'openai', 'OpenAI', 'https://api.openai.com/v1', '{"timeout":30,"organization":null}'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('8e42c293-a4ea-4735-84a3-5fe9d88585f9', 'anthropic', 'Anthropic', 'https://api.anthropic.com', '{"timeout":30,"max_retries":3}'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('27e27074-94a5-440c-9a5a-6bc8a949819f', 'ollama', 'Ollama Local', 'http://localhost:11434', '{"local":true,"streaming_supported":true}'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- Insert LLM Models (Popular models for demo)
INSERT INTO public.llm_models (id, provider_id, model_name, display_name, model_type, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, is_active, created_at, updated_at) VALUES
-- OpenAI Models
('494308ba-afb1-4bc8-983f-5acdec5920d4', '7e157b23-07bb-47cd-9fe6-2c024d69ef6f', 'gpt-4o', 'GPT-4o', 'text-generation', 128000, 4096, '{}'::jsonb, '{"input_cost_per_token":0.0000025,"output_cost_per_token":0.00001}'::jsonb, '["function_calling","streaming","json_mode","vision"]'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('c1e5d3b2-9876-4321-a0bc-def123456789', '7e157b23-07bb-47cd-9fe6-2c024d69ef6f', 'gpt-4-turbo', 'GPT-4 Turbo', 'text-generation', 128000, 4096, '{}'::jsonb, '{"input_cost_per_token":0.00001,"output_cost_per_token":0.00003}'::jsonb, '["function_calling","streaming","json_mode"]'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('d2f6e4c3-a987-5432-b1cd-ef0123456789', '7e157b23-07bb-47cd-9fe6-2c024d69ef6f', 'gpt-3.5-turbo', 'GPT-3.5 Turbo', 'text-generation', 16385, 4096, '{}'::jsonb, '{"input_cost_per_token":0.0000005,"output_cost_per_token":0.0000015}'::jsonb, '["function_calling","streaming","json_mode"]'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Anthropic Models
('b9e8f706-5432-1098-c7de-f12345678901', '8e42c293-a4ea-4735-84a3-5fe9d88585f9', 'claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet', 'text-generation', 200000, 8192, '{}'::jsonb, '{"input_cost_per_token":0.000003,"output_cost_per_token":0.000015}'::jsonb, '["function_calling","streaming","vision","computer_use"]'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('e3070504-6543-2109-d8ef-023456789012', '8e42c293-a4ea-4735-84a3-5fe9d88585f9', 'claude-3-haiku-20240307', 'Claude 3 Haiku', 'text-generation', 200000, 4096, '{}'::jsonb, '{"input_cost_per_token":0.00000025,"output_cost_per_token":0.00000125}'::jsonb, '["function_calling","streaming","vision"]'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Ollama Local Models
('fdc21100-9876-5432-01b2-345678901245', '27e27074-94a5-440c-9a5a-6bc8a949819f', 'llama3.1:8b', 'Llama 3.1 8B', 'text-generation', 128000, 4096, '{}'::jsonb, '{"local":true}'::jsonb, '["streaming","local"]'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('aed32211-0987-6543-12c3-456789012356', '27e27074-94a5-440c-9a5a-6bc8a949819f', 'qwen2.5:7b', 'Qwen 2.5 7B', 'text-generation', 32768, 4096, '{}'::jsonb, '{"local":true}'::jsonb, '["streaming","local","multilingual"]'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('04080302-1098-7654-23d4-567890123467', '27e27074-94a5-440c-9a5a-6bc8a949819f', 'mistral:7b', 'Mistral 7B', 'text-generation', 32768, 4096, '{}'::jsonb, '{"local":true}'::jsonb, '["streaming","local"]'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('05090403-2109-8765-34e5-678901234578', '27e27074-94a5-440c-9a5a-6bc8a949819f', 'phi3:medium', 'Phi-3 Medium', 'text-generation', 128000, 4096, '{}'::jsonb, '{"local":true}'::jsonb, '["streaming","local","efficient"]'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- Insert CIDAFM Commands (Core platform commands)
INSERT INTO public.cidafm_commands (id, type, name, description, default_active, is_builtin, created_at, updated_at) VALUES
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
('1d777777-7777-7777-7777-777777777777', '871b8ca4-b161-4d68-87e6-38e47be3a8f0', 'a2222222-2222-2222-2222-222222222222', 109200.00, '2025-07-01', CURRENT_TIMESTAMP),
('1d888888-8888-8888-8888-888888888888', '871b8ca4-b161-4d68-87e6-38e47be3a8f0', 'a2222222-2222-2222-2222-222222222222', 112800.00, '2025-08-01', CURRENT_TIMESTAMP),

-- TechCorp Marketing - Conversion Rate Trends
('1d999999-9999-9999-9999-999999999999', '78c75643-d272-42f7-a67d-39491a7caf66', 'a3333333-3333-3333-3333-333333333333', 14.2, '2025-01-01', CURRENT_TIMESTAMP),
('1da11111-1111-1111-1111-111111111111', '78c75643-d272-42f7-a67d-39491a7caf66', 'a3333333-3333-3333-3333-333333333333', 13.8, '2025-02-01', CURRENT_TIMESTAMP),
('1da22222-2222-2222-2222-222222222222', '78c75643-d272-42f7-a67d-39491a7caf66', 'a3333333-3333-3333-3333-333333333333', 15.1, '2025-03-01', CURRENT_TIMESTAMP),
('1da33333-3333-3333-3333-333333333333', '78c75643-d272-42f7-a67d-39491a7caf66', 'a3333333-3333-3333-3333-333333333333', 14.7, '2025-04-01', CURRENT_TIMESTAMP),
('1da44444-4444-4444-4444-444444444444', '78c75643-d272-42f7-a67d-39491a7caf66', 'a3333333-3333-3333-3333-333333333333', 16.2, '2025-05-01', CURRENT_TIMESTAMP),
('1da55555-5555-5555-5555-555555555555', '78c75643-d272-42f7-a67d-39491a7caf66', 'a3333333-3333-3333-3333-333333333333', 15.8, '2025-06-01', CURRENT_TIMESTAMP),

-- TechCorp Engineering - Operational Efficiency
('1da66666-6666-6666-6666-666666666666', 'd1111111-1111-1111-1111-111111111111', 'b3333333-3333-3333-3333-333333333333', 94.2, '2025-01-01', CURRENT_TIMESTAMP),
('1da77777-7777-7777-7777-777777777777', 'd1111111-1111-1111-1111-111111111111', 'b3333333-3333-3333-3333-333333333333', 95.1, '2025-02-01', CURRENT_TIMESTAMP),
('1da88888-8888-8888-8888-888888888888', 'd1111111-1111-1111-1111-111111111111', 'b3333333-3333-3333-3333-333333333333', 94.8, '2025-03-01', CURRENT_TIMESTAMP),
('1da99999-9999-9999-9999-999999999999', 'd1111111-1111-1111-1111-111111111111', 'b3333333-3333-3333-3333-333333333333', 96.3, '2025-04-01', CURRENT_TIMESTAMP),

-- Cross-Company Customer Satisfaction Trends
('1daa1111-1111-1111-1111-111111111111', 'd2222222-2222-2222-2222-222222222222', 'a2111111-1111-1111-1111-111111111111', 87.5, '2025-01-01', CURRENT_TIMESTAMP),
('1daa2222-2222-2222-2222-222222222222', 'd2222222-2222-2222-2222-222222222222', 'a2111111-1111-1111-1111-111111111111', 89.2, '2025-02-01', CURRENT_TIMESTAMP),
('1daa3333-3333-3333-3333-333333333333', 'd2222222-2222-2222-2222-222222222222', 'a2111111-1111-1111-1111-111111111111', 88.8, '2025-03-01', CURRENT_TIMESTAMP),
('1daa4444-4444-4444-4444-444444444444', 'd2222222-2222-2222-2222-222222222222', 'a2111111-1111-1111-1111-111111111111', 91.1, '2025-04-01', CURRENT_TIMESTAMP),

-- ServicePro Consulting - Client Retention and Market Growth
('1daa5555-5555-5555-5555-555555555555', 'd4444444-4444-4444-4444-444444444444', 'b9999999-9999-9999-9999-999999999999', 94.2, '2025-01-01', CURRENT_TIMESTAMP),
('1daa6666-6666-6666-6666-666666666666', 'd4444444-4444-4444-4444-444444444444', 'b9999999-9999-9999-9999-999999999999', 95.8, '2025-02-01', CURRENT_TIMESTAMP),
('1daa7777-7777-7777-7777-777777777777', 'd4444444-4444-4444-4444-444444444444', 'b9999999-9999-9999-9999-999999999999', 96.1, '2025-03-01', CURRENT_TIMESTAMP),
('1daa8888-8888-8888-8888-888888888888', 'd4444444-4444-4444-4444-444444444444', 'b9999999-9999-9999-9999-999999999999', 97.2, '2025-04-01', CURRENT_TIMESTAMP),
('1daa9999-9999-9999-9999-999999999999', 'd5555555-5555-5555-5555-555555555555', 'b4444444-4444-4444-4444-444444444444', 22.8, '2025-01-01', CURRENT_TIMESTAMP),
('1daaa111-1111-1111-1111-111111111111', 'd5555555-5555-5555-5555-555555555555', 'b4444444-4444-4444-4444-444444444444', 23.4, '2025-02-01', CURRENT_TIMESTAMP),
('1daaa222-2222-2222-2222-222222222222', 'd5555555-5555-5555-5555-555555555555', 'b4444444-4444-4444-4444-444444444444', 24.1, '2025-03-01', CURRENT_TIMESTAMP),
('1daaa333-3333-3333-3333-333333333333', 'd5555555-5555-5555-5555-555555555555', 'b4444444-4444-4444-4444-444444444444', 24.8, '2025-04-01', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- =====================================================================================
-- Demo User Setup
-- =====================================================================================

-- Create the demo user in auth.users table
-- Note: The encrypted_password is for 'demouser'
INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    instance_id,
    aud,
    role,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
)
VALUES (
    '84ad4ef6-8900-409c-8915-fbf7ec2ab37a',
    'demo.user@playground.com',
    crypt('demouser', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '',
    '',
    '',
    ''
) ON CONFLICT (id) DO NOTHING;

-- Create the corresponding user in public.users table
INSERT INTO public.users (id, email, created_at, updated_at) 
VALUES ('84ad4ef6-8900-409c-8915-fbf7ec2ab37a', 'demo.user@playground.com', NOW(), NOW()) 
ON CONFLICT (id) DO NOTHING;

-- =====================================================================================
-- Search Functions
-- =====================================================================================

-- Create the search_deliverables function for searching deliverables
CREATE OR REPLACE FUNCTION public.search_deliverables(
    search_term text DEFAULT NULL,
    filter_type text DEFAULT NULL,
    filter_format text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0
)
RETURNS TABLE (
    id uuid,
    user_id uuid,
    conversation_id uuid,
    type text,
    format text,
    content text,
    metadata jsonb,
    created_at timestamptz,
    updated_at timestamptz,
    version integer,
    is_current boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.user_id,
        d.conversation_id,
        d.type,
        d.format,
        d.content,
        d.metadata,
        d.created_at,
        d.updated_at,
        d.version,
        d.is_current
    FROM public.deliverables d
    WHERE 
        (search_term IS NULL OR d.content ILIKE '%' || search_term || '%')
        AND (filter_type IS NULL OR d.type = filter_type)
        AND (filter_format IS NULL OR d.format = filter_format)
    ORDER BY d.created_at DESC
    LIMIT limit_count
    OFFSET offset_count;
END;
$$;