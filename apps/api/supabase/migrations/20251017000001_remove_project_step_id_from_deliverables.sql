-- Migration: Remove project_step_id from deliverables table
-- Purpose: Complete migration from projects to orchestrations terminology
-- Author: Architecture Consolidation Phase 3
-- Date: 2025-10-17
-- Prerequisites: orchestration_step_id column added (migration 20251017000000)

-- Remove the old column (no data loss since count=0)
ALTER TABLE public.deliverables
DROP COLUMN IF EXISTS project_step_id;

-- Note: This is safe because:
-- 1. projects table has 0 rows
-- 2. project_steps table has 0 rows
-- 3. deliverables with project_step_id = 0 rows (verified 2025-10-17)
