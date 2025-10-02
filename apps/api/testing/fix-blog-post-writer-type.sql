-- Fix blog_post_writer agent type in database
-- It should be a context agent, not a function agent

-- First, let's see what we have
SELECT id, slug, display_name, agent_type, organization_slug, status
FROM agents
WHERE slug = 'blog_post_writer';

-- Update the agent type from 'function' to 'context'
UPDATE agents
SET agent_type = 'context'
WHERE slug = 'blog_post_writer'
  AND agent_type = 'function';

-- Verify the change
SELECT id, slug, display_name, agent_type, organization_slug, status
FROM agents
WHERE slug = 'blog_post_writer';

