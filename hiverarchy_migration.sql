-- Hiverarchy Database Migration
-- Date: 2025-01-25
-- Purpose: Add sessions and messages tables for Orchestrator AI integration
-- Note: No RLS policies, no user dependencies - simplified for Hiverarchy

-- Helper function to automatically update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Sessions Table
-- Stores individual chat sessions tied to profiles
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT, -- Optional, user-defined or auto-generated summary
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger for sessions table to auto-update timestamps
CREATE TRIGGER handle_sessions_updated_at
    BEFORE UPDATE ON public.sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Messages Table
-- Stores all messages within sessions (tied to profiles via session)
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT,
    timestamp TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    "order" SERIAL NOT NULL, -- SERIAL for auto-incrementing order within a session
    metadata JSONB
);

-- Create an index on session_id and order for faster message retrieval
CREATE INDEX IF NOT EXISTS idx_messages_session_order ON public.messages(session_id, "order");

-- Verification queries (optional - run these to verify the migration worked)
-- SELECT 'Sessions table created' as status, count(*) as row_count FROM public.sessions;
-- SELECT 'Messages table created' as status, count(*) as row_count FROM public.messages;
-- SELECT 'Indexes created' as status, indexname FROM pg_indexes WHERE tablename IN ('sessions', 'messages') AND schemaname = 'public'; 