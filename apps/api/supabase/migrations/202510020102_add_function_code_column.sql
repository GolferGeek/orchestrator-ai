-- Add function_code column to agents table
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS function_code TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN public.agents.function_code IS 'JavaScript/TypeScript function code for function-type agents';
