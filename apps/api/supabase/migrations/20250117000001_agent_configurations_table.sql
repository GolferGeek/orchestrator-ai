-- Agent Creator v2: Core agent configurations table
-- This stores all dynamically created agents with their generated content

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Store agent configurations
CREATE TABLE IF NOT EXISTS agent_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Core identification
    agent_id VARCHAR(100) UNIQUE NOT NULL, -- snake_case identifier (e.g., 'social_media_writer')
    display_name VARCHAR(200) NOT NULL,    -- human-readable name (e.g., 'Social Media Writer')
    
    -- Agent classification  
    agent_type VARCHAR(50) NOT NULL,       -- 'context', 'api', or 'function'
    department VARCHAR(100) NOT NULL,      -- 'marketing', 'engineering', etc.
    reports_to VARCHAR(100),               -- manager orchestrator name
    
    -- User tracking
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Version control
    version INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'active',   -- 'active', 'inactive', 'archived', 'draft'
    
    -- Business specifications (from user input)
    primary_purpose TEXT NOT NULL,        -- main problem this agent solves
    capabilities JSONB NOT NULL,          -- array of capabilities
    expertise_areas JSONB NOT NULL,       -- array of expertise domains  
    responsibilities JSONB NOT NULL,      -- array of responsibilities
    limitations JSONB NOT NULL,           -- array of limitations
    communication_style VARCHAR(100),     -- 'professional', 'casual', etc.
    core_identity TEXT,                   -- how agent presents itself
    
    -- Generated content (templates applied to user specs)
    yaml_config TEXT NOT NULL,           -- generated YAML configuration
    context_content TEXT NOT NULL,       -- generated context.md content
    service_content TEXT NOT NULL,       -- generated service.ts content
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}',         -- flexible additional configuration
    
    -- Audit fields
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    access_count INTEGER DEFAULT 0
);

-- Indexes for performance
CREATE INDEX idx_agent_configurations_agent_id ON agent_configurations(agent_id);
CREATE INDEX idx_agent_configurations_department ON agent_configurations(department);
CREATE INDEX idx_agent_configurations_status ON agent_configurations(status);
CREATE INDEX idx_agent_configurations_created_by ON agent_configurations(created_by);
CREATE INDEX idx_agent_configurations_created_at ON agent_configurations(created_at);

-- Data constraints
ALTER TABLE agent_configurations ADD CONSTRAINT check_agent_type 
    CHECK (agent_type IN ('context', 'api', 'function'));
    
ALTER TABLE agent_configurations ADD CONSTRAINT check_status 
    CHECK (status IN ('active', 'inactive', 'archived', 'draft'));
    
ALTER TABLE agent_configurations ADD CONSTRAINT check_department 
    CHECK (department IN ('marketing', 'engineering', 'operations', 'finance', 'hr', 'sales', 'research', 'product', 'specialists'));

ALTER TABLE agent_configurations ADD CONSTRAINT check_communication_style
    CHECK (communication_style IN ('professional', 'casual', 'technical', 'conversational', 'formal', 'creative'));

-- Agent ID format validation (must be snake_case)
ALTER TABLE agent_configurations ADD CONSTRAINT check_agent_id_format
    CHECK (agent_id ~ '^[a-z][a-z0-9_]*$');

-- Ensure display name is not empty
ALTER TABLE agent_configurations ADD CONSTRAINT check_display_name_not_empty
    CHECK (LENGTH(TRIM(display_name)) > 0);

-- Ensure primary purpose is meaningful
ALTER TABLE agent_configurations ADD CONSTRAINT check_primary_purpose_length
    CHECK (LENGTH(TRIM(primary_purpose)) >= 20);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_agent_configurations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_agent_configurations_updated_at
    BEFORE UPDATE ON agent_configurations
    FOR EACH ROW EXECUTE FUNCTION update_agent_configurations_updated_at();

-- Row Level Security (RLS)
ALTER TABLE agent_configurations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read all active agents (for discovery)
CREATE POLICY "Users can view active agents" ON agent_configurations
    FOR SELECT USING (status = 'active');

-- Policy: Users can only modify agents they created
CREATE POLICY "Users can modify own agents" ON agent_configurations
    FOR ALL USING (auth.uid() = created_by);

-- Policy: Users can create agents
CREATE POLICY "Users can create agents" ON agent_configurations
    FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Comment on table
COMMENT ON TABLE agent_configurations IS 'Stores dynamically created agent configurations with generated content';
COMMENT ON COLUMN agent_configurations.agent_id IS 'Unique snake_case identifier for routing (e.g., social_media_writer)';
COMMENT ON COLUMN agent_configurations.yaml_config IS 'Generated YAML configuration content';
COMMENT ON COLUMN agent_configurations.context_content IS 'Generated context.md system prompt content';
COMMENT ON COLUMN agent_configurations.service_content IS 'Generated service.ts TypeScript content';
