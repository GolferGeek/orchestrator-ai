-- Add additional missing columns to llm_usage table discovered through debug logs
-- This completes the schema to match what RunMetadataService expects

-- Add missing columns from insert operations
ALTER TABLE public.llm_usage 
ADD COLUMN IF NOT EXISTS complexity_score DECIMAL(3,1),
ADD COLUMN IF NOT EXISTS complexity_level VARCHAR(50),
ADD COLUMN IF NOT EXISTS routing_reason VARCHAR(255),
ADD COLUMN IF NOT EXISTS model_tier VARCHAR(50),
ADD COLUMN IF NOT EXISTS fallback_used BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_local BOOLEAN DEFAULT false;

-- Add missing columns from update operations  
ALTER TABLE public.llm_usage 
ADD COLUMN IF NOT EXISTS proxy_used BOOLEAN DEFAULT false;

-- Add any other columns that might be missing based on the comprehensive debug data
ALTER TABLE public.llm_usage 
ADD COLUMN IF NOT EXISTS input_tokens INTEGER,
ADD COLUMN IF NOT EXISTS output_tokens INTEGER,
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS user_id UUID,
ADD COLUMN IF NOT EXISTS conversation_id UUID,
ADD COLUMN IF NOT EXISTS provider_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS model_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS run_id UUID;

-- Add comments for the new columns
COMMENT ON COLUMN public.llm_usage.complexity_score IS 'Complexity score of the request (1-10 scale)';
COMMENT ON COLUMN public.llm_usage.complexity_level IS 'Complexity level classification (low, medium, high)';
COMMENT ON COLUMN public.llm_usage.routing_reason IS 'Reason for model/provider routing decision';
COMMENT ON COLUMN public.llm_usage.model_tier IS 'Tier of the model used (ultra-fast, general, fast-thinking)';
COMMENT ON COLUMN public.llm_usage.fallback_used IS 'Whether fallback model was used due to primary failure';
COMMENT ON COLUMN public.llm_usage.is_local IS 'Whether the model is running locally (Ollama)';
COMMENT ON COLUMN public.llm_usage.proxy_used IS 'Whether a proxy was used for the request';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_llm_usage_run_id ON public.llm_usage(run_id);
CREATE INDEX IF NOT EXISTS idx_llm_usage_status ON public.llm_usage(status);
CREATE INDEX IF NOT EXISTS idx_llm_usage_started_at ON public.llm_usage(started_at);
CREATE INDEX IF NOT EXISTS idx_llm_usage_model_tier ON public.llm_usage(model_tier);

-- Verify all expected columns are present
DO $$
DECLARE
    missing_columns text[] := ARRAY[]::text[];
    col_name text;
    expected_columns text[] := ARRAY[
        'complexity_score', 'complexity_level', 'routing_reason', 'model_tier', 
        'fallback_used', 'is_local', 'proxy_used', 'input_tokens', 'output_tokens',
        'status', 'started_at', 'user_id', 'conversation_id', 'provider_name', 
        'model_name', 'run_id', 'caller_type', 'completed_at', 'input_cost', 
        'output_cost', 'duration_ms'
    ];
BEGIN
    -- Check for all expected columns
    FOREACH col_name IN ARRAY expected_columns LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'llm_usage' 
            AND table_schema = 'public' 
            AND column_name = col_name
        ) THEN
            missing_columns := array_append(missing_columns, col_name);
        END IF;
    END LOOP;
    
    IF array_length(missing_columns, 1) > 0 THEN
        RAISE WARNING 'Still missing columns in llm_usage: %', array_to_string(missing_columns, ', ');
    ELSE
        RAISE NOTICE '✅ All expected LLM usage tracking columns are now present (%s total)', array_length(expected_columns, 1);
    END IF;
END $$;
