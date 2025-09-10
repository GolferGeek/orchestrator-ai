-- Agent Creator v2: Conversation state tracking
-- Enables resuming interrupted agent creation conversations

-- Store agent creation conversation history and progress
CREATE TABLE IF NOT EXISTS agent_creation_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Session identification
    session_id VARCHAR(100) NOT NULL,      -- conversation session identifier
    user_id UUID REFERENCES auth.users(id), -- user creating the agent
    
    -- Linked agent (null until agent is created)
    agent_configuration_id UUID REFERENCES agent_configurations(id) ON DELETE SET NULL,
    
    -- Conversation state
    conversation_data JSONB NOT NULL,      -- full conversation history
    requirements_gathered JSONB DEFAULT '{}', -- tracked requirements by phase
    current_phase VARCHAR(50) DEFAULT 'identity', -- current phase in 12-question flow
    current_question INTEGER DEFAULT 1,    -- current question number (1-12)
    
    -- Progress tracking
    completion_status VARCHAR(50) DEFAULT 'in_progress', -- 'in_progress', 'completed', 'abandoned'
    completion_percentage INTEGER DEFAULT 0, -- 0-100% completion
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Metadata
    user_agent TEXT,                       -- browser/client info
    ip_address INET,                       -- for analytics/security
    metadata JSONB DEFAULT '{}'            -- additional tracking data
);

-- Store individual requirement collection events
CREATE TABLE IF NOT EXISTS agent_creation_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Link to conversation
    conversation_id UUID NOT NULL REFERENCES agent_creation_conversations(id) ON DELETE CASCADE,
    
    -- Event details
    event_type VARCHAR(50) NOT NULL,       -- 'question_asked', 'answer_provided', 'validation_failed', etc.
    event_data JSONB NOT NULL,             -- event-specific data
    question_number INTEGER,               -- which question this relates to
    field_name VARCHAR(100),               -- which requirement field
    
    -- Timing
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Context
    user_input TEXT,                       -- what user typed
    ai_response TEXT,                      -- what AI responded
    validation_result JSONB               -- validation results if applicable
);

-- Indexes for performance
CREATE INDEX idx_conversations_session_id ON agent_creation_conversations(session_id);
CREATE INDEX idx_conversations_user_id ON agent_creation_conversations(user_id);
CREATE INDEX idx_conversations_status ON agent_creation_conversations(completion_status);
CREATE INDEX idx_conversations_last_activity ON agent_creation_conversations(last_activity_at);
CREATE INDEX idx_conversations_agent_id ON agent_creation_conversations(agent_configuration_id);

CREATE INDEX idx_events_conversation_id ON agent_creation_events(conversation_id);
CREATE INDEX idx_events_timestamp ON agent_creation_events(timestamp);
CREATE INDEX idx_events_event_type ON agent_creation_events(event_type);
CREATE INDEX idx_events_question_number ON agent_creation_events(question_number);

-- Constraints
ALTER TABLE agent_creation_conversations ADD CONSTRAINT check_completion_status
    CHECK (completion_status IN ('in_progress', 'completed', 'abandoned', 'failed'));

ALTER TABLE agent_creation_conversations ADD CONSTRAINT check_current_phase
    CHECK (current_phase IN ('identity', 'hierarchy', 'purpose', 'skills', 'style', 'technical', 'complete'));

ALTER TABLE agent_creation_conversations ADD CONSTRAINT check_current_question_range
    CHECK (current_question >= 1 AND current_question <= 12);

ALTER TABLE agent_creation_conversations ADD CONSTRAINT check_completion_percentage
    CHECK (completion_percentage >= 0 AND completion_percentage <= 100);

ALTER TABLE agent_creation_events ADD CONSTRAINT check_event_type
    CHECK (event_type IN (
        'conversation_started', 'question_asked', 'answer_provided', 
        'validation_passed', 'validation_failed', 'phase_completed',
        'agent_created', 'conversation_completed', 'conversation_abandoned'
    ));

-- Updated timestamp triggers
CREATE OR REPLACE FUNCTION update_conversation_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.last_activity_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_conversations_updated_at
    BEFORE UPDATE ON agent_creation_conversations
    FOR EACH ROW EXECUTE FUNCTION update_conversation_timestamps();

-- Function to calculate completion percentage
CREATE OR REPLACE FUNCTION calculate_completion_percentage(requirements JSONB)
RETURNS INTEGER AS $$
DECLARE
    total_fields INTEGER := 12;  -- Total required fields
    completed_fields INTEGER := 0;
    field_name TEXT;
BEGIN
    -- Count non-null, non-empty required fields
    FOR field_name IN SELECT * FROM jsonb_object_keys(requirements)
    LOOP
        IF requirements ->> field_name IS NOT NULL 
           AND LENGTH(TRIM(requirements ->> field_name)) > 0 THEN
            completed_fields := completed_fields + 1;
        END IF;
    END LOOP;
    
    RETURN (completed_fields * 100 / total_fields);
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update completion percentage
CREATE OR REPLACE FUNCTION update_completion_percentage()
RETURNS TRIGGER AS $$
BEGIN
    NEW.completion_percentage = calculate_completion_percentage(NEW.requirements_gathered);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_completion_percentage
    BEFORE UPDATE ON agent_creation_conversations
    FOR EACH ROW 
    WHEN (OLD.requirements_gathered IS DISTINCT FROM NEW.requirements_gathered)
    EXECUTE FUNCTION update_completion_percentage();

-- Function to clean up old abandoned conversations (for maintenance)
CREATE OR REPLACE FUNCTION cleanup_abandoned_conversations()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete conversations abandoned for more than 7 days
    DELETE FROM agent_creation_conversations
    WHERE completion_status = 'in_progress'
      AND last_activity_at < NOW() - INTERVAL '7 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS)
ALTER TABLE agent_creation_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_creation_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own conversations
CREATE POLICY "Users can view own conversations" ON agent_creation_conversations
    FOR ALL USING (auth.uid() = user_id);

-- Policy: Users can only see events for their own conversations  
CREATE POLICY "Users can view own conversation events" ON agent_creation_events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM agent_creation_conversations c
            WHERE c.id = agent_creation_events.conversation_id
            AND c.user_id = auth.uid()
        )
    );

-- Comments
COMMENT ON TABLE agent_creation_conversations IS 'Tracks agent creation conversation state for resuming interrupted sessions';
COMMENT ON TABLE agent_creation_events IS 'Detailed log of events during agent creation conversations';
COMMENT ON COLUMN agent_creation_conversations.requirements_gathered IS 'JSON object tracking completion of 12 required fields';
COMMENT ON COLUMN agent_creation_conversations.current_phase IS 'Current phase in structured conversation flow';
COMMENT ON COLUMN agent_creation_events.event_data IS 'Event-specific data like validation results, user inputs, etc.';