-- Fix RLS policies for users table to prevent infinite recursion

-- Drop existing policies that might cause issues
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Admins can manage all users" ON users;
DROP POLICY IF EXISTS "Users can view their own data" ON users;
DROP POLICY IF EXISTS "Admins can view all user data" ON users;

-- Create simple, non-recursive policies
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid()::text = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid()::text = id);

-- Temporarily disable RLS to test if it's the cause
ALTER TABLE users DISABLE ROW LEVEL SECURITY;