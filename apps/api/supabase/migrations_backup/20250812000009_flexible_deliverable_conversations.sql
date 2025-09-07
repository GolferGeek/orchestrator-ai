-- Implement flexible deliverable-conversation relationships
-- This allows deliverables to survive conversation deletion and enables on-demand editing

BEGIN;

-- Step 1: Add agent_name field to deliverables table
-- This stores which agent should handle editing this deliverable
ALTER TABLE public.deliverables 
ADD COLUMN IF NOT EXISTS agent_name VARCHAR(255);

-- Step 2: Clean up orphaned deliverables (conversations that no longer exist)
-- Set conversation_id to NULL for deliverables referencing non-existent conversations
UPDATE public.deliverables 
SET conversation_id = NULL
WHERE conversation_id IS NOT NULL 
AND conversation_id NOT IN (SELECT id FROM public.agent_conversations);

-- Step 3: Update existing deliverables with agent_name from their conversations
-- This preserves the agent association for existing deliverables
UPDATE public.deliverables 
SET agent_name = ac.agent_name
FROM public.agent_conversations ac
WHERE public.deliverables.conversation_id = ac.id
AND public.deliverables.agent_name IS NULL;

-- Step 4: Drop existing foreign key constraint on conversation_id
-- We need to find and drop the existing constraint first
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find the foreign key constraint name for conversation_id
    SELECT c.conname INTO constraint_name
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'public.deliverables'::regclass
    AND a.attname = 'conversation_id'
    AND c.contype = 'f'
    LIMIT 1;
    
    -- Drop the constraint if it exists
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.deliverables DROP CONSTRAINT ' || constraint_name;
    END IF;
END $$;

-- Step 5: Add new foreign key constraint with SET NULL behavior
-- This ensures deliverables survive when conversations are deleted
ALTER TABLE public.deliverables 
ADD CONSTRAINT fk_deliverables_conversation_id 
FOREIGN KEY (conversation_id) 
REFERENCES public.agent_conversations(id) 
ON DELETE SET NULL;

-- Step 6: Ensure deliverable_versions still CASCADE when deliverables are deleted
-- This should already exist but let's verify
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_deliverable_versions_deliverable_id'
    ) THEN
        ALTER TABLE public.deliverable_versions 
        ADD CONSTRAINT fk_deliverable_versions_deliverable_id 
        FOREIGN KEY (deliverable_id) 
        REFERENCES public.deliverables(id) 
        ON DELETE CASCADE;
    END IF;
END $$;

-- Step 7: Add helpful indexes for new query patterns
CREATE INDEX IF NOT EXISTS idx_deliverables_standalone 
ON public.deliverables(user_id) 
WHERE conversation_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_deliverables_agent_name 
ON public.deliverables(agent_name) 
WHERE agent_name IS NOT NULL;

-- Step 8: Add helpful comments
COMMENT ON COLUMN public.deliverables.agent_name 
IS 'Agent that should handle editing this deliverable (inherited from creating conversation)';

COMMENT ON CONSTRAINT fk_deliverables_conversation_id ON public.deliverables 
IS 'SET NULL allows deliverables to survive conversation deletion for flexible workflows';

-- Step 9: Update table comment to reflect new flexibility
COMMENT ON TABLE public.deliverables 
IS 'Independent work products that can optionally be linked to conversations and project steps';

COMMIT;

-- Verification queries (uncomment to check results after migration)
-- SELECT COUNT(*) as total_deliverables FROM public.deliverables;
-- SELECT COUNT(*) as standalone_deliverables FROM public.deliverables WHERE conversation_id IS NULL;
-- SELECT COUNT(*) as deliverables_with_agent FROM public.deliverables WHERE agent_name IS NOT NULL;
-- SELECT COUNT(*) as orphaned_cleaned FROM public.deliverables WHERE conversation_id IS NULL AND agent_name IS NULL;
-- SELECT DISTINCT agent_name FROM public.deliverables WHERE agent_name IS NOT NULL;
