-- Migration: Add MCP tracking tables for intelligent Supabase MCP system
-- Date: 2025-07-25
-- Description: Adds comprehensive tracking for MCP tool executions, failures, and user feedback

-- ================== MCP EXECUTIONS TABLE ==================
-- Tracks all MCP tool executions with comprehensive metadata
CREATE TABLE IF NOT EXISTS public.mcp_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mcp_name VARCHAR NOT NULL,
  tool_name VARCHAR NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agent_conversation_id UUID REFERENCES public.agent_conversations(id) ON DELETE SET NULL, -- NULLABLE - links to agent if initiated by agent
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL, -- NULLABLE - links to session if in chat context
  request_data JSONB DEFAULT '{}',
  response_data JSONB DEFAULT '{}',
  llm_provider VARCHAR,
  llm_model VARCHAR,
  execution_time_ms INTEGER,
  status VARCHAR NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'error', 'timeout', 'cancelled')),
  error_message TEXT,
  feedback_token UUID UNIQUE DEFAULT gen_random_uuid(),
  retry_count INTEGER DEFAULT 0,
  context_used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ================== MCP FAILURES TABLE ==================
-- Detailed tracking of MCP execution failures for learning and improvement
CREATE TABLE IF NOT EXISTS public.mcp_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES public.mcp_executions(id) ON DELETE CASCADE,
  error_type VARCHAR NOT NULL,
  error_code VARCHAR,
  error_details JSONB DEFAULT '{}',
  retry_attempt INTEGER DEFAULT 1,
  sql_attempted TEXT, -- For SQL generation failures, store the attempted SQL
  context_before_failure JSONB DEFAULT '{}', -- Context state when failure occurred
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  resolved BOOLEAN DEFAULT false
);

-- ================== MCP FEEDBACK TABLE ==================
-- User feedback collection with dual rating system (thumbs + 1-5 stars)
CREATE TABLE IF NOT EXISTS public.mcp_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_token UUID NOT NULL UNIQUE REFERENCES public.mcp_executions(feedback_token) ON DELETE CASCADE,
  execution_id UUID NOT NULL REFERENCES public.mcp_executions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating VARCHAR CHECK (rating IN ('up', 'down')), -- Quick thumbs up/down
  rating_score INTEGER CHECK (rating_score >= 1 AND rating_score <= 5), -- Detailed 1-5 star rating
  comment TEXT,
  helpful_tags TEXT[] DEFAULT ARRAY[]::TEXT[], -- Tags like 'accurate', 'fast', 'confusing', etc.
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ================== INDEXES FOR PERFORMANCE ==================
-- MCP Executions indexes
CREATE INDEX idx_mcp_executions_user_id ON public.mcp_executions(user_id);
CREATE INDEX idx_mcp_executions_agent_conversation_id ON public.mcp_executions(agent_conversation_id);
CREATE INDEX idx_mcp_executions_session_id ON public.mcp_executions(session_id);
CREATE INDEX idx_mcp_executions_created_at ON public.mcp_executions(created_at DESC);
CREATE INDEX idx_mcp_executions_mcp_tool ON public.mcp_executions(mcp_name, tool_name);
CREATE INDEX idx_mcp_executions_status ON public.mcp_executions(status);
CREATE INDEX idx_mcp_executions_llm_provider ON public.mcp_executions(llm_provider, llm_model);
CREATE INDEX idx_mcp_executions_feedback_token ON public.mcp_executions(feedback_token);

-- MCP Failures indexes
CREATE INDEX idx_mcp_failures_execution_id ON public.mcp_failures(execution_id);
CREATE INDEX idx_mcp_failures_error_type ON public.mcp_failures(error_type);
CREATE INDEX idx_mcp_failures_created_at ON public.mcp_failures(created_at DESC);

-- MCP Feedback indexes
CREATE INDEX idx_mcp_feedback_execution_id ON public.mcp_feedback(execution_id);
CREATE INDEX idx_mcp_feedback_user_id ON public.mcp_feedback(user_id);
CREATE INDEX idx_mcp_feedback_rating ON public.mcp_feedback(rating);
CREATE INDEX idx_mcp_feedback_rating_score ON public.mcp_feedback(rating_score);
CREATE INDEX idx_mcp_feedback_created_at ON public.mcp_feedback(created_at DESC);

-- ================== RLS POLICIES ==================
-- Enable RLS on all MCP tables
ALTER TABLE public.mcp_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_feedback ENABLE ROW LEVEL SECURITY;

-- MCP Executions policies
CREATE POLICY "Users can view their own MCP executions"
    ON public.mcp_executions FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can create their own MCP executions"
    ON public.mcp_executions FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own MCP executions"
    ON public.mcp_executions FOR UPDATE
    USING (user_id = auth.uid());

-- MCP Failures policies
CREATE POLICY "Users can view failures for their own MCP executions"
    ON public.mcp_failures FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.mcp_executions 
        WHERE id = mcp_failures.execution_id 
        AND user_id = auth.uid()
    ));

CREATE POLICY "System can create MCP failure records"
    ON public.mcp_failures FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.mcp_executions 
        WHERE id = mcp_failures.execution_id 
        AND user_id = auth.uid()
    ));

-- MCP Feedback policies
CREATE POLICY "Users can view their own MCP feedback"
    ON public.mcp_feedback FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can create feedback for their own MCP executions"
    ON public.mcp_feedback FOR INSERT
    WITH CHECK (user_id = auth.uid() AND EXISTS (
        SELECT 1 FROM public.mcp_executions 
        WHERE id = mcp_feedback.execution_id 
        AND user_id = auth.uid()
    ));

