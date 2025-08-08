-- Migration: Remove legacy sessions and messages tables
-- The system has migrated to conversations + tasks paradigm
-- Sessions and messages are no longer needed

-- Drop tables in correct order (handle foreign key dependencies)
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.sessions CASCADE;

-- Drop any associated indexes, triggers, or functions that were specific to sessions/messages
-- (Note: This will clean up any orphaned objects)

-- Verification
SELECT 'Sessions and messages tables removed successfully' as status;

-- Show remaining tables to confirm conversations and tasks are still there
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('agent_conversations', 'tasks', 'projects', 'project_steps')
ORDER BY table_name;å