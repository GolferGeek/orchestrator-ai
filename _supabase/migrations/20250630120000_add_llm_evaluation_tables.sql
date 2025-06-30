-- LLM Evaluation Enhancements Migration
-- This migration adds tables for LLM provider/model selection, CIDAFM commands, and evaluation features

-- Create LLM Providers table
CREATE TABLE public.providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    api_base_url VARCHAR(255),
    auth_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deprecated')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create LLM Models table
CREATE TABLE public.models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    model_id VARCHAR(255) NOT NULL,
    pricing_input_per_1k DECIMAL(10,6),
    pricing_output_per_1k DECIMAL(10,6),
    supports_thinking BOOLEAN DEFAULT false,
    max_tokens INTEGER,
    context_window INTEGER,
    strengths TEXT[],
    weaknesses TEXT[],
    use_cases TEXT[],
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deprecated')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(provider_id, model_id)
);

-- Create CIDAFM Commands table (built-in commands)
CREATE TABLE public.cidafm_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(1) NOT NULL CHECK (type IN ('^', '&', '!')),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    default_active BOOLEAN DEFAULT false,
    is_builtin BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(type, name)
);

-- Create User Custom CIDAFM Commands table
CREATE TABLE public.user_cidafm_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type VARCHAR(1) NOT NULL CHECK (type IN ('^', '&', '!')),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, type, name)
);

-- Create User Usage Statistics table
CREATE TABLE public.user_usage_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    provider_id UUID REFERENCES public.providers(id) ON DELETE SET NULL,
    model_id UUID REFERENCES public.models(id) ON DELETE SET NULL,
    total_requests INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_cost DECIMAL(10,6) DEFAULT 0,
    avg_response_time_ms INTEGER,
    avg_user_rating DECIMAL(3,2),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, date, provider_id, model_id)
);

-- Enhance Messages table with LLM and evaluation fields
ALTER TABLE public.messages 
ADD COLUMN provider_id UUID REFERENCES public.providers(id) ON DELETE SET NULL,
ADD COLUMN model_id UUID REFERENCES public.models(id) ON DELETE SET NULL,
ADD COLUMN input_tokens INTEGER,
ADD COLUMN output_tokens INTEGER,
ADD COLUMN total_cost DECIMAL(10,6),
ADD COLUMN response_time_ms INTEGER,
ADD COLUMN langsmith_run_id VARCHAR(255),
ADD COLUMN user_rating INTEGER CHECK (user_rating BETWEEN 1 AND 5),
ADD COLUMN speed_rating INTEGER CHECK (speed_rating BETWEEN 1 AND 5),
ADD COLUMN accuracy_rating INTEGER CHECK (accuracy_rating BETWEEN 1 AND 5),
ADD COLUMN user_notes TEXT,
ADD COLUMN evaluation_timestamp TIMESTAMPTZ,
ADD COLUMN cidafm_options JSONB,
ADD COLUMN evaluation_details JSONB;

-- Create indexes for better query performance
CREATE INDEX idx_providers_status ON public.providers(status);
CREATE INDEX idx_models_provider_id ON public.models(provider_id);
CREATE INDEX idx_models_status ON public.models(status);
CREATE INDEX idx_cidafm_commands_type ON public.cidafm_commands(type);
CREATE INDEX idx_user_cidafm_commands_user_id ON public.user_cidafm_commands(user_id);
CREATE INDEX idx_user_usage_stats_user_date ON public.user_usage_stats(user_id, date);
CREATE INDEX idx_messages_provider_model ON public.messages(provider_id, model_id);
CREATE INDEX idx_messages_user_rating ON public.messages(user_rating) WHERE user_rating IS NOT NULL;
CREATE INDEX idx_messages_total_cost ON public.messages(total_cost) WHERE total_cost IS NOT NULL;
CREATE INDEX idx_messages_cidafm_options ON public.messages USING GIN(cidafm_options) WHERE cidafm_options IS NOT NULL;

-- Create updated_at triggers for new tables
CREATE TRIGGER update_providers_updated_at
    BEFORE UPDATE ON public.providers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_models_updated_at
    BEFORE UPDATE ON public.models
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cidafm_commands_updated_at
    BEFORE UPDATE ON public.cidafm_commands
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_cidafm_commands_updated_at
    BEFORE UPDATE ON public.user_cidafm_commands
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_usage_stats_updated_at
    BEFORE UPDATE ON public.user_usage_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE public.providers IS 'LLM providers (OpenAI, Anthropic, etc.)';
COMMENT ON TABLE public.models IS 'LLM models with pricing and capability information';
COMMENT ON TABLE public.cidafm_commands IS 'Built-in CIDAFM (AI Function Module) commands';
COMMENT ON TABLE public.user_cidafm_commands IS 'User-created custom CIDAFM commands';
COMMENT ON TABLE public.user_usage_stats IS 'Daily aggregated usage statistics per user/provider/model';

COMMENT ON COLUMN public.messages.provider_id IS 'LLM provider used for this message';
COMMENT ON COLUMN public.messages.model_id IS 'LLM model used for this message';
COMMENT ON COLUMN public.messages.input_tokens IS 'Number of input tokens consumed';
COMMENT ON COLUMN public.messages.output_tokens IS 'Number of output tokens generated';
COMMENT ON COLUMN public.messages.total_cost IS 'Total cost in USD for this message';
COMMENT ON COLUMN public.messages.response_time_ms IS 'Response time in milliseconds';
COMMENT ON COLUMN public.messages.langsmith_run_id IS 'LangSmith run ID for detailed tracing';
COMMENT ON COLUMN public.messages.user_rating IS 'Overall user rating (1-5)';
COMMENT ON COLUMN public.messages.speed_rating IS 'User rating for response speed (1-5)';
COMMENT ON COLUMN public.messages.accuracy_rating IS 'User rating for response accuracy (1-5)';
COMMENT ON COLUMN public.messages.user_notes IS 'User notes and feedback';
COMMENT ON COLUMN public.messages.evaluation_timestamp IS 'When the user evaluated this message';
COMMENT ON COLUMN public.messages.cidafm_options IS 'CIDAFM state and command options used';
COMMENT ON COLUMN public.messages.evaluation_details IS 'Additional evaluation metadata';