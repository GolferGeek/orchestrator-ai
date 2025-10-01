-- Migration: Create assets table for stored files (images, etc.)
-- Created: 2025-10-01

BEGIN;

CREATE TABLE IF NOT EXISTS public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage text NOT NULL CHECK (storage IN ('local','supabase')),
  path text NULL,             -- local filesystem path (relative to IMAGE_STORAGE_DIR)
  bucket text NULL,           -- supabase storage bucket name
  object_key text NULL,       -- supabase object key
  mime text NOT NULL,
  size bigint NULL,
  width integer NULL,
  height integer NULL,
  hash text NULL,
  user_id uuid NULL,
  conversation_id uuid NULL,
  deliverable_version_id uuid NULL REFERENCES public.deliverable_versions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assets_conversation_idx ON public.assets (conversation_id);
CREATE INDEX IF NOT EXISTS assets_version_idx ON public.assets (deliverable_version_id);

-- ensure updated_at auto-updates on change
CREATE OR REPLACE FUNCTION public.set_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_updated_at_assets ON public.assets;
CREATE TRIGGER set_timestamp_updated_at_assets
BEFORE UPDATE ON public.assets
FOR EACH ROW EXECUTE FUNCTION public.set_timestamp_updated_at();

COMMIT;

