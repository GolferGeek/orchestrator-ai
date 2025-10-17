-- Add user_id to orchestration_runs for efficient user-based queries
-- This denormalizes the user_id from conversations for performance

-- Add the user_id column
ALTER TABLE public.orchestration_runs
ADD COLUMN user_id UUID;

-- Create index for efficient user-based lookups
CREATE INDEX idx_orchestration_runs_user_id
ON public.orchestration_runs(user_id);

-- Add foreign key constraint to users table
ALTER TABLE public.orchestration_runs
ADD CONSTRAINT orchestration_runs_user_fk
FOREIGN KEY (user_id)
REFERENCES public.users(id)
ON DELETE SET NULL;

-- Backfill user_id from existing conversations (if any data exists)
UPDATE public.orchestration_runs
SET user_id = c.user_id
FROM public.conversations c
WHERE orchestration_runs.conversation_id = c.id
AND orchestration_runs.user_id IS NULL;
