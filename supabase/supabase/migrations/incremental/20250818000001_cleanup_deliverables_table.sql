-- Migration: Clean up deliverables table by removing version-related fields
-- This migration removes confusing fields from deliverables table that belong in deliverable_versions table
-- Date: 2025-08-18
-- Purpose: Establish clean separation between deliverable metadata and version data

-- Before running this migration, ensure that any important data in these fields
-- has been migrated to the deliverable_versions table if needed

BEGIN;

-- Step 1: Remove version-related columns from deliverables table
-- These fields belong in deliverable_versions table, not deliverables table

-- Remove content field (content belongs in deliverable_versions)
ALTER TABLE public.deliverables DROP COLUMN IF EXISTS content;

-- Remove format field (format belongs in deliverable_versions)  
ALTER TABLE public.deliverables DROP COLUMN IF EXISTS format;

-- Remove version tracking fields (version tracking belongs in deliverable_versions)
ALTER TABLE public.deliverables DROP COLUMN IF EXISTS version;
ALTER TABLE public.deliverables DROP COLUMN IF EXISTS is_latest_version;

-- Remove parent deliverable reference (parent/child relationships are handled by version history)
ALTER TABLE public.deliverables DROP COLUMN IF EXISTS parent_deliverable_id;

-- Remove message_id (this can be stored in deliverable_versions metadata if needed)
ALTER TABLE public.deliverables DROP COLUMN IF EXISTS message_id;

-- Remove created_by_agent (this belongs in deliverable_versions as created_by_type)
ALTER TABLE public.deliverables DROP COLUMN IF EXISTS created_by_agent;

-- Remove status field if it exists (version status belongs in deliverable_versions)
ALTER TABLE public.deliverables DROP COLUMN IF EXISTS status;

-- Remove tags field if it exists (can be stored in deliverable metadata or deliverable_versions)
ALTER TABLE public.deliverables DROP COLUMN IF EXISTS tags;

-- Remove file_attachments (this belongs in deliverable_versions)
ALTER TABLE public.deliverables DROP COLUMN IF EXISTS file_attachments;

-- Step 2: Ensure clean deliverable table structure
-- The deliverables table should now contain ONLY:
-- - id (PRIMARY KEY)
-- - user_id (owner)
-- - conversation_id (optional - which conversation created this)
-- - project_step_id (optional - which project step this belongs to) 
-- - title (deliverable title)
-- - type (deliverable type)
-- - metadata (deliverable-level metadata)
-- - created_at, updated_at (timestamps)

-- Add any missing essential fields that should be in deliverables
ALTER TABLE public.deliverables ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Ensure proper constraints and indexes
-- Deliverable title should not be null
ALTER TABLE public.deliverables ALTER COLUMN title SET NOT NULL;

-- Add index for efficient lookups by user and conversation
CREATE INDEX IF NOT EXISTS idx_deliverables_user_id ON public.deliverables(user_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_conversation_id ON public.deliverables(conversation_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_project_step_id ON public.deliverables(project_step_id);

-- Step 3: Add helpful comment to table
COMMENT ON TABLE public.deliverables IS 'Deliverable metadata only - version data is stored in deliverable_versions table';

-- Step 4: Verify deliverable_versions table exists and has proper structure
-- This should already exist from previous migrations, but let's ensure it's properly set up

-- Ensure deliverable_versions table has proper constraints
DO $$
BEGIN
    -- Check if foreign key constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_deliverable_versions_deliverable_id'
    ) THEN
        ALTER TABLE public.deliverable_versions 
        ADD CONSTRAINT fk_deliverable_versions_deliverable_id 
        FOREIGN KEY (deliverable_id) REFERENCES public.deliverables(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Ensure only one current version per deliverable
-- This constraint may already exist, so we use IF NOT EXISTS equivalent
DO $$
BEGIN
    -- Check if constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_current_version_per_deliverable'
    ) THEN
        -- Add the constraint to ensure only one current version per deliverable
        ALTER TABLE public.deliverable_versions 
        ADD CONSTRAINT unique_current_version_per_deliverable 
        EXCLUDE (deliverable_id WITH =) WHERE (is_current_version = true);
    END IF;
END $$;

-- Add indexes for efficient version queries
CREATE INDEX IF NOT EXISTS idx_deliverable_versions_deliverable_id ON public.deliverable_versions(deliverable_id);
CREATE INDEX IF NOT EXISTS idx_deliverable_versions_current ON public.deliverable_versions(deliverable_id, is_current_version) WHERE is_current_version = true;
CREATE INDEX IF NOT EXISTS idx_deliverable_versions_number ON public.deliverable_versions(deliverable_id, version_number);

COMMENT ON TABLE public.deliverable_versions IS 'Version data for deliverables - each deliverable can have multiple versions';

COMMIT;

-- Post-migration verification queries (run these manually to verify the migration worked):
-- 
-- 1. Check deliverables table structure:
-- \d public.deliverables
-- 
-- 2. Check deliverable_versions table structure:
-- \d public.deliverable_versions
--
-- 3. Verify clean separation:
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'deliverables' AND table_schema = 'public' 
-- ORDER BY column_name;
--
-- 4. Check that version data is properly in deliverable_versions:
-- SELECT COUNT(*) FROM public.deliverable_versions;