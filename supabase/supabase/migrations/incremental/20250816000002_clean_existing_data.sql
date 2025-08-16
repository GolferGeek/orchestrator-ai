-- Clean existing conversations and deliverables data
-- This prepares for the new deliverables versioning system
-- IMPORTANT: This will delete ALL existing conversations and deliverables

-- Start transaction for safety
BEGIN;

-- Delete all deliverables first (due to foreign key constraints)
DELETE FROM public.deliverables;

-- Delete all conversations (this will cascade to related data)
DELETE FROM public.agent_conversations;

-- Delete all tasks that are not associated with conversations
-- (Some tasks might exist without conversations)
DELETE FROM public.tasks WHERE agent_conversation_id IS NULL;

-- Reset any auto-incrementing sequences if they exist
-- (Not applicable here since we use UUIDs, but good practice)

-- Verification queries to confirm deletion
-- Uncomment these to check results:

-- SELECT COUNT(*) AS remaining_deliverables FROM public.deliverables;
-- SELECT COUNT(*) AS remaining_conversations FROM public.agent_conversations;
-- SELECT COUNT(*) AS remaining_orphaned_tasks FROM public.tasks WHERE agent_conversation_id IS NULL;

-- Commit the deletion
COMMIT;

-- Add comment explaining the purpose
COMMENT ON TABLE public.deliverables IS 'Deliverables table - prepared for new versioning system where each conversation has one deliverable with multiple versions';
COMMENT ON TABLE public.agent_conversations IS 'Agent conversations table - cleaned for new deliverables versioning system';