CREATE POLICY "Users can update their own MCP feedback"
    ON public.mcp_feedback FOR UPDATE
    USING (user_id = auth.uid());

-- ================== TRIGGERS ==================
-- Auto-update updated_at columns
CREATE TRIGGER update_mcp_executions_updated_at 
    BEFORE UPDATE ON public.mcp_executions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mcp_feedback_updated_at 
    BEFORE UPDATE ON public.mcp_feedback
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ================== USEFUL VIEWS ==================
-- MCP execution summary view
CREATE OR REPLACE VIEW public.mcp_execution_summary AS
SELECT 
    me.id,
    me.mcp_name,
    me.tool_name,
    me.user_id,
    u.email as user_email,
    u.display_name as user_name,
    me.agent_conversation_id,
    ac.agent_name,
    ac.agent_type,
    me.status,
    me.execution_time_ms,
    me.llm_provider,
    me.llm_model,
    me.retry_count,
    me.context_used,
    me.created_at,
    CASE WHEN mf.id IS NOT NULL THEN true ELSE false END as has_failure,
    mf.error_type,
    mf.error_code,
    CASE WHEN mfb.id IS NOT NULL THEN true ELSE false END as has_feedback,
    mfb.rating,
    mfb.rating_score
FROM public.mcp_executions me
LEFT JOIN public.users u ON me.user_id = u.id
LEFT JOIN public.agent_conversations ac ON me.agent_conversation_id = ac.id
LEFT JOIN public.mcp_failures mf ON me.id = mf.execution_id
LEFT JOIN public.mcp_feedback mfb ON me.id = mfb.execution_id;

-- MCP usage analytics view
CREATE OR REPLACE VIEW public.mcp_usage_analytics AS
SELECT 
    mcp_name,
    tool_name,
    COUNT(*) as total_executions,
    COUNT(*) FILTER (WHERE status = 'success') as successful_executions,
    COUNT(*) FILTER (WHERE status = 'error') as failed_executions,
    ROUND(AVG(execution_time_ms), 2) as avg_execution_time_ms,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(*) FILTER (WHERE context_used = true) as context_used_count,
    DATE_TRUNC('day', created_at) as execution_date
FROM public.mcp_executions
GROUP BY mcp_name, tool_name, DATE_TRUNC('day', created_at)
ORDER BY execution_date DESC, total_executions DESC;

-- ================== FUNCTIONS ==================
-- Function to get MCP performance metrics
CREATE OR REPLACE FUNCTION public.get_mcp_performance_metrics(
    days_back INTEGER DEFAULT 30,
    mcp_name_filter TEXT DEFAULT NULL,
    tool_name_filter TEXT DEFAULT NULL
)
RETURNS TABLE(
    mcp_name TEXT,
    tool_name TEXT,
    total_executions BIGINT,
    success_rate DECIMAL(5,2),
    avg_execution_time DECIMAL(10,2),
    unique_users BIGINT,
    feedback_count BIGINT,
    avg_rating DECIMAL(3,2),
    context_usage_rate DECIMAL(5,2)
)
LANGUAGE sql
AS $$
    SELECT 
        me.mcp_name::TEXT,
        me.tool_name::TEXT,
        COUNT(me.id) as total_executions,
        ROUND(
            COUNT(me.id) FILTER (WHERE me.status = 'success')::DECIMAL / 
            NULLIF(COUNT(me.id), 0) * 100, 2
        ) as success_rate,
        ROUND(AVG(me.execution_time_ms), 2) as avg_execution_time,
        COUNT(DISTINCT me.user_id) as unique_users,
        COUNT(mf.id) as feedback_count,
        ROUND(AVG(mf.rating_score), 2) as avg_rating,
        ROUND(
            COUNT(me.id) FILTER (WHERE me.context_used = true)::DECIMAL / 
            NULLIF(COUNT(me.id), 0) * 100, 2
        ) as context_usage_rate
    FROM public.mcp_executions me
    LEFT JOIN public.mcp_feedback mf ON me.id = mf.execution_id
    WHERE me.created_at >= NOW() - INTERVAL '1 day' * days_back
        AND (mcp_name_filter IS NULL OR me.mcp_name = mcp_name_filter)
        AND (tool_name_filter IS NULL OR me.tool_name = tool_name_filter)
    GROUP BY me.mcp_name, me.tool_name
    ORDER BY total_executions DESC;
$$;

-- ================== GRANTS ==================
-- Grant permissions to authenticated users
GRANT ALL ON public.mcp_executions TO authenticated;
GRANT ALL ON public.mcp_failures TO authenticated;
GRANT ALL ON public.mcp_feedback TO authenticated;
GRANT SELECT ON public.mcp_execution_summary TO authenticated;
GRANT SELECT ON public.mcp_usage_analytics TO authenticated;

-- ================== COMMENTS ==================
COMMENT ON TABLE public.mcp_executions IS 'Comprehensive tracking of all MCP tool executions with performance metrics and context usage';
COMMENT ON TABLE public.mcp_failures IS 'Detailed failure tracking for MCP executions to enable learning and improvement';
COMMENT ON TABLE public.mcp_feedback IS 'User feedback collection with dual rating system for continuous improvement';
COMMENT ON COLUMN public.mcp_executions.feedback_token IS 'Unique token for users to provide feedback on this execution';
COMMENT ON COLUMN public.mcp_executions.context_used IS 'Whether context learning was applied to this execution';
COMMENT ON COLUMN public.mcp_failures.sql_attempted IS 'For SQL generation failures, stores the attempted SQL for analysis';
COMMENT ON FUNCTION public.get_mcp_performance_metrics IS 'Comprehensive performance analytics for MCP tools with filtering options';