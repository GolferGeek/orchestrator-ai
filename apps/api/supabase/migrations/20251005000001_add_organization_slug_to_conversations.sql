-- Add organization_slug column to conversations table
-- This properly identifies which organization the conversation belongs to
-- for database agents (replaces the overloaded agent_type field)

ALTER TABLE conversations
ADD COLUMN organization_slug TEXT;

-- Create index for efficient lookups by organization
CREATE INDEX idx_conversations_organization_slug ON conversations(organization_slug);

-- Create index for lookups by organization + agent
CREATE INDEX idx_conversations_org_agent ON conversations(organization_slug, agent_name);

-- Migrate existing conversations with agent_type that looks like an org slug
-- (not 'context', 'specialist', 'demo', etc.)
UPDATE conversations
SET organization_slug = agent_type
WHERE agent_type NOT IN ('context', 'specialist', 'demo', 'orchestrator')
  AND agent_type IS NOT NULL
  AND agent_type != '';

-- Add comment explaining the column
COMMENT ON COLUMN conversations.organization_slug IS 'Organization slug for database agents (e.g., my-org, acme-corp). NULL for file-based agents.';
