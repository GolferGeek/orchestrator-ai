-- Rollback: Remove orchestration_step_id from deliverables
-- This column is redundant because the relationship is:
-- orchestration_step -> conversation -> deliverable

-- Drop the foreign key constraint first
ALTER TABLE public.deliverables
DROP CONSTRAINT IF EXISTS deliverables_orchestration_step_fk;

-- Drop the index
DROP INDEX IF EXISTS public.idx_deliverables_orchestration_step;

-- Drop the column
ALTER TABLE public.deliverables
DROP COLUMN IF EXISTS orchestration_step_id;
