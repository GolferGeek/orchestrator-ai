-- Migration: Extend assets for external references
-- Created: 2025-10-01

BEGIN;

-- Allow 'external' storage type
ALTER TABLE public.assets DROP CONSTRAINT IF EXISTS assets_storage_check;
ALTER TABLE public.assets ADD CONSTRAINT assets_storage_check CHECK (storage IN ('local','supabase','external'));

-- Add source_url to store original external URLs
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS source_url text;

COMMIT;

