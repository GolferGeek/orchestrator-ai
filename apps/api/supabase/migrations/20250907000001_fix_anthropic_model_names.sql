-- Migration: Fix Anthropic Model Names
-- Date: 2025-09-07
-- Description: Fix Anthropic model names by replacing dots with hyphens
-- 
-- This migration:
-- 1. Adds corrected Anthropic model entries with hyphens instead of dots
-- 2. Removes old entries with dots that cause 404 errors with Anthropic API
-- 3. Updates speed tiers for the new entries
-- 
-- Fixes: model claude-3.5-haiku-20241022 was not found (should be claude-3-5-haiku-20241022)

-- ============================================================================
-- STEP 1: ADD CORRECTED ANTHROPIC MODEL ENTRIES
-- ============================================================================

-- Note: At this point in migration sequence, table still uses provider_id (UUID) not provider_name (TEXT)
-- This migration will be handled by the complete LLM system refresh (20250909000001)
-- which properly recreates the table structure and populates it with correct model names

-- This migration is superseded by the complete LLM system refresh (20250909000001)
-- which handles all model naming issues comprehensively

-- Migration completed (no-op - handled by later migration)
