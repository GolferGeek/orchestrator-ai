-- Add agent_name column to llm_usage table for consistency with rest of codebase
-- This replaces caller_name to maintain consistency across the application

ALTER TABLE public.llm_usage 
ADD COLUMN IF NOT EXISTS agent_name VARCHAR(255);

-- Add a comment to document this column
COMMENT ON COLUMN public.llm_usage.agent_name IS 'Name of the agent that initiated the LLM request (e.g., blog-post-agent, metrics-agent)';
