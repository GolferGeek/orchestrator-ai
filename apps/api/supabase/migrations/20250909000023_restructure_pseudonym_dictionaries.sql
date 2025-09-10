-- Migration: Restructure pseudonym dictionaries for dictionary-based pseudonymization
-- Date: 2025-09-09
-- Description: Add original_value and pseudonym columns, clean data, remove pseudonymizer patterns

-- Add new columns to pseudonym_dictionaries
ALTER TABLE public.pseudonym_dictionaries 
ADD COLUMN IF NOT EXISTS original_value VARCHAR(500),
ADD COLUMN IF NOT EXISTS pseudonym VARCHAR(500);

-- Add column comments
COMMENT ON COLUMN public.pseudonym_dictionaries.original_value IS 'The original text that should be pseudonymized';
COMMENT ON COLUMN public.pseudonym_dictionaries.pseudonym IS 'The pseudonym to replace the original text with';
COMMENT ON COLUMN public.pseudonym_dictionaries.value IS 'Legacy column - will be removed after migration';

-- Make the legacy value column nullable
ALTER TABLE public.pseudonym_dictionaries ALTER COLUMN value DROP NOT NULL;

-- Clear all existing pseudonym dictionary data
DELETE FROM public.pseudonym_dictionaries;

-- Insert our 3 specific entries with descriptive pseudonyms
INSERT INTO public.pseudonym_dictionaries (
    original_value, 
    pseudonym, 
    data_type, 
    category, 
    frequency_weight, 
    is_active
) VALUES 
('Matt Weber', '@person_matt', 'name', 'person', 1, true),
('GolferGeek', '@user_golfer', 'username', 'person', 1, true),
('Orchestrator AI', '@company_orchestrator', 'custom', 'business', 1, true);

-- Note: Pseudonymizer pattern cleanup will be handled by later migrations
-- This migration focuses on restructuring the pseudonym_dictionaries table

-- Add indexes for the new columns to optimize dictionary lookups
CREATE INDEX IF NOT EXISTS idx_pseudonym_dict_original_value 
ON public.pseudonym_dictionaries(original_value, is_active);

CREATE INDEX IF NOT EXISTS idx_pseudonym_dict_pseudonym 
ON public.pseudonym_dictionaries(pseudonym, is_active);
