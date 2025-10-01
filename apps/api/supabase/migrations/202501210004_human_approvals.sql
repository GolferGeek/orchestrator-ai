-- Migration: Create human_approvals table for gating approvals
-- Created: 2025-01-21

BEGIN;

CREATE TABLE IF NOT EXISTS public.human_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_slug text NULL,
  agent_slug text NOT NULL,
  conversation_id uuid NULL,
  task_id text NULL,
  mode text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  approved_by text NULL,
  decision_at timestamptz NULL,
  metadata jsonb NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS human_approvals_conversation_idx ON public.human_approvals (conversation_id);
CREATE INDEX IF NOT EXISTS human_approvals_status_idx ON public.human_approvals (status);

-- Simple trigger to update updated_at
CREATE OR REPLACE FUNCTION public.set_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_updated_at_human_approvals ON public.human_approvals;
CREATE TRIGGER set_timestamp_updated_at_human_approvals
BEFORE UPDATE ON public.human_approvals
FOR EACH ROW EXECUTE FUNCTION public.set_timestamp_updated_at();

COMMIT;

