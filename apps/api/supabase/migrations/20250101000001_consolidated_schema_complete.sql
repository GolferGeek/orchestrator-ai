-- Sample Environment Database - Complete Setup
-- Contains both orchestrator platform schema and company KPI schema with demo data
-- This database is used for testing, demos, and development

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================
-- CREATE SCHEMAS
-- =====================================

-- Using public schema for orchestrator tables
-- CREATE SCHEMA IF NOT EXISTS orchestrator;
CREATE SCHEMA IF NOT EXISTS company;

-- =====================================
-- PUBLIC SCHEMA - PLATFORM TABLES
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

-- Seed the demo user
INSERT INTO public.users (id, email, display_name, role, roles)
VALUES ('b29a590e-b07f-49df-a25b-574c956b5035', 'demo.user@playground.com', 'Demo User', 'admin', '["admin", "user"]'::jsonb);

-- Redaction and Pseudonym Tables
CREATE TABLE public.redaction_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    pattern_regex TEXT NOT NULL,
    replacement TEXT NOT NULL,
    description TEXT,
    category VARCHAR(100),
    priority INTEGER DEFAULT 50,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    severity VARCHAR(50),
    data_type VARCHAR(50)
);

CREATE TABLE public.pseudonym_dictionaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_value TEXT UNIQUE NOT NULL,
    pseudonym TEXT NOT NULL,
    data_type VARCHAR(100) NOT NULL,
    category VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed the pseudonym dictionary
INSERT INTO public.pseudonym_dictionaries
  (original_value, pseudonym, data_type, category, is_active)
VALUES
  ('Matt Weber', '[PERSON_NAME_001]', 'name', 'core_entities', TRUE),
  ('GolferGeek', '[USERNAME_001]', 'username', 'core_entities', TRUE),
  ('Orchestrator AI', '[ORGANIZATION_001]', 'organization', 'core_entities', TRUE)
ON CONFLICT (original_value) DO UPDATE SET
  pseudonym = EXCLUDED.pseudonym,
  data_type = EXCLUDED.data_type,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active;

-- LLM Providers and Models Tables
CREATE TABLE public.llm_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    api_base_url TEXT,
    configuration_json JSONB,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE public.llm_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_name TEXT NOT NULL,
    model_name TEXT NOT NULL,
    display_name VARCHAR(255),
    is_local BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(provider_name, model_name)
);

-- LLM Usage Table
CREATE TABLE public.llm_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id TEXT UNIQUE,
    user_id UUID,
    conversation_id UUID,
    provider_name TEXT,
    model_name TEXT,
    is_local BOOLEAN,
    input_tokens INTEGER,
    output_tokens INTEGER,
    total_cost NUMERIC,
    duration_ms INTEGER,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    pii_detected BOOLEAN,
    pii_types JSONB,
    pseudonyms_used INTEGER,
    pseudonym_types JSONB,
    sanitization_level TEXT
);

-- CIDAFM Commands table - Command definitions for Context-Import-Delegate-AFM system
CREATE TABLE public.cidafm_commands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(10) NOT NULL,
    description TEXT,
    default_active BOOLEAN DEFAULT FALSE,
    is_builtin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User CIDAFM Commands table - User-specific command preferences
CREATE TABLE public.user_cidafm_commands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    command_id UUID REFERENCES public.cidafm_commands(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, command_id)
);

-- Agent Conversations table - Conversation sessions with agents
CREATE TABLE public.agent_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id),
    agent_name VARCHAR(255),
    agent_type VARCHAR(100),
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    last_active_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,
    primary_work_product_id UUID,
    primary_work_product_type VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tasks table - Task execution tracking and results
CREATE TABLE public.tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id),
    agent_conversation_id UUID REFERENCES public.agent_conversations(id),
    method VARCHAR(255),
    params JSONB,
    prompt TEXT,
    response TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    progress_message TEXT,
    error_code VARCHAR(100),
    error_message TEXT,
    error_data JSONB,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    timeout_seconds INTEGER,
    deliverable_type VARCHAR(100),
    deliverable_metadata JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    llm_metadata JSONB,
    response_metadata JSONB,
    evaluation JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Projects table - Multi-step project management
CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id),
    conversation_id UUID REFERENCES public.agent_conversations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'planning',
    plan_json JSONB,
    current_step_id TEXT,
    parent_project_id UUID REFERENCES public.projects(id),
    hierarchy_level INTEGER DEFAULT 0,
    subproject_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    error_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Project Steps table - Individual steps within projects
