-- Remove TTL (expires_at) from task_messages and add cascade delete
-- Task messages should persist as long as their parent task exists

-- Remove expires_at column (no longer using TTL-based cleanup)
ALTER TABLE public.task_messages
DROP COLUMN IF EXISTS expires_at;

-- Add foreign key constraint with cascade delete
-- When a task is deleted, its messages should also be deleted
ALTER TABLE public.task_messages
DROP CONSTRAINT IF EXISTS task_messages_task_id_fkey;

ALTER TABLE public.task_messages
ADD CONSTRAINT task_messages_task_id_fkey
FOREIGN KEY (task_id)
REFERENCES public.tasks(id)
ON DELETE CASCADE;

-- Add index for efficient task message queries
CREATE INDEX IF NOT EXISTS idx_task_messages_task_id_created_at
ON public.task_messages(task_id, created_at DESC);
