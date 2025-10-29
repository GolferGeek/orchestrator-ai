-- Migration: Drop Orchestration Tables for Orchestrator V2 Cleanup
-- Author: AI Assistant (Orchestrator V2 Initiative)
-- Date: 2025-10-29
-- Description: Removes all orchestration-specific tables as part of the Orchestrator V2 cleanup.
--              Orchestrators will now function as standard agents that delegate to sub-agents via
--              existing /agent-to-agent endpoints, eliminating complex orchestration infrastructure.
--
-- Related: .taskmaster/docs/orchestrator-v2-db-analysis.md
-- Dependencies: None (safe to run, all FKs use CASCADE or SET NULL)
--
-- Tables to drop (6 total):
--   1. orchestration_runs (parent, CASCADE to checkpoints/steps)
--   2. orchestration_checkpoints (child of runs)
--   3. orchestration_steps (child of runs)
--   4. agent_orchestrations (independent)
--   5. orchestration_definitions (independent)
--
-- External Impact:
--   - human_approvals.orchestration_run_id will be SET NULL (safe)
--   - human_approvals.orchestration_step_id will be SET NULL (safe)

-- ============================================
-- Pre-Migration Verification
-- ============================================

DO $$
DECLARE
    active_run_count INTEGER;
    checkpoint_count INTEGER;
    step_count INTEGER;
    definition_count INTEGER;
    agent_orch_count INTEGER;
BEGIN
    -- Count records in each table for audit log
    SELECT COUNT(*) INTO active_run_count FROM public.orchestration_runs;
    SELECT COUNT(*) INTO checkpoint_count FROM public.orchestration_checkpoints;
    SELECT COUNT(*) INTO step_count FROM public.orchestration_steps;
    SELECT COUNT(*) INTO definition_count FROM public.orchestration_definitions;
    SELECT COUNT(*) INTO agent_orch_count FROM public.agent_orchestrations;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Pre-Migration Audit';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'orchestration_runs:         % records', active_run_count;
    RAISE NOTICE 'orchestration_checkpoints:  % records', checkpoint_count;
    RAISE NOTICE 'orchestration_steps:        % records', step_count;
    RAISE NOTICE 'orchestration_definitions:  % records', definition_count;
    RAISE NOTICE 'agent_orchestrations:       % records', agent_orch_count;
    RAISE NOTICE '========================================';
    
    -- Safety check: Warn if there are active orchestration runs
    IF active_run_count > 0 THEN
        RAISE WARNING 'Found % orchestration runs in database. These will be permanently deleted.', active_run_count;
        RAISE WARNING 'Ensure no production orchestrations are in progress before proceeding.';
    END IF;
END $$;

-- ============================================
-- Migration Code - Drop Orchestration Tables
-- ============================================

BEGIN;

-- Step 1: Drop orchestration_runs (CASCADE to checkpoints and steps)
-- This is the parent table that other orchestration tables reference
DO $$ BEGIN RAISE NOTICE 'Dropping orchestration_runs (CASCADE to children)...'; END $$;
DROP TABLE IF EXISTS public.orchestration_runs CASCADE;

-- Step 2: Drop independent tables (no foreign key dependencies)
DO $$ BEGIN RAISE NOTICE 'Dropping agent_orchestrations...'; END $$;
DROP TABLE IF EXISTS public.agent_orchestrations CASCADE;

DO $$ BEGIN RAISE NOTICE 'Dropping orchestration_definitions...'; END $$;
DROP TABLE IF EXISTS public.orchestration_definitions CASCADE;

-- Step 3: Explicitly drop remaining tables (safety check in case CASCADE didn't handle them)
-- These should already be dropped by CASCADE, but we're being explicit for safety
DO $$ BEGIN RAISE NOTICE 'Verifying orchestration_checkpoints is dropped...'; END $$;
DROP TABLE IF EXISTS public.orchestration_checkpoints CASCADE;

DO $$ BEGIN RAISE NOTICE 'Verifying orchestration_steps is dropped...'; END $$;
DROP TABLE IF EXISTS public.orchestration_steps CASCADE;

-- ============================================
-- Post-Migration Verification
-- ============================================

DO $$
DECLARE
    remaining_count INTEGER;
    approval_run_refs INTEGER;
    approval_step_refs INTEGER;
BEGIN
    -- Verify all orchestration tables are gone
    SELECT COUNT(*) INTO remaining_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN (
        'agent_orchestrations',
        'orchestration_checkpoints',
        'orchestration_definitions',
        'orchestration_runs',
        'orchestration_steps'
    );
    
    IF remaining_count > 0 THEN
        RAISE EXCEPTION 'Migration failed: % orchestration tables still exist', remaining_count;
    END IF;
    
    -- Verify human_approvals references are nullified
    SELECT COUNT(orchestration_run_id) INTO approval_run_refs FROM public.human_approvals;
    SELECT COUNT(orchestration_step_id) INTO approval_step_refs FROM public.human_approvals;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Post-Migration Verification';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'SUCCESS: All % orchestration tables dropped', 5;
    RAISE NOTICE 'human_approvals.orchestration_run_id refs:  %', approval_run_refs;
    RAISE NOTICE 'human_approvals.orchestration_step_id refs: %', approval_step_refs;
    RAISE NOTICE '(Expected: 0 for both human_approvals refs)';
    RAISE NOTICE '========================================';
END $$;

COMMIT;

-- ============================================
-- Additional Verification Queries
-- ============================================

-- Run these manually to double-check migration success:

-- 1. Verify no orchestration tables remain
-- SELECT table_name 
-- FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name LIKE '%orchestration%';

-- 2. Check human_approvals nullification
-- SELECT 
--   COUNT(*) as total_approvals,
--   COUNT(orchestration_run_id) as with_run_ref,
--   COUNT(orchestration_step_id) as with_step_ref
-- FROM human_approvals;

-- 3. Check for any orphaned indexes
-- SELECT indexname 
-- FROM pg_indexes 
-- WHERE schemaname = 'public' 
-- AND indexname LIKE '%orchestration%';


-- ============================================
-- Rollback Instructions
-- ============================================
-- To rollback this migration, restore from the pre-migration database snapshot:
--
-- Option 1: Restore from latest snapshot
--   npm run db:apply-snapshot
--
-- Option 2: Restore from specific snapshot
--   export PGPASSWORD=postgres
--   docker exec -i supabase_db_api-dev psql \
--     -h localhost -p 5432 -U postgres -d postgres \
--     < storage/snapshots/[snapshot-name]/schema.sql
--
-- Option 3: Re-create tables from schema (lines 1630-2287 of latest schema.sql)
--   - Extract table definitions from storage/snapshots/latest/schema.sql
--   - Apply to database
--   - Note: This will NOT restore data, only table structure
--
-- Estimated rollback time: 2-5 minutes (snapshot restore)
--
-- ⚠️  WARNING: This migration is DESTRUCTIVE. All orchestration data will be 
--              permanently deleted. Ensure proper backups exist before proceeding.

