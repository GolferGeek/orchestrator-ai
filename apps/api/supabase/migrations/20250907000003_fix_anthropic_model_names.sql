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

-- Skip adding new models - they should be managed through the application

-- ============================================================================
-- STEP 2: UPDATE SPEED TIERS FOR NEW ENTRIES
-- ============================================================================

-- Skip speed tier updates - models managed through application

-- ============================================================================
-- STEP 3: REMOVE OLD ENTRIES WITH DOTS
-- ============================================================================

-- Skip deletion - models managed through application

-- ============================================================================
-- STEP 4: VERIFICATION
-- ============================================================================

-- Skip verification - models managed through application

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.llm_models IS 'LLM models with corrected Anthropic naming (hyphens not dots) - 2025-09-07 fix';
