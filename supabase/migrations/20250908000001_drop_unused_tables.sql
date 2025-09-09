-- =====================================
-- DROP UNUSED TABLES SCRIPT
-- Based on analysis of db_cluster-15-08-2025@05-55-36.backup.gz
-- =====================================

-- IMPORTANT: 
-- 1. BACKUP YOUR DATABASE BEFORE RUNNING THIS
-- 2. Test in staging first
-- 3. Run in a transaction so you can rollback if needed

-- Begin transaction for safety
BEGIN;

-- =====================================
-- TABLES TO DROP (25 total)
-- These tables exist in the database but are not in our current schema
-- =====================================

-- Agent-related tables (not in current schema)
DROP TABLE IF EXISTS public.agent_health_status CASCADE;
DROP TABLE IF EXISTS public.agent_interactions CASCADE;
DROP TABLE IF EXISTS public.agent_relationships CASCADE;
DROP TABLE IF EXISTS public.agents CASCADE;

-- Human interaction tracking (not in current schema)
DROP TABLE IF EXISTS public.human_inputs CASCADE;

-- LangGraph state management (not in current schema)
DROP TABLE IF EXISTS public.langgraph_state_history CASCADE;
DROP TABLE IF EXISTS public.langgraph_states CASCADE;

-- LLM usage tracking (not in current schema)
DROP TABLE IF EXISTS public.llm_usage CASCADE;

-- MCP (Model Context Protocol) tables (not in current schema)
DROP TABLE IF EXISTS public.mcp_executions CASCADE;
DROP TABLE IF EXISTS public.mcp_failures CASCADE;
DROP TABLE IF EXISTS public.mcp_feedback CASCADE;
DROP TABLE IF EXISTS public.mcp_tool_usage CASCADE;

-- Duplicate/old provider and model tables (not in current schema)
DROP TABLE IF EXISTS public.models CASCADE;
DROP TABLE IF EXISTS public.providers CASCADE;

-- Audit and logging tables (not in current schema)
DROP TABLE IF EXISTS public.role_audit_log CASCADE;
DROP TABLE IF EXISTS public.user_audit_log CASCADE;

-- Task messaging (not in current schema)
DROP TABLE IF EXISTS public.task_messages CASCADE;

-- User-related tables (not in current schema)
DROP TABLE IF EXISTS public.user_cidafm_commands CASCADE;
DROP TABLE IF EXISTS public.user_context CASCADE;
DROP TABLE IF EXISTS public.user_interactions CASCADE;
DROP TABLE IF EXISTS public.user_preferences CASCADE;
DROP TABLE IF EXISTS public.user_privacy_settings CASCADE;
DROP TABLE IF EXISTS public.user_routing_patterns CASCADE;
DROP TABLE IF EXISTS public.user_sessions CASCADE;
DROP TABLE IF EXISTS public.user_usage_stats CASCADE;

-- =====================================
-- SCHEMA CLEANUP - KPI TABLES
-- =====================================

-- NOTE: The following KPI tables exist in public schema and will be kept there for now:
-- - public.companies (keeping in public schema)
-- - public.departments (keeping in public schema)  
-- - public.kpi_data (keeping in public schema)
-- - public.kpi_goals (keeping in public schema)
-- - public.kpi_metrics (keeping in public schema)

-- These tables are NOT being dropped as they contain business data

-- =====================================
-- VERIFICATION QUERIES
-- =====================================

-- Check how many tables were dropped
SELECT COUNT(*) as remaining_public_tables 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE';

-- List remaining public tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- =====================================
-- ROLLBACK OR COMMIT
-- =====================================

-- Review the results above, then either:
-- ROLLBACK; -- to undo all changes
-- or
-- COMMIT; -- to make changes permanent

-- For now, we'll rollback for safety - uncomment COMMIT when ready:
ROLLBACK;
-- COMMIT;