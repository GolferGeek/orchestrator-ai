-- Migration: Fix specialist agent type to api
-- Created: 2025-10-14
-- Purpose: Remove invalid 'specialist' agent type, convert to 'api' type
-- Context: specialist was incorrectly used; requirements-specialist should be api type

BEGIN;

-- Update all specialist agents to api type
UPDATE public.agents
SET agent_type = 'api'
WHERE agent_type = 'specialist';

-- Update mode_profile for api agents that had specialist_full
-- API agents should use api_full mode profile
UPDATE public.agents
SET mode_profile = 'api_full'
WHERE agent_type = 'api'
  AND mode_profile = 'specialist_full';

COMMIT;
