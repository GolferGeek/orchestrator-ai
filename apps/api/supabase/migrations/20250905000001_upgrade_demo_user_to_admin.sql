-- Upgrade demo.user@playground.com to admin role
-- This enables full access to LLM admin components and privacy admin panels for demo purposes

-- First, handle the missing role_audit_log table that triggers might reference
-- Create with flexible column types to handle both JSONB and ARRAY roles
CREATE TABLE IF NOT EXISTS public.role_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    admin_user_id UUID,
    action VARCHAR(50),
    old_roles TEXT, -- Store as text to handle both JSONB and ARRAY
    new_roles TEXT, -- Store as text to handle both JSONB and ARRAY  
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Check column type and update accordingly
DO $$
DECLARE
    column_type text;
BEGIN
    -- Get the actual column type
    SELECT data_type INTO column_type
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'roles';
    
    -- Update based on column type
    IF column_type = 'jsonb' THEN
        -- JSONB column type
        UPDATE public.users 
        SET 
            roles = '["user","admin"]'::jsonb,
            updated_at = CURRENT_TIMESTAMP
        WHERE email = 'demo.user@playground.com';
        
        -- Verify JSONB update
        IF NOT EXISTS (
            SELECT 1 FROM public.users 
            WHERE email = 'demo.user@playground.com' 
            AND roles ? 'admin'
        ) THEN
            RAISE EXCEPTION 'Failed to upgrade demo.user@playground.com to admin role (JSONB)';
        END IF;
        
    ELSIF column_type = 'ARRAY' THEN
        -- Array column type
        UPDATE public.users 
        SET 
            roles = ARRAY['user','admin']::text[],
            updated_at = CURRENT_TIMESTAMP
        WHERE email = 'demo.user@playground.com';
        
        -- Verify array update
        IF NOT EXISTS (
            SELECT 1 FROM public.users 
            WHERE email = 'demo.user@playground.com' 
            AND 'admin' = ANY(roles)
        ) THEN
            RAISE EXCEPTION 'Failed to upgrade demo.user@playground.com to admin role (ARRAY)';
        END IF;
        
    ELSE
        RAISE EXCEPTION 'Unsupported roles column type: %', column_type;
    END IF;
    
    RAISE NOTICE 'Successfully upgraded demo.user@playground.com to admin role (column type: %)', column_type;
END $$;