CREATE TABLE public.project_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    step_id TEXT NOT NULL,
    step_index INTEGER NOT NULL,
    step_type TEXT NOT NULL CHECK (step_type IN ('agent_step', 'human_approval')),
    step_name TEXT NOT NULL,
    agent_name TEXT,
    prompt TEXT,
    dependencies TEXT[] DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'running', 'completed', 'failed', 'skipped')
    ),
    result JSONB,
    error_details JSONB,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, step_id)
);

-- Deliverables table - Work products and outputs
CREATE TABLE public.deliverables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id),
    conversation_id UUID REFERENCES public.agent_conversations(id),
    title VARCHAR(255),
    content TEXT,
    deliverable_type VARCHAR(100),
    format VARCHAR(50),
    version INTEGER DEFAULT 1,
    is_latest_version BOOLEAN DEFAULT true,
    parent_deliverable_id UUID REFERENCES public.deliverables(id),
    message_id UUID,
    created_by_agent VARCHAR(255),
    tags TEXT[],
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- LangGraph States table - State management for complex workflows
CREATE TABLE public.langgraph_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    plan_state JSONB,
    step_results JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    state_version INTEGER DEFAULT 1,
    last_synchronized TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Human Inputs table - Human-in-the-loop functionality
CREATE TABLE public.human_inputs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    request_type TEXT NOT NULL CHECK (request_type IN ('confirmation', 'choice', 'input', 'approval')),
    prompt TEXT NOT NULL,
    options JSONB,
    user_response TEXT,
    response_metadata JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'timeout', 'cancelled')),
    timeout_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================
-- COMPANY SCHEMA - KPI BUSINESS TABLES
-- =====================================

-- Companies table - Organization information
CREATE TABLE company.companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    industry VARCHAR(100),
    founded_year INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Departments table - Organizational structure
