-- Fix llm_usage table structure to match expected schema
-- 1. Drop old provider/model columns (provider_name/model_name already exist)
-- 2. Ensure conversation_id and user_id are properly structured
-- 3. Update foreign key relationships

-- No need to add company_id - focusing on core fields

-- Drop the old provider/model columns since provider_name/model_name already exist
ALTER TABLE public.llm_usage 
DROP COLUMN IF EXISTS provider;

ALTER TABLE public.llm_usage 
DROP COLUMN IF EXISTS model;

-- Update the index to use the correct column names
DROP INDEX IF EXISTS idx_llm_usage_provider_model;
CREATE INDEX idx_llm_usage_provider_model ON public.llm_usage(provider_name, model_name);

-- Add foreign key constraints for better data integrity
ALTER TABLE public.llm_usage 
ADD CONSTRAINT fk_llm_usage_conversation 
FOREIGN KEY (conversation_id) REFERENCES public.agent_conversations(id) ON DELETE SET NULL;

-- Add foreign key constraint to link with llm_models table
ALTER TABLE public.llm_usage 
ADD CONSTRAINT fk_llm_usage_model 
FOREIGN KEY (provider_name, model_name) REFERENCES public.llm_models(provider_name, model_name) ON DELETE SET NULL;

-- Add indexes for key columns
CREATE INDEX IF NOT EXISTS idx_llm_usage_conversation ON public.llm_usage(conversation_id);

-- Verification
DO $$
BEGIN
    RAISE NOTICE '✅ Successfully updated llm_usage table structure:';
    RAISE NOTICE '   - Dropped old provider and model columns';
    RAISE NOTICE '   - Using existing provider_name and model_name columns';
    RAISE NOTICE '   - Updated indexes and foreign key constraints';
    RAISE NOTICE '   - Ready for proper conversation_id and user_id population';
END $$;
