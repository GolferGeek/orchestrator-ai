-- Migration: Drop legacy projects and project_steps tables
-- Purpose: Complete removal of deprecated project system
-- Author: Architecture Consolidation Phase 3
-- Date: 2025-10-17
-- Prerequisites:
--   - orchestration system fully operational
--   - project_step_id removed from deliverables (migration 20251017000001)

-- Drop project_steps table first (child table)
DROP TABLE IF EXISTS public.project_steps CASCADE;

-- Drop projects table (parent table)
DROP TABLE IF EXISTS public.projects CASCADE;

-- Note: This is safe because:
-- 1. projects table verified empty (0 rows) on 2025-10-17
-- 2. project_steps table verified empty (0 rows) on 2025-10-17
-- 3. All deliverables using orchestration_step_id now
-- 4. Orchestration system is the single source of truth

COMMENT ON DATABASE postgres IS
'Legacy project system removed 2025-10-17. Use orchestration_runs and orchestration_steps instead.';
