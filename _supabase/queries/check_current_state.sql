-- Query to check current state of messages table and metadata
-- Run this in Supabase SQL Editor to see what's actually in your database

-- 1. Check current table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'messages' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check if any views exist that reference messages
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views 
WHERE schemaname = 'public' 
AND definition ILIKE '%messages%';

-- 3. Check a sample of recent messages to see what metadata is actually saved
SELECT 
    id,
    role,
    content,
    timestamp,
    -- Show the full metadata JSONB
    metadata,
    -- Extract some specific metadata fields to see what's there
    metadata->>'agentName' as agent_name_from_metadata,
    metadata->>'userName' as user_name_from_metadata,
    metadata->>'messageType' as message_type_from_metadata
FROM public.messages 
ORDER BY timestamp DESC 
LIMIT 5;

-- 4. Check what metadata keys are being used
SELECT DISTINCT
    jsonb_object_keys(metadata) as metadata_keys
FROM public.messages 
WHERE metadata IS NOT NULL
ORDER BY metadata_keys; 