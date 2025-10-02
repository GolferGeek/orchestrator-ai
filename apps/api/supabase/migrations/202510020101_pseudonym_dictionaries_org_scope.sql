-- Add org/agent scoping and timestamps to pseudonym_dictionaries to match code expectations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'pseudonym_dictionaries' AND column_name = 'organization_slug'
  ) THEN
    ALTER TABLE public.pseudonym_dictionaries
      ADD COLUMN organization_slug text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'pseudonym_dictionaries' AND column_name = 'agent_slug'
  ) THEN
    ALTER TABLE public.pseudonym_dictionaries
      ADD COLUMN agent_slug text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'pseudonym_dictionaries' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.pseudonym_dictionaries
      ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_pseudonym_dictionaries_org ON public.pseudonym_dictionaries(organization_slug);
CREATE INDEX IF NOT EXISTS idx_pseudonym_dictionaries_agent ON public.pseudonym_dictionaries(agent_slug);
CREATE INDEX IF NOT EXISTS idx_pseudonym_dictionaries_updated_at ON public.pseudonym_dictionaries(updated_at);

