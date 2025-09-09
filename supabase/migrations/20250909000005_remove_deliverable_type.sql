
-- Remove the deliverable_type column since application expects 'type' column
ALTER TABLE public.deliverables DROP COLUMN IF EXISTS deliverable_type;

