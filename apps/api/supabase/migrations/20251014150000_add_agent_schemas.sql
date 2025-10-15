-- Migration: Add schema columns for agent plan/deliverable structures
-- Created: 2025-10-14
-- Purpose: Support structured definitions for agent plan, deliverable, and IO schemas

BEGIN;

ALTER TABLE public.agents
  ADD COLUMN plan_structure JSONB DEFAULT NULL,
  ADD COLUMN deliverable_structure JSONB DEFAULT NULL,
  ADD COLUMN io_schema JSONB DEFAULT NULL;

COMMENT ON COLUMN public.agents.plan_structure IS 'JSON Schema defining the expected structure of plans created by this agent';
COMMENT ON COLUMN public.agents.deliverable_structure IS 'JSON Schema defining the expected structure of deliverables created by this agent';
COMMENT ON COLUMN public.agents.io_schema IS 'JSON Schema defining technical input and output validation (types, constraints)';

COMMIT;
