-- Add missing caller_name column to llm_usage table
-- This column is expected by the RunMetadataService but was missing from the schema

ALTER TABLE public.llm_usage 
ADD COLUMN IF NOT EXISTS caller_name VARCHAR(255);

-- Add a comment to document this column
COMMENT ON COLUMN public.llm_usage.caller_name IS 'Name of the caller that initiated the LLM request (e.g., blog-post-agent, user-chat, api-endpoint)';
