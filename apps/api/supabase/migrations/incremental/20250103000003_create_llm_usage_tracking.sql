-- Migration: Create LLM Usage Tracking Table
-- Date: 2025-01-03
-- Description: Add persistent storage for LLM usage tracking and analytics

-- Create LLM usage tracking table
CREATE TABLE public.llm_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id VARCHAR(255) UNIQUE NOT NULL,
    
    -- Request details
    user_id UUID,
    caller_type VARCHAR(100), -- 'agent', 'api', 'user', 'system', 'service'
    caller_name VARCHAR(255), -- Specific name: 'metrics-agent', 'user-chat', 'api-endpoint', etc.
    conversation_id UUID NULL, -- Links to conversation/session context (nullable for non-conversational calls)
    provider_id UUID REFERENCES public.llm_providers(id),
    model_id UUID REFERENCES public.llm_models(id),
    provider_name VARCHAR(255) NOT NULL,
    model_name VARCHAR(255) NOT NULL,
    
    -- Routing information
    is_local BOOLEAN DEFAULT FALSE,
    model_tier VARCHAR(50), -- ultra-fast, general, fast-thinking
    fallback_used BOOLEAN DEFAULT FALSE,
    routing_reason TEXT,
    
    -- Usage metrics
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
    
    -- Cost tracking
    input_cost DECIMAL(10, 6) DEFAULT 0.0,
    output_cost DECIMAL(10, 6) DEFAULT 0.0,
    total_cost DECIMAL(10, 6) GENERATED ALWAYS AS (input_cost + output_cost) STORED,
    
    -- Performance metrics
    duration_ms INTEGER NOT NULL,
    response_time_ms INTEGER,
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'completed', -- started, completed, error, timeout
    error_message TEXT,
    
    -- Request classification
    complexity_level VARCHAR(20), -- simple, medium, complex
    complexity_score INTEGER,
    data_classification VARCHAR(50), -- public, internal, confidential, restricted
    
    -- Timestamps
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient queries
CREATE INDEX idx_llm_usage_user_id ON public.llm_usage(user_id);
CREATE INDEX idx_llm_usage_caller ON public.llm_usage(caller_type, caller_name);
CREATE INDEX idx_llm_usage_conversation ON public.llm_usage(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX idx_llm_usage_provider_model ON public.llm_usage(provider_name, model_name);
CREATE INDEX idx_llm_usage_tier ON public.llm_usage(model_tier, is_local);
CREATE INDEX idx_llm_usage_status ON public.llm_usage(status);
CREATE INDEX idx_llm_usage_timestamps ON public.llm_usage(started_at, completed_at);
CREATE INDEX idx_llm_usage_cost ON public.llm_usage(total_cost) WHERE total_cost > 0;
CREATE INDEX idx_llm_usage_tokens ON public.llm_usage(total_tokens);

-- Create partial index for errors
CREATE INDEX idx_llm_usage_errors ON public.llm_usage(error_message, started_at) 
WHERE status = 'error';

-- Create partial index for local vs external usage
CREATE INDEX idx_llm_usage_local_external ON public.llm_usage(is_local, model_tier, started_at);

-- Add table comments
COMMENT ON TABLE public.llm_usage IS 'Tracks individual LLM API calls for analytics, cost tracking, and monitoring';
COMMENT ON COLUMN public.llm_usage.run_id IS 'Unique identifier for correlating logs and requests';
COMMENT ON COLUMN public.llm_usage.model_tier IS 'Three-tier classification: ultra-fast, general, fast-thinking';
COMMENT ON COLUMN public.llm_usage.fallback_used IS 'Whether external fallback was used when local models unavailable';
COMMENT ON COLUMN public.llm_usage.complexity_score IS 'Computed complexity score (1-10) for request analysis';
COMMENT ON COLUMN public.llm_usage.data_classification IS 'CIDAFM data classification level';

-- Create a view for easy analytics
CREATE VIEW public.llm_usage_analytics AS
SELECT 
    DATE_TRUNC('day', started_at) as date,
    caller_type,
    caller_name,
    provider_name,
    model_name,
    model_tier,
    is_local,
    COUNT(*) as request_count,
    SUM(total_tokens) as total_tokens,
    SUM(total_cost) as total_cost,
    AVG(duration_ms) as avg_duration_ms,
    COUNT(CASE WHEN status = 'error' THEN 1 END) as error_count,
    COUNT(CASE WHEN fallback_used THEN 1 END) as fallback_count,
    COUNT(DISTINCT conversation_id) as unique_conversations
FROM public.llm_usage
GROUP BY 
    DATE_TRUNC('day', started_at),
    caller_type,
    caller_name,
    provider_name,
    model_name,
    model_tier,
    is_local
ORDER BY date DESC, request_count DESC;

COMMENT ON VIEW public.llm_usage_analytics IS 'Daily analytics view for LLM usage patterns and costs';

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_llm_usage_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_llm_usage_updated_at
    BEFORE UPDATE ON public.llm_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_llm_usage_updated_at();
