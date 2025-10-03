-- Create pseudonym_mappings table for PII pseudonymization tracking
CREATE TABLE IF NOT EXISTS public.pseudonym_mappings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  original_hash text NOT NULL,
  pseudonym text NOT NULL,
  data_type text NOT NULL,
  context text,
  usage_count integer DEFAULT 1,
  last_used_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_pseudonym_mappings_original_hash ON public.pseudonym_mappings(original_hash);
CREATE INDEX IF NOT EXISTS idx_pseudonym_mappings_pseudonym ON public.pseudonym_mappings(pseudonym);
CREATE INDEX IF NOT EXISTS idx_pseudonym_mappings_data_type ON public.pseudonym_mappings(data_type);
CREATE INDEX IF NOT EXISTS idx_pseudonym_mappings_context ON public.pseudonym_mappings(context);
CREATE INDEX IF NOT EXISTS idx_pseudonym_mappings_created_at ON public.pseudonym_mappings(created_at);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION set_timestamp_updated_at_pseudonym_mappings()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_timestamp_updated_at_pseudonym_mappings
  BEFORE UPDATE ON public.pseudonym_mappings
  FOR EACH ROW
  EXECUTE FUNCTION set_timestamp_updated_at_pseudonym_mappings();

-- Add RLS policy (if needed)
ALTER TABLE public.pseudonym_mappings ENABLE ROW LEVEL SECURITY;

-- Add comment
COMMENT ON TABLE public.pseudonym_mappings IS 'Stores pseudonym mappings for PII data protection and reversibility';

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
