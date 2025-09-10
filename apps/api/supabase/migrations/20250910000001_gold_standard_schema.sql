-- Gold Standard Schema - Essential tables for PII testing
-- This migration creates the core tables needed for the application

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    role VARCHAR(50),
    roles JSONB DEFAULT '["user"]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Pseudonym Dictionary Table (for dictionary-based pseudonymization)
CREATE TABLE public.pseudonym_dictionaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_value TEXT UNIQUE NOT NULL,
    pseudonym TEXT NOT NULL,
    data_type VARCHAR(100) NOT NULL,
    category VARCHAR(100),
    frequency_weight INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- PII Patterns Table (for pattern-based detection)
CREATE TABLE public.redaction_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    pattern_regex TEXT NOT NULL,
    replacement TEXT NOT NULL,
    description TEXT,
    category VARCHAR(100) DEFAULT 'pii_builtin',
    priority INTEGER DEFAULT 50,
    is_active BOOLEAN DEFAULT TRUE,
    severity VARCHAR(50),
    data_type VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- LLM Providers Table
CREATE TABLE public.llm_providers (
    name TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    api_base_url TEXT,
    configuration_json JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- LLM Models Table  
CREATE TABLE public.llm_models (
    model_name TEXT NOT NULL,
    provider_name TEXT NOT NULL,
    display_name TEXT,
    model_type TEXT DEFAULT 'text-generation',
    context_window INTEGER DEFAULT 4096,
    max_output_tokens INTEGER DEFAULT 2048,
    model_tier TEXT,
    is_local BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (provider_name, model_name),
    FOREIGN KEY (provider_name) REFERENCES public.llm_providers(name) ON DELETE CASCADE
);

-- LLM Usage Table (for tracking and auditing)
CREATE TABLE public.llm_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id TEXT UNIQUE,
    user_id UUID,
    conversation_id UUID,
    provider_name TEXT,
    model_name TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    total_cost NUMERIC,
    duration_ms INTEGER,
    status TEXT DEFAULT 'completed',
    pii_detected BOOLEAN DEFAULT FALSE,
    pii_types JSONB DEFAULT '[]'::jsonb,
    pseudonyms_used INTEGER DEFAULT 0,
    pseudonym_types JSONB DEFAULT '[]'::jsonb,
    sanitization_level TEXT DEFAULT 'none',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Agent Conversations Table
CREATE TABLE public.agent_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    agent_name VARCHAR(255),
    agent_type VARCHAR(100),
    started_at TIMESTAMP WITH TIME ZONE,
    last_active_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tasks Table
CREATE TABLE public.tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    agent_conversation_id UUID,
    method VARCHAR(255),
    prompt TEXT,
    response TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Deliverables Table  
CREATE TABLE public.deliverables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    conversation_id UUID,
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Companies Table (moved from company schema to public)
CREATE TABLE public.companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    industry VARCHAR(100),
    founded_year INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Departments Table (moved from company schema to public)
CREATE TABLE public.departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID,
    name VARCHAR(255) NOT NULL,
    head_of_department VARCHAR(255),
    budget NUMERIC(15,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- KPI Metrics Table (moved from company schema to public)
CREATE TABLE public.kpi_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    metric_type VARCHAR(100),
    unit VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- KPI Data Table (moved from company schema to public)
CREATE TABLE public.kpi_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_id UUID,
    metric_id UUID,
    value NUMERIC(15,4) NOT NULL,
    date_recorded DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- KPI Goals Table (moved from company schema to public)
CREATE TABLE public.kpi_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_id UUID,
    metric_id UUID,
    target_value NUMERIC(15,4),
    period_start DATE,
    period_end DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key constraints
ALTER TABLE public.agent_conversations ADD CONSTRAINT agent_conversations_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id);
    
ALTER TABLE public.tasks ADD CONSTRAINT tasks_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id);
    
ALTER TABLE public.tasks ADD CONSTRAINT tasks_agent_conversation_id_fkey 
    FOREIGN KEY (agent_conversation_id) REFERENCES public.agent_conversations(id);
    
ALTER TABLE public.deliverables ADD CONSTRAINT deliverables_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id);

-- Add foreign keys for business tables
ALTER TABLE public.departments ADD CONSTRAINT departments_company_id_fkey 
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
    
ALTER TABLE public.kpi_data ADD CONSTRAINT kpi_data_department_id_fkey 
    FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;
    
ALTER TABLE public.kpi_data ADD CONSTRAINT kpi_data_metric_id_fkey 
    FOREIGN KEY (metric_id) REFERENCES public.kpi_metrics(id) ON DELETE CASCADE;
    
ALTER TABLE public.kpi_goals ADD CONSTRAINT kpi_goals_department_id_fkey 
    FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;
    
ALTER TABLE public.kpi_goals ADD CONSTRAINT kpi_goals_metric_id_fkey 
    FOREIGN KEY (metric_id) REFERENCES public.kpi_metrics(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_pseudonym_dictionaries_original_value ON public.pseudonym_dictionaries(original_value);
CREATE INDEX idx_redaction_patterns_active ON public.redaction_patterns(is_active, priority);
CREATE INDEX idx_llm_usage_created_at ON public.llm_usage(created_at);
CREATE INDEX idx_agent_conversations_user_id ON public.agent_conversations(user_id);
CREATE INDEX idx_tasks_conversation_id ON public.tasks(agent_conversation_id);