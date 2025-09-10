-- Agent Creator v2: Audit trails and analytics
-- Track agent usage, creation patterns, and system health

-- Store agent creation audit trail
CREATE TABLE IF NOT EXISTS agent_creation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- What happened
    action VARCHAR(100) NOT NULL,          -- 'created', 'updated', 'activated', 'deactivated', 'deleted'
    agent_configuration_id UUID REFERENCES agent_configurations(id) ON DELETE CASCADE,
    
    -- Who did it
    performed_by UUID REFERENCES auth.users(id),
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Context
    details JSONB DEFAULT '{}',            -- action-specific details
    ip_address INET,                       -- for security audit
    user_agent TEXT,                       -- client information
    
    -- Before/after state for changes
    previous_state JSONB,                  -- state before action
    new_state JSONB,                       -- state after action
    
    -- Result
    success BOOLEAN DEFAULT true,          -- whether action succeeded
    error_message TEXT                     -- error details if failed
);

-- Store agent usage analytics
CREATE TABLE IF NOT EXISTS agent_usage_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Which agent
    agent_configuration_id UUID NOT NULL REFERENCES agent_configurations(id) ON DELETE CASCADE,
    agent_id VARCHAR(100) NOT NULL,       -- denormalized for performance
    
    -- Usage metrics
    conversation_count INTEGER DEFAULT 0,  -- total conversations
    message_count INTEGER DEFAULT 0,       -- total messages processed
    avg_response_time_ms INTEGER,          -- average response time
    error_count INTEGER DEFAULT 0,         -- number of errors
    
    -- User engagement
    unique_users INTEGER DEFAULT 0,        -- distinct users who interacted
    returning_users INTEGER DEFAULT 0,     -- users with multiple sessions
    satisfaction_rating DECIMAL(3,2),     -- average user rating if available
    
    -- Time period
    date_period DATE NOT NULL,             -- daily aggregation
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Metadata
    metadata JSONB DEFAULT '{}'
);

-- Store system health metrics for agent creation
CREATE TABLE IF NOT EXISTS agent_creation_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Time period
    date_period DATE NOT NULL,
    hour_period INTEGER,                   -- 0-23 for hourly breakdown
    
    -- Creation metrics
    total_attempts INTEGER DEFAULT 0,      -- total creation attempts
    successful_creations INTEGER DEFAULT 0, -- successful completions
    failed_creations INTEGER DEFAULT 0,    -- failed attempts
    abandoned_conversations INTEGER DEFAULT 0, -- user abandoned mid-flow
    
    -- Performance metrics
    avg_creation_time_seconds INTEGER,     -- average time to complete
    avg_questions_to_completion DECIMAL(4,2), -- average questions answered
    most_failed_question INTEGER,          -- question that fails validation most
    
    -- Quality metrics  
    agents_with_quality_issues INTEGER DEFAULT 0, -- agents with validation warnings
    avg_capabilities_count DECIMAL(4,2),   -- average number of capabilities
    avg_skills_count DECIMAL(4,2),         -- average number of skills
    
    -- Department breakdown
    department_breakdown JSONB DEFAULT '{}', -- {"marketing": 5, "engineering": 3}
    
    -- Updated timestamp
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_creation_logs_agent_id ON agent_creation_logs(agent_configuration_id);
CREATE INDEX idx_creation_logs_performed_at ON agent_creation_logs(performed_at);
CREATE INDEX idx_creation_logs_action ON agent_creation_logs(action);
CREATE INDEX idx_creation_logs_performed_by ON agent_creation_logs(performed_by);
CREATE INDEX idx_creation_logs_success ON agent_creation_logs(success);

CREATE INDEX idx_usage_analytics_agent_id ON agent_usage_analytics(agent_configuration_id);
CREATE INDEX idx_usage_analytics_date ON agent_usage_analytics(date_period);
CREATE INDEX idx_usage_analytics_agent_lookup ON agent_usage_analytics(agent_id);

CREATE INDEX idx_creation_metrics_date ON agent_creation_metrics(date_period);
CREATE INDEX idx_creation_metrics_hour ON agent_creation_metrics(hour_period);

-- Unique constraints
ALTER TABLE agent_usage_analytics ADD CONSTRAINT unique_agent_date_analytics
    UNIQUE (agent_configuration_id, date_period);

ALTER TABLE agent_creation_metrics ADD CONSTRAINT unique_date_hour_metrics
    UNIQUE (date_period, hour_period);

-- Constraints
ALTER TABLE agent_creation_logs ADD CONSTRAINT check_action_type
    CHECK (action IN (
        'created', 'updated', 'activated', 'deactivated', 'deleted', 
        'accessed', 'conversation_started', 'error_occurred'
    ));

ALTER TABLE agent_creation_metrics ADD CONSTRAINT check_hour_period
    CHECK (hour_period >= 0 AND hour_period <= 23);

ALTER TABLE agent_usage_analytics ADD CONSTRAINT check_satisfaction_rating
    CHECK (satisfaction_rating >= 0.0 AND satisfaction_rating <= 5.0);

