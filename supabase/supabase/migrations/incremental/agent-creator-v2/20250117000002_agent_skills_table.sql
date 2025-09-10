-- Agent Creator v2: Agent skills and examples table
-- Stores detailed skills with user-provided examples for each agent

-- Store agent skills with examples
CREATE TABLE IF NOT EXISTS agent_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Foreign key to agent
    agent_configuration_id UUID NOT NULL REFERENCES agent_configurations(id) ON DELETE CASCADE,
    
    -- Skill identification
    skill_id VARCHAR(100) NOT NULL,        -- snake_case skill identifier
    skill_name VARCHAR(200) NOT NULL,      -- display name for skill
    description TEXT NOT NULL,             -- what this skill does
    
    -- User-provided examples (critical for quality)
    examples JSONB NOT NULL,               -- array of example queries from user's domain
    tags JSONB DEFAULT '[]',               -- array of tags for categorization
    
    -- Skill configuration
    input_modes JSONB DEFAULT '["text/plain", "application/json"]',
    output_modes JSONB DEFAULT '["text/plain", "application/json"]',
    
    -- Metadata
    skill_order INTEGER DEFAULT 0,         -- display order for skills
    is_primary BOOLEAN DEFAULT false,      -- is this the main skill?
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_agent_skills_agent_config ON agent_skills(agent_configuration_id);
CREATE INDEX idx_agent_skills_skill_id ON agent_skills(skill_id);
CREATE INDEX idx_agent_skills_is_primary ON agent_skills(is_primary);
CREATE INDEX idx_agent_skills_skill_order ON agent_skills(skill_order);

-- Constraints
-- Ensure skill_id is snake_case format
ALTER TABLE agent_skills ADD CONSTRAINT check_skill_id_format
    CHECK (skill_id ~ '^[a-z][a-z0-9_]*$');

-- Ensure skill name is not empty
ALTER TABLE agent_skills ADD CONSTRAINT check_skill_name_not_empty
    CHECK (LENGTH(TRIM(skill_name)) > 0);

-- Ensure description is meaningful
ALTER TABLE agent_skills ADD CONSTRAINT check_skill_description_length
    CHECK (LENGTH(TRIM(description)) >= 10);

-- Ensure at least one example is provided
ALTER TABLE agent_skills ADD CONSTRAINT check_examples_not_empty
    CHECK (jsonb_array_length(examples) > 0);

-- Ensure examples are strings
ALTER TABLE agent_skills ADD CONSTRAINT check_examples_are_strings
    CHECK (
        (SELECT bool_and(jsonb_typeof(value) = 'string') 
         FROM jsonb_array_elements(examples) AS value)
    );

-- Unique constraint: skill_id must be unique per agent
ALTER TABLE agent_skills ADD CONSTRAINT unique_skill_id_per_agent
    UNIQUE (agent_configuration_id, skill_id);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_agent_skills_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_agent_skills_updated_at
    BEFORE UPDATE ON agent_skills
    FOR EACH ROW EXECUTE FUNCTION update_agent_skills_updated_at();

-- Row Level Security (RLS)
ALTER TABLE agent_skills ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read skills for active agents
CREATE POLICY "Users can view skills for active agents" ON agent_skills
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM agent_configurations ac
            WHERE ac.id = agent_skills.agent_configuration_id
            AND ac.status = 'active'
        )
    );

-- Policy: Users can only modify skills for agents they own
CREATE POLICY "Users can modify skills for own agents" ON agent_skills
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM agent_configurations ac
            WHERE ac.id = agent_skills.agent_configuration_id
            AND ac.created_by = auth.uid()
        )
    );

-- Function to validate skill examples quality
CREATE OR REPLACE FUNCTION validate_skill_examples(examples JSONB)
RETURNS BOOLEAN AS $$
DECLARE
    example_text TEXT;
    example_value JSONB;
BEGIN
    -- Check each example in the array
    FOR example_value IN SELECT jsonb_array_elements(examples)
    LOOP
        example_text := example_value #>> '{}';
        
        -- Ensure example is not empty or too short
        IF LENGTH(TRIM(example_text)) < 5 THEN
            RETURN FALSE;
        END IF;
        
        -- Ensure example is a reasonable length (not too long)
        IF LENGTH(example_text) > 500 THEN
            RETURN FALSE;
        END IF;
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add validation constraint for example quality
ALTER TABLE agent_skills ADD CONSTRAINT check_examples_quality
    CHECK (validate_skill_examples(examples));

-- Comments
COMMENT ON TABLE agent_skills IS 'Stores skills and user-provided examples for each agent';
COMMENT ON COLUMN agent_skills.examples IS 'Array of concrete example queries from user domain';
COMMENT ON COLUMN agent_skills.skill_id IS 'Snake_case identifier unique per agent';
COMMENT ON COLUMN agent_skills.is_primary IS 'Whether this is the main/primary skill for the agent';