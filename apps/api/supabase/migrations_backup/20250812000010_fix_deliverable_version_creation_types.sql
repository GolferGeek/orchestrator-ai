-- Fix deliverable version creation types constraint
-- Add missing 'conversation_task' and 'conversation_merge' values to match TypeScript enum

BEGIN;

-- Drop the existing check constraint
ALTER TABLE public.deliverable_versions 
DROP CONSTRAINT IF EXISTS deliverable_versions_created_by_type_check;

-- Add the updated constraint with all allowed values
ALTER TABLE public.deliverable_versions 
ADD CONSTRAINT deliverable_versions_created_by_type_check 
CHECK (created_by_type IN (
    'ai_response', 
    'manual_edit', 
    'ai_enhancement', 
    'user_request',
    'conversation_task',
    'conversation_merge'
));

-- Update the helper function parameter comment
COMMENT ON FUNCTION public.create_deliverable_version IS 'Helper function to create new deliverable version with proper version numbering and current flag management. Allowed creation_type values: ai_response, manual_edit, ai_enhancement, user_request, conversation_task, conversation_merge';

COMMIT;

