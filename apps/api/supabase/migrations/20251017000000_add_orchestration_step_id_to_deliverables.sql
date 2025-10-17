-- Migration: Add orchestration_step_id to deliverables table
-- Purpose: Enable deliverables to reference the orchestration step that created them
-- Author: Architecture Consolidation Phase 3
-- Date: 2025-10-17

-- Add the new column
ALTER TABLE public.deliverables
ADD COLUMN orchestration_step_id UUID;

-- Create index for efficient lookups
CREATE INDEX idx_deliverables_orchestration_step
ON public.deliverables(orchestration_step_id);

-- Add foreign key constraint
ALTER TABLE public.deliverables
ADD CONSTRAINT deliverables_orchestration_step_fk
FOREIGN KEY (orchestration_step_id)
REFERENCES public.orchestration_steps(id)
ON DELETE SET NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.deliverables.orchestration_step_id IS
'Reference to the orchestration step that created this deliverable (replaces project_step_id)';
