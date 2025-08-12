-- Production Environment Database - Complete Setup
-- Contains both orchestrator platform schema and company KPI schema for production use
-- This database is used for real business operations

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================
-- CREATE SCHEMAS
-- =====================================

CREATE SCHEMA IF NOT EXISTS orchestrator;
CREATE SCHEMA IF NOT EXISTS company;

-- =====================================
-- ORCHESTRATOR SCHEMA - PLATFORM TABLES
-- =====================================

-- Users table - Core user management with full profile support
CREATE TABLE orchestrator.users (
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
CREATE TABLE orchestrator.llm_providers (
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

-- LLM Models table - AI model specifications and pricing
CREATE TABLE orchestrator.llm_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID REFERENCES orchestrator.llm_providers(id),
    model_name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    model_type VARCHAR(100),
    context_window INTEGER,
    max_output_tokens INTEGER,
    model_parameters_json JSONB DEFAULT '{}'::jsonb,
    pricing_info_json JSONB,
    capabilities JSONB,
    is_active BOOLEAN DEFAULT true,
    model_version VARCHAR(100),
    training_data_cutoff DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- CIDAFM Commands table - Command definitions for Context-Import-Delegate-AFM system
CREATE TABLE orchestrator.cidafm_commands (
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
CREATE TABLE orchestrator.user_cidafm_commands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES orchestrator.users(id) ON DELETE CASCADE,
    command_id UUID REFERENCES orchestrator.cidafm_commands(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, command_id)
);

-- Agent Conversations table - Conversation sessions with agents
CREATE TABLE orchestrator.agent_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES orchestrator.users(id),
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
CREATE TABLE orchestrator.tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES orchestrator.users(id),
    agent_conversation_id UUID REFERENCES orchestrator.agent_conversations(id),
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
CREATE TABLE orchestrator.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES orchestrator.users(id),
    conversation_id UUID REFERENCES orchestrator.agent_conversations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'planning',
    plan_json JSONB,
    current_step_id TEXT,
    parent_project_id UUID REFERENCES orchestrator.projects(id),
    hierarchy_level INTEGER DEFAULT 0,
    subproject_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    error_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Project Steps table - Individual steps within projects
CREATE TABLE orchestrator.project_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES orchestrator.projects(id) ON DELETE CASCADE,
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
CREATE TABLE orchestrator.deliverables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES orchestrator.users(id),
    conversation_id UUID REFERENCES orchestrator.agent_conversations(id),
    title VARCHAR(255),
    content TEXT,
    deliverable_type VARCHAR(100),
    format VARCHAR(50),
    version INTEGER DEFAULT 1,
    is_latest_version BOOLEAN DEFAULT true,
    parent_deliverable_id UUID REFERENCES orchestrator.deliverables(id),
    message_id UUID,
    created_by_agent VARCHAR(255),
    tags TEXT[],
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- LangGraph States table - State management for complex workflows
CREATE TABLE orchestrator.langgraph_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES orchestrator.projects(id) ON DELETE CASCADE,
    plan_state JSONB,
    step_results JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    state_version INTEGER DEFAULT 1,
    last_synchronized TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Human Inputs table - Human-in-the-loop functionality
CREATE TABLE orchestrator.human_inputs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES orchestrator.tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES orchestrator.users(id) ON DELETE CASCADE,
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
CREATE INDEX idx_orchestrator_users_email ON orchestrator.users(email);
CREATE INDEX idx_orchestrator_users_status ON orchestrator.users(status);
CREATE INDEX idx_orchestrator_llm_providers_name ON orchestrator.llm_providers(name);
CREATE INDEX idx_orchestrator_llm_providers_active ON orchestrator.llm_providers(is_active);
CREATE INDEX idx_orchestrator_llm_models_provider ON orchestrator.llm_models(provider_id);
CREATE INDEX idx_orchestrator_llm_models_active ON orchestrator.llm_models(is_active);
CREATE INDEX idx_orchestrator_cidafm_commands_name ON orchestrator.cidafm_commands(name);
CREATE INDEX idx_orchestrator_cidafm_commands_type ON orchestrator.cidafm_commands(type);
CREATE INDEX idx_orchestrator_user_cidafm_user ON orchestrator.user_cidafm_commands(user_id);
CREATE INDEX idx_orchestrator_user_cidafm_active ON orchestrator.user_cidafm_commands(is_active);
CREATE INDEX idx_orchestrator_agent_conversations_user ON orchestrator.agent_conversations(user_id);
CREATE INDEX idx_orchestrator_agent_conversations_agent ON orchestrator.agent_conversations(agent_name);
CREATE INDEX idx_orchestrator_agent_conversations_active ON orchestrator.agent_conversations(last_active_at);
CREATE INDEX idx_orchestrator_tasks_user ON orchestrator.tasks(user_id);
CREATE INDEX idx_orchestrator_tasks_conversation ON orchestrator.tasks(agent_conversation_id);
CREATE INDEX idx_orchestrator_tasks_status ON orchestrator.tasks(status);
CREATE INDEX idx_orchestrator_tasks_created ON orchestrator.tasks(created_at DESC);
CREATE INDEX idx_orchestrator_projects_user ON orchestrator.projects(user_id);
CREATE INDEX idx_orchestrator_projects_conversation ON orchestrator.projects(conversation_id);
CREATE INDEX idx_orchestrator_projects_status ON orchestrator.projects(status);
CREATE INDEX idx_orchestrator_projects_parent ON orchestrator.projects(parent_project_id);
CREATE INDEX idx_orchestrator_project_steps_project ON orchestrator.project_steps(project_id);
CREATE INDEX idx_orchestrator_project_steps_status ON orchestrator.project_steps(status);
CREATE INDEX idx_orchestrator_project_steps_index ON orchestrator.project_steps(project_id, step_index);
CREATE INDEX idx_orchestrator_deliverables_user ON orchestrator.deliverables(user_id);
CREATE INDEX idx_orchestrator_deliverables_conversation ON orchestrator.deliverables(conversation_id);
CREATE INDEX idx_orchestrator_deliverables_type ON orchestrator.deliverables(deliverable_type);
CREATE INDEX idx_orchestrator_deliverables_latest ON orchestrator.deliverables(is_latest_version);
CREATE INDEX idx_orchestrator_langgraph_states_project ON orchestrator.langgraph_states(project_id);
CREATE INDEX idx_orchestrator_langgraph_states_version ON orchestrator.langgraph_states(state_version);
CREATE INDEX idx_orchestrator_human_inputs_task ON orchestrator.human_inputs(task_id);
CREATE INDEX idx_orchestrator_human_inputs_user ON orchestrator.human_inputs(user_id);
CREATE INDEX idx_orchestrator_human_inputs_status ON orchestrator.human_inputs(status);
CREATE INDEX idx_orchestrator_human_inputs_timeout ON orchestrator.human_inputs(timeout_at) WHERE status = 'pending';
CREATE INDEX idx_orchestrator_human_inputs_created ON orchestrator.human_inputs(created_at DESC);

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
CREATE TRIGGER update_orchestrator_users_updated_at BEFORE UPDATE ON orchestrator.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orchestrator_llm_providers_updated_at BEFORE UPDATE ON orchestrator.llm_providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orchestrator_llm_models_updated_at BEFORE UPDATE ON orchestrator.llm_models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orchestrator_cidafm_commands_updated_at BEFORE UPDATE ON orchestrator.cidafm_commands
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orchestrator_agent_conversations_updated_at BEFORE UPDATE ON orchestrator.agent_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orchestrator_tasks_updated_at BEFORE UPDATE ON orchestrator.tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orchestrator_projects_updated_at BEFORE UPDATE ON orchestrator.projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orchestrator_project_steps_updated_at BEFORE UPDATE ON orchestrator.project_steps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orchestrator_deliverables_updated_at BEFORE UPDATE ON orchestrator.deliverables
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orchestrator_langgraph_states_updated_at BEFORE UPDATE ON orchestrator.langgraph_states
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orchestrator_human_inputs_updated_at BEFORE UPDATE ON orchestrator.human_inputs
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