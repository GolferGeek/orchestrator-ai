-- Migration: Add caller fields to existing llm_usage table
-- Date: 2025-01-03
-- Description: Add caller_type, caller_name, and conversation_id to existing llm_usage table

-- Add new columns for caller tracking
ALTER TABLE public.llm_usage 
ADD COLUMN IF NOT EXISTS caller_type VARCHAR(100);

ALTER TABLE public.llm_usage 
ADD COLUMN IF NOT EXISTS caller_name VARCHAR(255);

ALTER TABLE public.llm_usage 
ADD COLUMN IF NOT EXISTS conversation_id UUID NULL;

-- Add comments for the new columns
COMMENT ON COLUMN public.llm_usage.caller_type IS 'Type of caller: agent, api, user, system, service';
COMMENT ON COLUMN public.llm_usage.caller_name IS 'Specific name: metrics-agent, user-chat, api-endpoint, etc.';
COMMENT ON COLUMN public.llm_usage.conversation_id IS 'Links to conversation/session context (nullable for non-conversational calls)';

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_llm_usage_caller ON public.llm_usage(caller_type, caller_name);
CREATE INDEX IF NOT EXISTS idx_llm_usage_conversation ON public.llm_usage(conversation_id) WHERE conversation_id IS NOT NULL;

-- Update the analytics view to include the new fields
DROP VIEW IF EXISTS public.llm_usage_analytics;

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

COMMENT ON VIEW public.llm_usage_analytics IS 'Daily analytics view for LLM usage patterns and costs including caller information';
