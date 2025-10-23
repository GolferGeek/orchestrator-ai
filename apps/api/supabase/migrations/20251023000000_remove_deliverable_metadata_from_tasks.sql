-- Remove deliverable_metadata column from tasks table
-- This field is redundant since deliverable_versions.task_id already links back to tasks
-- and deliverable content metadata doesn't need to be duplicated at the task level

ALTER TABLE public.tasks
DROP COLUMN IF EXISTS deliverable_metadata;