CREATE TABLE company.departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES company.companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    head_of_department VARCHAR(255),
    budget DECIMAL(15,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- KPI Metrics table - Key Performance Indicator definitions
CREATE TABLE company.kpi_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    metric_type VARCHAR(100),
    unit VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- KPI Goals table - Target values for metrics by department
CREATE TABLE company.kpi_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_id UUID REFERENCES company.departments(id) ON DELETE CASCADE,
    metric_id UUID REFERENCES company.kpi_metrics(id) ON DELETE CASCADE,
    target_value DECIMAL(15,4),
    period_start DATE,
    period_end DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- KPI Data table - Historical performance measurements
CREATE TABLE company.kpi_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_id UUID REFERENCES company.departments(id) ON DELETE CASCADE,
    metric_id UUID REFERENCES company.kpi_metrics(id) ON DELETE CASCADE,
    value DECIMAL(15,4) NOT NULL,
    date_recorded DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================
-- INDEXES FOR PERFORMANCE
-- =====================================

-- Orchestrator schema indexes
CREATE INDEX idx_orchestrator_users_email ON public.users(email);
CREATE INDEX idx_orchestrator_users_status ON public.users(status);
CREATE INDEX idx_orchestrator_llm_providers_name ON public.llm_providers(name);
CREATE INDEX idx_orchestrator_llm_providers_active ON public.llm_providers(is_active);
CREATE INDEX idx_orchestrator_llm_models_provider ON public.llm_models(provider_name);
CREATE INDEX idx_orchestrator_llm_models_active ON public.llm_models(is_active);
CREATE INDEX idx_orchestrator_cidafm_commands_name ON public.cidafm_commands(name);
CREATE INDEX idx_orchestrator_cidafm_commands_type ON public.cidafm_commands(type);
CREATE INDEX idx_orchestrator_user_cidafm_user ON public.user_cidafm_commands(user_id);
CREATE INDEX idx_orchestrator_user_cidafm_active ON public.user_cidafm_commands(is_active);
CREATE INDEX idx_orchestrator_agent_conversations_user ON public.agent_conversations(user_id);
CREATE INDEX idx_orchestrator_agent_conversations_agent ON public.agent_conversations(agent_name);
CREATE INDEX idx_orchestrator_agent_conversations_active ON public.agent_conversations(last_active_at);
CREATE INDEX idx_orchestrator_tasks_user ON public.tasks(user_id);
CREATE INDEX idx_orchestrator_tasks_conversation ON public.tasks(agent_conversation_id);
CREATE INDEX idx_orchestrator_tasks_status ON public.tasks(status);
CREATE INDEX idx_orchestrator_tasks_created ON public.tasks(created_at DESC);
CREATE INDEX idx_orchestrator_projects_user ON public.projects(user_id);
CREATE INDEX idx_orchestrator_projects_conversation ON public.projects(conversation_id);
CREATE INDEX idx_orchestrator_projects_status ON public.projects(status);
CREATE INDEX idx_orchestrator_projects_parent ON public.projects(parent_project_id);
CREATE INDEX idx_orchestrator_project_steps_project ON public.project_steps(project_id);
CREATE INDEX idx_orchestrator_project_steps_status ON public.project_steps(status);
CREATE INDEX idx_orchestrator_project_steps_index ON public.project_steps(project_id, step_index);
CREATE INDEX idx_orchestrator_deliverables_user ON public.deliverables(user_id);
CREATE INDEX idx_orchestrator_deliverables_conversation ON public.deliverables(conversation_id);
CREATE INDEX idx_orchestrator_deliverables_type ON public.deliverables(deliverable_type);
CREATE INDEX idx_orchestrator_deliverables_latest ON public.deliverables(is_latest_version);
CREATE INDEX idx_orchestrator_langgraph_states_project ON public.langgraph_states(project_id);
CREATE INDEX idx_orchestrator_langgraph_states_version ON public.langgraph_states(state_version);
CREATE INDEX idx_orchestrator_human_inputs_task ON public.human_inputs(task_id);
CREATE INDEX idx_orchestrator_human_inputs_user ON public.human_inputs(user_id);
CREATE INDEX idx_orchestrator_human_inputs_status ON public.human_inputs(status);
CREATE INDEX idx_orchestrator_human_inputs_timeout ON public.human_inputs(timeout_at) WHERE status = 'pending';
CREATE INDEX idx_orchestrator_human_inputs_created ON public.human_inputs(created_at DESC);

-- Company schema indexes
CREATE INDEX idx_company_companies_name ON company.companies(name);
CREATE INDEX idx_company_companies_industry ON company.companies(industry);
CREATE INDEX idx_company_departments_company ON company.departments(company_id);
CREATE INDEX idx_company_departments_name ON company.departments(name);
CREATE INDEX idx_company_kpi_metrics_name ON company.kpi_metrics(name);
CREATE INDEX idx_company_kpi_metrics_type ON company.kpi_metrics(metric_type);
CREATE INDEX idx_company_kpi_goals_department ON company.kpi_goals(department_id);
CREATE INDEX idx_company_kpi_goals_metric ON company.kpi_goals(metric_id);
CREATE INDEX idx_company_kpi_goals_period ON company.kpi_goals(period_start, period_end);
CREATE INDEX idx_company_kpi_data_department ON company.kpi_data(department_id);
CREATE INDEX idx_company_kpi_data_metric ON company.kpi_data(metric_id);
CREATE INDEX idx_company_kpi_data_date ON company.kpi_data(date_recorded);
CREATE INDEX idx_company_kpi_data_dept_metric_date ON company.kpi_data(department_id, metric_id, date_recorded);

-- =====================================
-- UPDATE TRIGGERS
-- =====================================

-- Create update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Orchestrator schema triggers
CREATE TRIGGER update_orchestrator_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orchestrator_llm_providers_updated_at BEFORE UPDATE ON public.llm_providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orchestrator_llm_models_updated_at BEFORE UPDATE ON public.llm_models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orchestrator_cidafm_commands_updated_at BEFORE UPDATE ON public.cidafm_commands
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orchestrator_agent_conversations_updated_at BEFORE UPDATE ON public.agent_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orchestrator_tasks_updated_at BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orchestrator_projects_updated_at BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orchestrator_project_steps_updated_at BEFORE UPDATE ON public.project_steps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orchestrator_deliverables_updated_at BEFORE UPDATE ON public.deliverables
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orchestrator_langgraph_states_updated_at BEFORE UPDATE ON public.langgraph_states
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orchestrator_human_inputs_updated_at BEFORE UPDATE ON public.human_inputs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Company schema triggers
CREATE TRIGGER update_company_companies_updated_at BEFORE UPDATE ON company.companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_company_departments_updated_at BEFORE UPDATE ON company.departments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_company_kpi_metrics_updated_at BEFORE UPDATE ON company.kpi_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_company_kpi_goals_updated_at BEFORE UPDATE ON company.kpi_goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_company_kpi_data_updated_at BEFORE UPDATE ON company.kpi_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();