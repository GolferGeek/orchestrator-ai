-- Add 'llm_rerun' to deliverable version creation types constraint
-- This allows deliverable versions to be created via LLM rerun functionality

BEGIN;

-- Drop the existing check constraint
ALTER TABLE public.deliverable_versions 
DROP CONSTRAINT IF EXISTS deliverable_versions_created_by_type_check;

-- Add the updated constraint with 'llm_rerun' included
ALTER TABLE public.deliverable_versions 
ADD CONSTRAINT deliverable_versions_created_by_type_check 
CHECK (created_by_type IN (
    'ai_response', 
    'manual_edit', 
    'ai_enhancement', 
    'user_request',
    'conversation_task',
    'conversation_merge',
    'llm_rerun'
));

-- Update the helper function parameter comment
COMMENT ON FUNCTION public.create_deliverable_version IS 'Helper function to create new deliverable version with proper version numbering and current flag management. Allowed creation_type values: ai_response, manual_edit, ai_enhancement, user_request, conversation_task, conversation_merge, llm_rerun';

COMMIT;
