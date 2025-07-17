-- Migration: Update agent types to organizational structure
-- Date: 2025-07-17
-- Description: Replace hard-coded agent types with business-aligned organizational categories

-- First, update the CHECK constraint to include all new organizational categories
ALTER TABLE public.agent_conversations 
DROP CONSTRAINT agent_conversations_agent_type_check;

ALTER TABLE public.agent_conversations 
ADD CONSTRAINT agent_conversations_agent_type_check 
CHECK (agent_type IN (
  'orchestrator', 
  'specialist', 
  'marketing', 
  'finance', 
  'hr', 
  'operations', 
  'sales', 
  'legal', 
  'engineering', 
  'product', 
  'research'
));

-- Update existing data to map old types to new organizational structure
-- Keep orchestrator and specialist as-is
-- Map external agents to their appropriate organizational category
-- Map api agents to engineering (since they're typically technical integrations)

UPDATE public.agent_conversations 
SET agent_type = CASE 
  WHEN agent_type = 'orchestrator' THEN 'orchestrator'
  WHEN agent_type = 'specialist' THEN 'specialist'
  WHEN agent_type = 'external' THEN 'marketing'  -- Default external agents to marketing for now
  WHEN agent_type = 'api' THEN 'engineering'     -- API agents belong to engineering
  ELSE 'specialist' -- Fallback
END;

-- Add comment explaining the new organizational structure
COMMENT ON COLUMN public.agent_conversations.agent_type IS 'Agent organizational category: orchestrator (manages delegation), specialist (cross-organizational), or specific business units: marketing, finance, hr, operations, sales, legal, engineering, product, research';

-- Create index for better performance on organizational queries
CREATE INDEX IF NOT EXISTS idx_agent_conversations_org_type ON public.agent_conversations(agent_type);

-- Update the stats view to work with new organizational structure
DROP VIEW IF EXISTS public.agent_conversations_with_stats;

CREATE OR REPLACE VIEW public.agent_conversations_with_stats AS
SELECT 
    ac.*,
    COUNT(t.id) AS task_count,
    COUNT(t.id) FILTER (WHERE t.status = 'completed') AS completed_tasks,
    COUNT(t.id) FILTER (WHERE t.status = 'failed') AS failed_tasks,
    COUNT(t.id) FILTER (WHERE t.status IN ('pending', 'running')) AS active_tasks,
    -- Add organizational grouping
    CASE 
      WHEN ac.agent_type = 'orchestrator' THEN 'management'
      WHEN ac.agent_type = 'specialist' THEN 'cross_functional'
      ELSE ac.agent_type
    END AS organizational_group
FROM public.agent_conversations ac
LEFT JOIN public.tasks t ON t.agent_conversation_id = ac.id
GROUP BY ac.id;

-- Create a view for organizational agent statistics
CREATE OR REPLACE VIEW public.organizational_agent_stats AS
SELECT 
    agent_type,
    COUNT(*) AS total_conversations,
    COUNT(*) FILTER (WHERE ended_at IS NULL) AS active_conversations,
    AVG(EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at))) / 3600 AS avg_duration_hours,
    MAX(last_active_at) AS last_activity
FROM public.agent_conversations
GROUP BY agent_type
ORDER BY total_conversations DESC;

-- Grant permissions on new views
GRANT SELECT ON public.organizational_agent_stats TO authenticated;

-- Add helpful comments
COMMENT ON VIEW public.organizational_agent_stats IS 'Provides statistics on agent usage by organizational category';