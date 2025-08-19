-- Add task_id column to deliverables table to link deliverables with the tasks that created them
-- This enables task-based evaluation of deliverable quality

ALTER TABLE public.deliverables 
ADD COLUMN task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL;

-- Add index for performance when querying deliverables by task
CREATE INDEX idx_deliverables_task_id ON public.deliverables(task_id);

-- Add comment explaining the relationship
COMMENT ON COLUMN public.deliverables.task_id IS 'References the task that created this deliverable, used for task-based evaluation';