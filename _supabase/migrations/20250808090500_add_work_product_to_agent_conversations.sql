-- Migration: Add work product relationship columns to public.agent_conversations
-- Date: 2025-08-08
-- Notes:
--   - Sessions are deprecated for new features; use agent_conversations instead
--   - Adds columns for 1:1 conversation ↔ work product linkage
--   - Columns are nullable to preserve backward compatibility
--   - Valid values for type are enforced via CHECK constraint
--   - Composite index added for efficient lookups

BEGIN;

-- Add the work product type column (nullable) if it does not exist
ALTER TABLE public.agent_conversations
  ADD COLUMN IF NOT EXISTS primary_work_product_type TEXT;

-- Constrain type values when provided (use DO block to avoid error if it exists)
DO $$
BEGIN
  ALTER TABLE public.agent_conversations
    ADD CONSTRAINT ck_agent_conversations_primary_work_product_type
    CHECK (primary_work_product_type IN ('deliverable', 'project'));
EXCEPTION
  WHEN duplicate_object THEN
    -- Constraint already exists; do nothing
    NULL;
END $$;

-- Add the work product id column (nullable) if it does not exist
ALTER TABLE public.agent_conversations
  ADD COLUMN IF NOT EXISTS primary_work_product_id UUID;

-- Create composite index to speed up queries by work product
CREATE INDEX IF NOT EXISTS idx_agent_conversations_work_product
  ON public.agent_conversations (primary_work_product_type, primary_work_product_id);

COMMIT;

-- Rollback instructions (manual):
--   DROP INDEX IF EXISTS public.idx_agent_conversations_work_product;
--   ALTER TABLE public.agent_conversations DROP CONSTRAINT IF EXISTS ck_agent_conversations_primary_work_product_type;
--   ALTER TABLE public.agent_conversations DROP COLUMN IF EXISTS primary_work_product_id;
--   ALTER TABLE public.agent_conversations DROP COLUMN IF EXISTS primary_work_product_type;


