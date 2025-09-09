-- Add severity and data_type columns to redaction_patterns table
-- This migration must run before seeding to ensure columns exist

-- Add missing columns to redaction_patterns table if they don't exist
ALTER TABLE public.redaction_patterns 
ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'flagger',
ADD COLUMN IF NOT EXISTS data_type public.pii_data_type;

-- Create indexes for severity-based queries
CREATE INDEX IF NOT EXISTS idx_redaction_patterns_severity ON public.redaction_patterns (severity, is_active);
CREATE INDEX IF NOT EXISTS idx_redaction_patterns_data_type ON public.redaction_patterns (data_type, is_active);

-- Log the column addition
DO $$
BEGIN
    RAISE NOTICE '✅ Added severity and data_type columns to redaction_patterns table';
    RAISE NOTICE '   - severity: VARCHAR(20) with default ''flagger''';
    RAISE NOTICE '   - data_type: public.pii_data_type enum';
    RAISE NOTICE '   - Created indexes for efficient severity-based queries';
END $$;
