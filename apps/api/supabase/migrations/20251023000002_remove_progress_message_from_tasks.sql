-- Remove progress_message column from tasks table
-- This field is redundant now that we have task_messages table for full message history

ALTER TABLE public.tasks
DROP COLUMN IF EXISTS progress_message;
