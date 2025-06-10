-- Migration: Clean up messages table by removing redundant columns
-- Date: 2025-06-10
-- Description: Remove any extra columns that duplicate data stored in metadata JSONB

-- Check current table structure first (for logging)
DO $$
DECLARE 
    column_names TEXT;
BEGIN
    SELECT string_agg(column_name, ', ' ORDER BY ordinal_position)
    INTO column_names
    FROM information_schema.columns 
    WHERE table_name = 'messages' AND table_schema = 'public';
    
    RAISE NOTICE 'Current messages table columns: %', column_names;
END $$;

-- Remove redundant columns if they exist
-- These columns should not exist based on our schema, but removing them if they were added manually

DO $$
BEGIN
    -- Remove agent_name column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'agent_name' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.messages DROP COLUMN agent_name;
        RAISE NOTICE 'Dropped agent_name column from messages table';
    END IF;

    -- Remove agent_id column if it exists  
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'agent_id' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.messages DROP COLUMN agent_id;
        RAISE NOTICE 'Dropped agent_id column from messages table';
    END IF;

    -- Remove agent_type column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'agent_type' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.messages DROP COLUMN agent_type;
        RAISE NOTICE 'Dropped agent_type column from messages table';
    END IF;

    -- Remove user_name column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'user_name' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.messages DROP COLUMN user_name;
        RAISE NOTICE 'Dropped user_name column from messages table';
    END IF;

    -- Remove display_name column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'display_name' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.messages DROP COLUMN display_name;
        RAISE NOTICE 'Dropped display_name column from messages table';
    END IF;

    -- Remove message_type column if it exists (this should be in metadata)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'message_type' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.messages DROP COLUMN message_type;
        RAISE NOTICE 'Dropped message_type column from messages table';
    END IF;
END $$;

-- Verify final table structure
DO $$
DECLARE 
    column_names TEXT;
BEGIN
    SELECT string_agg(column_name, ', ' ORDER BY ordinal_position)
    INTO column_names
    FROM information_schema.columns 
    WHERE table_name = 'messages' AND table_schema = 'public';
    
    RAISE NOTICE 'Final messages table columns: %', column_names;
END $$;

-- Expected columns should be: id, session_id, user_id, role, content, timestamp, order, metadata 