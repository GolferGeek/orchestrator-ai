-- Migration: Drop unused config and agent_card columns
-- Created: 2025-10-16
-- Purpose: Remove columns that are not being used correctly or at all
--   - agent_card: Generated dynamically from YAML, not stored
--   - config: Moving all configuration to YAML for single source of truth

BEGIN;

-- Drop agent_card column (never used, A2A card is generated)
ALTER TABLE public.agents DROP COLUMN IF EXISTS agent_card;

-- Drop config column (moving all config to YAML)
ALTER TABLE public.agents DROP COLUMN IF EXISTS config;

COMMIT;
