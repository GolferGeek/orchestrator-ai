-- supabase/migrations/20231027123000_create_initial_tables.sql

-- Users Table
-- Stores public user profile information.
CREATE TABLE public.users (
    id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, -- Links to Supabase auth.users
    email TEXT UNIQUE,
    display_name TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Function to automatically update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for users table
CREATE TRIGGER handle_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Helper function to insert a new user into public.users when a new auth.user is created.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email)
    VALUES (NEW.id, NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Important Note on auth.users trigger:
-- The trigger to call public.handle_new_user() on new auth.user creation
-- (e.g., AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user())
-- is best created via the Supabase Dashboard (Database > Triggers) due to potential permission
-- restrictions when running migrations. This migration creates the function; the trigger
-- should be manually verified or created in the dashboard if it cannot be applied by this script.


-- Sessions Table
-- Stores individual chat sessions.
CREATE TABLE public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT, -- Optional, user-defined or auto-generated summary
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger for sessions table
CREATE TRIGGER handle_sessions_updated_at
    BEFORE UPDATE ON public.sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS for sessions
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see and manage their own sessions.
CREATE POLICY "Allow users to manage their own sessions"
ON public.sessions
FOR ALL
TO authenticated
USING (auth.uid() = user_id);


-- Messages Table
-- Stores all messages within sessions.
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE, -- For easier RLS and querying user-specific messages
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT,
    timestamp TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    "order" SERIAL NOT NULL, -- SERIAL for auto-incrementing order within a session
    metadata JSONB
);
-- Create an index on session_id and order for faster message retrieval
CREATE INDEX idx_messages_session_order ON public.messages(session_id, "order");

-- Enable RLS for messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see and manage messages in their own sessions.
CREATE POLICY "Allow users to manage messages in their own sessions"
ON public.messages
FOR ALL
TO authenticated
USING (auth.uid() = user_id);

-- Grant basic permissions - Supabase default roles usually have this on `public` schema,
-- but being explicit can be helpful for clarity or if defaults change.
-- It's generally recommended to manage fine-grained permissions via RLS policies.
-- GRANT USAGE ON SCHEMA public TO authenticated;
-- GRANT ALL ON TABLE public.users TO authenticated;
-- GRANT ALL ON TABLE public.sessions TO authenticated;
-- GRANT ALL ON TABLE public.messages TO authenticated;
-- GRANT USAGE, SELECT ON SEQUENCE public.messages_order_seq TO authenticated; -- If using SERIAL 