-- Function to log agent creation events
CREATE OR REPLACE FUNCTION log_agent_action(
    p_action VARCHAR(100),
    p_agent_id UUID,
    p_details JSONB DEFAULT '{}',
    p_previous_state JSONB DEFAULT NULL,
    p_new_state JSONB DEFAULT NULL,
    p_success BOOLEAN DEFAULT true,
    p_error_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO agent_creation_logs (
        action, agent_configuration_id, performed_by, details,
        previous_state, new_state, success, error_message
    ) VALUES (
        p_action, p_agent_id, auth.uid(), p_details,
        p_previous_state, p_new_state, p_success, p_error_message
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update usage analytics
CREATE OR REPLACE FUNCTION update_agent_usage_analytics(
    p_agent_id UUID,
    p_conversation_increment INTEGER DEFAULT 0,
    p_message_increment INTEGER DEFAULT 0,
    p_response_time_ms INTEGER DEFAULT NULL,
    p_error_increment INTEGER DEFAULT 0,
    p_unique_user_increment INTEGER DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO agent_usage_analytics (
        agent_configuration_id, agent_id, date_period,
        conversation_count, message_count, error_count, unique_users
    ) VALUES (
        p_agent_id, 
        (SELECT agent_id FROM agent_configurations WHERE id = p_agent_id),
        CURRENT_DATE,
        p_conversation_increment, p_message_increment, p_error_increment, p_unique_user_increment
    )
    ON CONFLICT (agent_configuration_id, date_period) 
    DO UPDATE SET
        conversation_count = agent_usage_analytics.conversation_count + p_conversation_increment,
        message_count = agent_usage_analytics.message_count + p_message_increment,
        error_count = agent_usage_analytics.error_count + p_error_increment,
        unique_users = agent_usage_analytics.unique_users + p_unique_user_increment,
        avg_response_time_ms = CASE 
            WHEN p_response_time_ms IS NOT NULL THEN
                COALESCE(
                    (agent_usage_analytics.avg_response_time_ms + p_response_time_ms) / 2,
                    p_response_time_ms
                )
            ELSE agent_usage_analytics.avg_response_time_ms
        END,
        last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to update creation metrics
CREATE OR REPLACE FUNCTION update_creation_metrics(
    p_success BOOLEAN,
    p_creation_time_seconds INTEGER DEFAULT NULL,
    p_questions_answered INTEGER DEFAULT NULL,
    p_department VARCHAR(100) DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    current_hour INTEGER;
    dept_breakdown JSONB;
BEGIN
    current_hour := EXTRACT(hour FROM NOW());
    
    -- Get current department breakdown or initialize
    SELECT department_breakdown INTO dept_breakdown
    FROM agent_creation_metrics
    WHERE date_period = CURRENT_DATE AND hour_period = current_hour;
    
    IF dept_breakdown IS NULL THEN
        dept_breakdown := '{}';
    END IF;
    
    -- Update department count
    IF p_department IS NOT NULL THEN
        dept_breakdown := jsonb_set(
            dept_breakdown,
            ARRAY[p_department],
            to_jsonb(COALESCE((dept_breakdown ->> p_department)::INTEGER, 0) + 1)
        );
    END IF;
    
    INSERT INTO agent_creation_metrics (
        date_period, hour_period, total_attempts,
        successful_creations, failed_creations,
        avg_creation_time_seconds, avg_questions_to_completion,
        department_breakdown
    ) VALUES (
        CURRENT_DATE, current_hour, 1,
        CASE WHEN p_success THEN 1 ELSE 0 END,
        CASE WHEN p_success THEN 0 ELSE 1 END,
        p_creation_time_seconds, p_questions_answered,
        dept_breakdown
    )
    ON CONFLICT (date_period, hour_period)
    DO UPDATE SET
        total_attempts = agent_creation_metrics.total_attempts + 1,
        successful_creations = agent_creation_metrics.successful_creations + 
            CASE WHEN p_success THEN 1 ELSE 0 END,
        failed_creations = agent_creation_metrics.failed_creations + 
            CASE WHEN p_success THEN 0 ELSE 1 END,
        avg_creation_time_seconds = CASE 
            WHEN p_creation_time_seconds IS NOT NULL THEN
                COALESCE(
                    (agent_creation_metrics.avg_creation_time_seconds + p_creation_time_seconds) / 2,
                    p_creation_time_seconds
                )
            ELSE agent_creation_metrics.avg_creation_time_seconds
        END,
        avg_questions_to_completion = CASE 
            WHEN p_questions_answered IS NOT NULL THEN
                COALESCE(
                    (agent_creation_metrics.avg_questions_to_completion + p_questions_answered) / 2.0,
                    p_questions_answered::DECIMAL
                )
            ELSE agent_creation_metrics.avg_questions_to_completion
        END,
        department_breakdown = dept_breakdown,
        last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS)
ALTER TABLE agent_creation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_usage_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_creation_metrics ENABLE ROW LEVEL SECURITY;

-- Policies for audit logs - users can see logs for their own agents
CREATE POLICY "Users can view logs for own agents" ON agent_creation_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM agent_configurations ac
            WHERE ac.id = agent_creation_logs.agent_configuration_id
            AND ac.created_by = auth.uid()
        )
        OR performed_by = auth.uid()
    );

-- Policies for usage analytics - users can see analytics for their own agents
CREATE POLICY "Users can view analytics for own agents" ON agent_usage_analytics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM agent_configurations ac
            WHERE ac.id = agent_usage_analytics.agent_configuration_id
            AND ac.created_by = auth.uid()
        )
    );

-- Creation metrics are read-only for all authenticated users (aggregate data)
CREATE POLICY "Authenticated users can view creation metrics" ON agent_creation_metrics
    FOR SELECT USING (auth.role() = 'authenticated');

-- Comments
COMMENT ON TABLE agent_creation_logs IS 'Audit trail for all agent-related actions';
COMMENT ON TABLE agent_usage_analytics IS 'Daily usage analytics for each agent';
COMMENT ON TABLE agent_creation_metrics IS 'System-wide metrics for agent creation process';
COMMENT ON FUNCTION log_agent_action IS 'Helper function to create audit log entries';
COMMENT ON FUNCTION update_agent_usage_analytics IS 'Helper function to update daily usage stats';
COMMENT ON FUNCTION update_creation_metrics IS 'Helper function to update system creation metrics';
