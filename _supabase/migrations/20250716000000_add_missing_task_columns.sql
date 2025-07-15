-- Add missing columns to tasks table
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS response_metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS error_data JSONB;

-- Update existing records to have empty response_metadata
UPDATE public.tasks 
SET response_metadata = '{}'::jsonb 
WHERE response_metadata IS NULL;