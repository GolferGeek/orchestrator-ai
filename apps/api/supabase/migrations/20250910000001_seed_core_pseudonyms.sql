-- Migration: Seed pseudonym_dictionaries table with required values
-- Date: 2025-09-10
-- Description: This migration ensures the pseudonym_dictionaries table is populated with the three essential, non-negotiable key-value pairs required for the application's core PII protection to function correctly. It first clears any existing data to prevent duplicates and ensure a clean state.

-- Step 1: Clear any existing data from the table to ensure a clean slate.
DELETE FROM public.pseudonym_dictionaries;

-- Step 2: Insert the three required pseudonym mappings.
INSERT INTO public.pseudonym_dictionaries
  (original_value, pseudonym, data_type, category, is_active)
VALUES
  ('Matt Weber', '[PERSON_NAME_001]', 'name', 'core_entities', TRUE),
  ('GolferGeek', '[USERNAME_001]', 'username', 'core_entities', TRUE),
  ('Orchestrator AI', '[ORGANIZATION_001]', 'organization', 'core_entities', TRUE)
ON CONFLICT (original_value) DO UPDATE SET
  pseudonym = EXCLUDED.pseudonym,
  data_type = EXCLUDED.data_type,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active;

-- Verification
DO $$
BEGIN
    RAISE NOTICE '✅ Successfully seeded pseudonym_dictionaries table with 3 core entities.';
END $$;
