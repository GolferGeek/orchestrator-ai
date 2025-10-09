-- Add organization_slug column to conversations table
-- This properly identifies which organization the conversation belongs to
-- for database agents (replaces the overloaded agent_type field)

ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS organization_slug TEXT;

-- Create index for efficient lookups by organization
CREATE INDEX IF NOT EXISTS idx_conversations_organization_slug ON public.conversations(organization_slug);

-- Create index for lookups by organization + agent
CREATE INDEX IF NOT EXISTS idx_conversations_org_agent ON public.conversations(organization_slug, agent_name);

-- Migrate existing conversations with agent_type that looks like an org slug
-- (not 'context', 'specialist', 'demo', etc.)
UPDATE public.conversations
SET organization_slug = agent_type
WHERE organization_slug IS NULL
  AND agent_type NOT IN ('context', 'specialist', 'demo', 'orchestrator')
  AND agent_type IS NOT NULL
  AND agent_type != '';

-- Add comment explaining the column
COMMENT ON COLUMN public.conversations.organization_slug IS 'Organization slug for database agents (e.g., my-org, acme-corp). NULL for file-based agents.';
