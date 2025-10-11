-- Migration: add TTL support to task_messages for SSE backlog cleanup
-- Created: 2025-02-09

BEGIN;

-- 1) Create task_messages table if it doesn't exist (align with TaskMessageService expectations)
CREATE TABLE IF NOT EXISTS public.task_messages (
  id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  task_id uuid NOT NULL,
  user_id uuid,
  content text NOT NULL,
  message_type text NOT NULL DEFAULT 'info',
  progress_percentage numeric,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '1 hour')
);

COMMENT ON TABLE public.task_messages IS 'Short-lived task streaming messages used for SSE + polling replay.';

-- 2) Ensure expected columns exist when migrating older installs
ALTER TABLE public.task_messages
  ADD COLUMN IF NOT EXISTS user_id uuid;

ALTER TABLE public.task_messages
  ADD COLUMN IF NOT EXISTS content text;

ALTER TABLE public.task_messages
  ADD COLUMN IF NOT EXISTS message_type text;

ALTER TABLE public.task_messages
  ADD COLUMN IF NOT EXISTS progress_percentage numeric;

ALTER TABLE public.task_messages
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.task_messages
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.task_messages
  ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + interval '1 hour');

-- 3) Backfill column defaults / constraints
ALTER TABLE public.task_messages
  ALTER COLUMN message_type SET DEFAULT 'info';

ALTER TABLE public.task_messages
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

ALTER TABLE public.task_messages
  ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public.task_messages
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '1 hour');

ALTER TABLE public.task_messages
  ALTER COLUMN expires_at SET NOT NULL;

-- 4) Populate expires_at for existing rows lacking a value
UPDATE public.task_messages
   SET expires_at = COALESCE(expires_at, COALESCE(created_at, now()) + interval '1 hour')
 WHERE expires_at IS NULL;

-- 5) Update legacy column names if an older schema used different names
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'task_messages'
      AND column_name = 'message'
  ) THEN
    ALTER TABLE public.task_messages RENAME COLUMN message TO content;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'task_messages'
      AND column_name = 'event_type'
  ) THEN
    ALTER TABLE public.task_messages RENAME COLUMN event_type TO message_type;
  END IF;
END $$;

-- 6) Index expiry for cleanup jobs (and composite for task scoped trims)
CREATE INDEX IF NOT EXISTS idx_task_messages_expires_at
  ON public.task_messages (expires_at);

CREATE INDEX IF NOT EXISTS idx_task_messages_task_id_expires_at
  ON public.task_messages (task_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_task_messages_task_id
  ON public.task_messages (task_id);

CREATE INDEX IF NOT EXISTS idx_task_messages_created_at
  ON public.task_messages (created_at DESC);

COMMIT;
