-- Migration: Remove pseudonymizer patterns for dictionary-based pseudonymization
-- Date: 2025-09-15
-- Description: Remove all pseudonymizer patterns since we're moving to dictionary-based pseudonymization
-- Note: This runs after 20250915000001_add_pii_pattern_severity_columns.sql

-- Remove all pseudonymizer patterns from redaction_patterns
-- Keep only flagger and showstopper patterns
DELETE FROM public.redaction_patterns WHERE severity = 'pseudonymizer';

-- Log the cleanup
DO $$
DECLARE
    remaining_count INTEGER;
    flagger_count INTEGER;
    showstopper_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_count FROM public.redaction_patterns WHERE is_active = true;
    SELECT COUNT(*) INTO flagger_count FROM public.redaction_patterns WHERE severity = 'flagger' AND is_active = true;
    SELECT COUNT(*) INTO showstopper_count FROM public.redaction_patterns WHERE severity = 'showstopper' AND is_active = true;
    
    RAISE NOTICE '✅ Cleaned up pseudonymizer patterns for dictionary-based pseudonymization';
    RAISE NOTICE '   - Remaining active patterns: %', remaining_count;
    RAISE NOTICE '   - Flagger patterns (monitoring): %', flagger_count;
    RAISE NOTICE '   - Showstopper patterns (blocking): %', showstopper_count;
    RAISE NOTICE '   - Pseudonymization now handled by dictionary lookup in LLM service';
END $$;
