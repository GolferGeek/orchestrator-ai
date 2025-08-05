-- Migration: Add LangGraph States Table for Enterprise Workflow Orchestration
-- Description: Creates the langgraph_states table to support 3-tier state architecture
-- Author: Claude (LangGraph State Management Service implementation)
-- Date: 2025-08-04

-- Create langgraph_states table for storing LangGraph workflow state
CREATE TABLE IF NOT EXISTS langgraph_states (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(255) UNIQUE NOT NULL,
    plan_state JSONB NOT NULL,
    step_results JSONB NOT NULL,
    metadata JSONB NOT NULL,
    state_version INTEGER NOT NULL DEFAULT 1,
    last_synchronized TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_langgraph_states_project_id ON langgraph_states(project_id);
CREATE INDEX IF NOT EXISTS idx_langgraph_states_state_version ON langgraph_states(project_id, state_version);
CREATE INDEX IF NOT EXISTS idx_langgraph_states_last_synchronized ON langgraph_states(last_synchronized);

-- Add comments for documentation
COMMENT ON TABLE langgraph_states IS 'Stores LangGraph 3-tier workflow state for enterprise orchestration';
COMMENT ON COLUMN langgraph_states.project_id IS 'Unique identifier for the project/workflow';
COMMENT ON COLUMN langgraph_states.plan_state IS 'Tier 1: High-level project strategy and coordination (JSON)';
COMMENT ON COLUMN langgraph_states.step_results IS 'Tier 2: Execution outcomes and deliverables (JSON)';
COMMENT ON COLUMN langgraph_states.metadata IS 'Tier 3: Operational details and real-time metrics (JSON)';
COMMENT ON COLUMN langgraph_states.state_version IS 'Version number for optimistic locking and rollback support';
COMMENT ON COLUMN langgraph_states.last_synchronized IS 'Last time state was synchronized with cache';

-- Create langgraph_state_history table for rollback support
CREATE TABLE IF NOT EXISTS langgraph_state_history (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL,
    state_version INTEGER NOT NULL,
    plan_state JSONB NOT NULL,
    step_results JSONB NOT NULL,
    metadata JSONB NOT NULL,
    rollback_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_langgraph_history_project FOREIGN KEY (project_id) REFERENCES langgraph_states(project_id) ON DELETE CASCADE
);

-- Add indexes for history table
CREATE INDEX IF NOT EXISTS idx_langgraph_history_project_version ON langgraph_state_history(project_id, state_version);
CREATE INDEX IF NOT EXISTS idx_langgraph_history_created_at ON langgraph_state_history(created_at);

-- Add comments for history table
COMMENT ON TABLE langgraph_state_history IS 'Historical versions of LangGraph states for rollback support';
COMMENT ON COLUMN langgraph_state_history.rollback_reason IS 'Reason for creating this historical snapshot';

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_langgraph_states_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to main table
DROP TRIGGER IF EXISTS trigger_update_langgraph_states_updated_at ON langgraph_states;
CREATE TRIGGER trigger_update_langgraph_states_updated_at
    BEFORE UPDATE ON langgraph_states
    FOR EACH ROW
    EXECUTE FUNCTION update_langgraph_states_updated_at();

-- Create function to save state history on version changes
CREATE OR REPLACE FUNCTION save_langgraph_state_history()
RETURNS TRIGGER AS $$
BEGIN
    -- Only save history if state_version has changed
    IF OLD.state_version != NEW.state_version THEN
        INSERT INTO langgraph_state_history (
            project_id,
            state_version,
            plan_state,
            step_results,
            metadata,
            rollback_reason
        ) VALUES (
            OLD.project_id,
            OLD.state_version,
            OLD.plan_state,
            OLD.step_results,
            OLD.metadata,
            'Automatic backup before version ' || NEW.state_version
        );
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply history trigger
DROP TRIGGER IF EXISTS trigger_save_langgraph_state_history ON langgraph_states;
CREATE TRIGGER trigger_save_langgraph_state_history
    BEFORE UPDATE ON langgraph_states
    FOR EACH ROW
    EXECUTE FUNCTION save_langgraph_state_history();

-- Add RLS policies if needed (following existing patterns)
-- Note: Adjust these based on your existing RLS strategy

-- Enable RLS
ALTER TABLE langgraph_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE langgraph_state_history ENABLE ROW LEVEL SECURITY;

-- Create policy for service role (full access)
CREATE POLICY "Service role has full access to langgraph_states"
ON langgraph_states
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role has full access to langgraph_state_history"
ON langgraph_state_history
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create policy for authenticated users (based on existing patterns)
-- Users can read their own states (assuming there's a user context in the JSON)
CREATE POLICY "Users can read langgraph_states"
ON langgraph_states
FOR SELECT
TO authenticated
USING (true); -- Adjust this based on your user context strategy

CREATE POLICY "Users can read langgraph_state_history"
ON langgraph_state_history
FOR SELECT
TO authenticated
USING (true); -- Adjust this based on your user context strategy

-- Grant necessary permissions
GRANT ALL ON langgraph_states TO service_role;
GRANT ALL ON langgraph_state_history TO service_role;
GRANT USAGE, SELECT ON SEQUENCE langgraph_states_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE langgraph_state_history_id_seq TO service_role;

GRANT SELECT ON langgraph_states TO authenticated;
GRANT SELECT ON langgraph_state_history TO authenticated;