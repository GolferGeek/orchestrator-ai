-- Rollback Migration for Clean Database
-- Generated: 2025-08-11T14:25:47.987Z
-- Description: Rollback script to undo the clean database migration

BEGIN;

-- Clear all data that was inserted by the migration
TRUNCATE TABLE human_inputs CASCADE;
TRUNCATE TABLE langgraph_states CASCADE;
TRUNCATE TABLE project_steps CASCADE;
TRUNCATE TABLE deliverables CASCADE;
TRUNCATE TABLE tasks CASCADE;
TRUNCATE TABLE agent_conversations CASCADE;
TRUNCATE TABLE projects CASCADE;
TRUNCATE TABLE user_cidafm_commands CASCADE;
TRUNCATE TABLE kpi_data CASCADE;
TRUNCATE TABLE kpi_goals CASCADE;
TRUNCATE TABLE cidafm_commands CASCADE;
TRUNCATE TABLE llm_models CASCADE;
TRUNCATE TABLE llm_providers CASCADE;

COMMIT;

-- Note: This rollback removes all data from the affected tables.
-- If you need to restore the original data, you'll need to use your
-- original database backup.
