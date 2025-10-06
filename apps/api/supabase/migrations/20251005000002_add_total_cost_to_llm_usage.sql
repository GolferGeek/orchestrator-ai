-- Add total_cost column to llm_usage table
-- This stores the sum of input_cost + output_cost for easier querying

ALTER TABLE public.llm_usage
ADD COLUMN IF NOT EXISTS total_cost numeric;

-- Add comment explaining the column
COMMENT ON COLUMN public.llm_usage.total_cost IS 'Total cost (input_cost + output_cost) for this LLM request';

-- Create index for cost analysis queries
CREATE INDEX IF NOT EXISTS llm_usage_total_cost_idx ON public.llm_usage(total_cost) WHERE total_cost IS NOT NULL;
