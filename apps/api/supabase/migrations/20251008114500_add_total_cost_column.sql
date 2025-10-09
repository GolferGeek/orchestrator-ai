-- Add total_cost column to llm_usage table if it doesn't exist
ALTER TABLE public.llm_usage ADD COLUMN IF NOT EXISTS total_cost NUMERIC(10, 6);

-- Update total_cost for existing records where it's null
UPDATE public.llm_usage
SET total_cost = COALESCE(input_cost, 0) + COALESCE(output_cost, 0)
WHERE total_cost IS NULL;

-- Add comment
COMMENT ON COLUMN public.llm_usage.total_cost IS 'Total cost for this LLM request (input_cost + output_cost)';
