-- Add pseudonym_mappings column to llm_usage table for PII data tracking

-- Add pseudonym_mappings column to llm_usage table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'llm_usage' AND column_name = 'pseudonym_mappings'
  ) THEN
    ALTER TABLE public.llm_usage
      ADD COLUMN pseudonym_mappings jsonb;
  END IF;
END $$;
