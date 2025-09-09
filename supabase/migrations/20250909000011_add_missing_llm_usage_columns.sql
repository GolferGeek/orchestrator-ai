-- Add missing columns to llm_usage table that the RunMetadataService expects
-- This fixes the schema mismatch causing LLM usage tracking to fail

-- Add caller_type column (was missing)
ALTER TABLE public.llm_usage 
ADD COLUMN IF NOT EXISTS caller_type VARCHAR(100);

-- Add completed_at column (was missing) 
ALTER TABLE public.llm_usage 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Add other columns that might be missing based on the debug logs
ALTER TABLE public.llm_usage 
ADD COLUMN IF NOT EXISTS input_cost DECIMAL(10,6) DEFAULT 0,
ADD COLUMN IF NOT EXISTS output_cost DECIMAL(10,6) DEFAULT 0,
ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS data_sanitization_applied BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sanitization_level VARCHAR(50) DEFAULT 'none',
ADD COLUMN IF NOT EXISTS pii_detected BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS pii_types JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS pseudonyms_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS pseudonym_types JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS redactions_applied INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS redaction_types JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS source_blinding_applied BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS headers_stripped INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS custom_user_agent_used BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS no_train_header_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS no_retain_header_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sanitization_time_ms INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS reversal_context_size INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS policy_profile VARCHAR(50) DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS sovereign_mode BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS data_classification VARCHAR(50) DEFAULT 'public',
ADD COLUMN IF NOT EXISTS compliance_flags JSONB DEFAULT '{"gdprCompliant":false,"hipaaCompliant":false,"pciCompliant":false}'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN public.llm_usage.caller_type IS 'Type of caller that initiated the LLM request (e.g., agent, user, system)';
COMMENT ON COLUMN public.llm_usage.completed_at IS 'Timestamp when the LLM request was completed';
COMMENT ON COLUMN public.llm_usage.input_cost IS 'Cost for input tokens in USD';
COMMENT ON COLUMN public.llm_usage.output_cost IS 'Cost for output tokens in USD';
COMMENT ON COLUMN public.llm_usage.duration_ms IS 'Duration of the LLM request in milliseconds';

-- Verify the columns were added
DO $$
DECLARE
    missing_columns text[] := ARRAY[]::text[];
    col_name text;
BEGIN
    -- Check for required columns
    FOR col_name IN SELECT unnest(ARRAY['caller_type', 'completed_at', 'input_cost', 'output_cost', 'duration_ms']) LOOP
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
        RAISE NOTICE '✅ All required LLM usage tracking columns are now present';
    END IF;
END $$;
