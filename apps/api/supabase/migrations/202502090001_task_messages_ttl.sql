-- Migration: add TTL support to task_messages for SSE backlog cleanup
-- Created: 2025-02-09

BEGIN;

-- 1) Ensure task_messages has an expires_at column for TTL management
ALTER TABLE public.task_messages
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- 2) Backfill existing rows with a 1 hour horizon if unset
UPDATE public.task_messages
   SET expires_at = COALESCE(expires_at, COALESCE(created_at, now()) + interval '1 hour')
 WHERE expires_at IS NULL;

-- 3) Set a default so new rows automatically receive an expiry
ALTER TABLE public.task_messages
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '1 hour');

-- 4) Keep column non-null going forward
ALTER TABLE public.task_messages
  ALTER COLUMN expires_at SET NOT NULL;

-- 5) Index expiry for cleanup jobs (and composite for task scoped trims)
CREATE INDEX IF NOT EXISTS idx_task_messages_expires_at
  ON public.task_messages (expires_at);

CREATE INDEX IF NOT EXISTS idx_task_messages_task_id_expires_at
  ON public.task_messages (task_id, expires_at);

COMMIT;
