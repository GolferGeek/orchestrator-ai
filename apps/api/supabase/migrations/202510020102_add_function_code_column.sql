-- Add function_code column to agents table
ALTER TABLE agents ADD COLUMN function_code TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN agents.function_code IS 'JavaScript/TypeScript function code for function-type agents';
