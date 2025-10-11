-- Migration: add TTL support to task_messages for SSE backlog cleanup
-- Created: 2025-02-09

BEGIN;

-- 1) Create task_messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.task_messages (
  id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  task_id uuid NOT NULL,
  message text NOT NULL,
  event_type text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  user_id uuid
);

CREATE INDEX IF NOT EXISTS idx_task_messages_task_id
  ON public.task_messages (task_id);

CREATE INDEX IF NOT EXISTS idx_task_messages_created_at
  ON public.task_messages (created_at DESC);

COMMENT ON TABLE public.task_messages IS 'SSE event messages for task progress tracking with TTL support.';

-- 2) Ensure task_messages has an expires_at column for TTL management
ALTER TABLE public.task_messages
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- 3) Backfill existing rows with a 1 hour horizon if unset
UPDATE public.task_messages
   SET expires_at = COALESCE(expires_at, COALESCE(created_at, now()) + interval '1 hour')
 WHERE expires_at IS NULL;

-- 4) Set a default so new rows automatically receive an expiry
ALTER TABLE public.task_messages
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '1 hour');

-- 5) Keep column non-null going forward
ALTER TABLE public.task_messages
  ALTER COLUMN expires_at SET NOT NULL;

-- 6) Index expiry for cleanup jobs (and composite for task scoped trims)
CREATE INDEX IF NOT EXISTS idx_task_messages_expires_at
  ON public.task_messages (expires_at);

CREATE INDEX IF NOT EXISTS idx_task_messages_task_id_expires_at
  ON public.task_messages (task_id, expires_at);

COMMIT;
