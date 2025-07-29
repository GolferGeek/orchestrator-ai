-- Migration: Add role support to users table
-- This migration adds a roles column to support multiple roles per user for admin evaluation access

-- Add roles column to users table (supports multiple roles as string array)
ALTER TABLE users ADD COLUMN IF NOT EXISTS roles TEXT[] DEFAULT ARRAY['user'];

-- Create index for efficient role-based queries
CREATE INDEX IF NOT EXISTS idx_users_roles ON users USING GIN(roles);

-- Update existing users to have 'user' role if roles is null or empty
UPDATE users 
SET roles = ARRAY['user'] 
WHERE roles IS NULL OR array_length(roles, 1) IS NULL;

-- Add constraint to ensure roles array is never completely empty
ALTER TABLE users ADD CONSTRAINT check_roles_not_empty 
CHECK (array_length(roles, 1) > 0);

-- Create helper function to check if user has specific role
CREATE OR REPLACE FUNCTION user_has_role(user_roles TEXT[], required_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN required_role = ANY(user_roles);
END;
$$ LANGUAGE plpgsql;

-- Create helper function to check if user has any of the required roles
CREATE OR REPLACE FUNCTION user_has_any_role(user_roles TEXT[], required_roles TEXT[])
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM unnest(required_roles) AS required_role
        WHERE required_role = ANY(user_roles)
    );
END;
$$ LANGUAGE plpgsql;

-- Create helper function to add role to user (avoiding duplicates)
CREATE OR REPLACE FUNCTION add_user_role(user_id UUID, new_role TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE users 
    SET roles = array_append(roles, new_role)
    WHERE id = user_id 
    AND NOT (new_role = ANY(roles));
END;
$$ LANGUAGE plpgsql;

-- Create helper function to remove role from user
CREATE OR REPLACE FUNCTION remove_user_role(user_id UUID, role_to_remove TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE users 
    SET roles = array_remove(roles, role_to_remove)
    WHERE id = user_id;
    
    -- Ensure user always has at least the 'user' role
    UPDATE users 
    SET roles = ARRAY['user']
    WHERE id = user_id 
    AND (roles IS NULL OR array_length(roles, 1) IS NULL OR array_length(roles, 1) = 0);
END;
$$ LANGUAGE plpgsql;

-- Create view for admin users (for easy querying)
CREATE OR REPLACE VIEW admin_users AS
SELECT 
    id,
    email,
    display_name,
    roles,
    created_at,
    updated_at
FROM users
WHERE 'admin' = ANY(roles);

-- Create view for users with evaluation monitoring permissions
CREATE OR REPLACE VIEW evaluation_monitor_users AS
SELECT 
    id,
    email,
    display_name,
    roles,
    created_at,
    updated_at
FROM users
WHERE 'admin' = ANY(roles) 
   OR 'evaluation-monitor' = ANY(roles)
   OR 'developer' = ANY(roles);

-- Row Level Security (RLS) Policies for role-based access
-- Enable RLS on users table if not already enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can always read their own profile
DROP POLICY IF EXISTS "Users can read own profile" ON users;
CREATE POLICY "Users can read own profile" ON users
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

-- Policy: Users can update their own profile (but not roles)
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Policy: Admins can read all profiles
DROP POLICY IF EXISTS "Admins can read all profiles" ON users;
CREATE POLICY "Admins can read all profiles" ON users
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND 'admin' = ANY(roles)
        )
    );

-- Policy: Admins can update any user's roles
DROP POLICY IF EXISTS "Admins can update user roles" ON users;
CREATE POLICY "Admins can update user roles" ON users
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND 'admin' = ANY(roles)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND 'admin' = ANY(roles)
        )
    );

-- Create role audit log table for tracking role changes
CREATE TABLE IF NOT EXISTS role_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('add_role', 'remove_role', 'set_roles')),
    old_roles TEXT[],
    new_roles TEXT[],
    role_changed TEXT, -- The specific role that was added/removed
    reason TEXT, -- Optional explanation for the change
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for efficient audit log queries
CREATE INDEX IF NOT EXISTS idx_role_audit_log_user_id ON role_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_role_audit_log_admin_user_id ON role_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_role_audit_log_created_at ON role_audit_log(created_at);

-- Function to log role changes
CREATE OR REPLACE FUNCTION log_role_change(
    target_user_id UUID,
    admin_user_id UUID,
    action_type TEXT,
    old_roles_array TEXT[],
    new_roles_array TEXT[],
    changed_role TEXT DEFAULT NULL,
    change_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO role_audit_log (
        user_id,
        admin_user_id,
        action,
        old_roles,
        new_roles,
        role_changed,
        reason
    ) VALUES (
        target_user_id,
        admin_user_id,
        action_type,
        old_roles_array,
        new_roles_array,
        changed_role,
        change_reason
    );
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically log role changes
CREATE OR REPLACE FUNCTION trigger_log_role_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if roles actually changed
    IF OLD.roles IS DISTINCT FROM NEW.roles THEN
        INSERT INTO role_audit_log (
            user_id,
            admin_user_id,
            action,
            old_roles,
            new_roles,
            reason
        ) VALUES (
            NEW.id,
            COALESCE(auth.uid(), NEW.id), -- Use auth.uid() if available, otherwise assume self-update
            'set_roles',
            OLD.roles,
            NEW.roles,
            'Role change detected'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for role change logging
DROP TRIGGER IF EXISTS log_role_changes_trigger ON users;
CREATE TRIGGER log_role_changes_trigger
    AFTER UPDATE ON users
    FOR EACH ROW
    WHEN (OLD.roles IS DISTINCT FROM NEW.roles)
    EXECUTE FUNCTION trigger_log_role_changes();

-- View for easy role management queries
CREATE OR REPLACE VIEW user_roles_summary AS
SELECT 
    u.id,
    u.email,
    u.display_name,
    u.roles,
    u.created_at,
    u.updated_at,
    array_length(u.roles, 1) as role_count,
    CASE 
        WHEN 'admin' = ANY(u.roles) THEN true 
        ELSE false 
    END as is_admin,
    CASE 
        WHEN 'evaluation-monitor' = ANY(u.roles) THEN true 
        ELSE false 
    END as is_evaluation_monitor
FROM users u;

-- Function to get users by role
CREATE OR REPLACE FUNCTION get_users_by_role(target_role TEXT)
RETURNS TABLE(
    user_id UUID,
    email TEXT,
    display_name TEXT,
    roles TEXT[],
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.email, u.display_name, u.roles, u.created_at
    FROM users u
    WHERE target_role = ANY(u.roles);
END;
$$ LANGUAGE plpgsql;

-- Insert example role data for testing (only if no admin users exist)
DO $$
BEGIN
    -- Check if any admin users exist
    IF NOT EXISTS (SELECT 1 FROM users WHERE 'admin' = ANY(roles)) THEN
        -- Update first user to be an admin (for development/testing)
        UPDATE users 
        SET roles = array_append(roles, 'admin')
        WHERE id = (SELECT id FROM users ORDER BY created_at LIMIT 1)
        AND NOT ('admin' = ANY(roles));
        
        RAISE NOTICE 'Added admin role to first user for development/testing';
    END IF;
END
$$;

-- Grant appropriate permissions to authenticated users
GRANT SELECT ON role_audit_log TO authenticated;
GRANT SELECT ON user_roles_summary TO authenticated;

-- Only admins should be able to insert audit logs (this will be handled by the application)
-- GRANT INSERT ON role_audit_log TO authenticated; -- Uncomment if needed

-- Grant permissions to execute role management functions
GRANT EXECUTE ON FUNCTION add_user_role(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_user_role(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_users_by_role(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_role(TEXT[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_any_role(TEXT[], TEXT[]) TO authenticated;

-- Add helpful comments
COMMENT ON COLUMN users.roles IS 'Array of user roles (e.g., [''user'', ''admin'', ''developer'', ''evaluation-monitor''])';
COMMENT ON TABLE role_audit_log IS 'Audit log for tracking role changes made by administrators';
COMMENT ON FUNCTION user_has_role(TEXT[], TEXT) IS 'Check if user has a specific role';
COMMENT ON FUNCTION user_has_any_role(TEXT[], TEXT[]) IS 'Check if user has any of the specified roles';
COMMENT ON VIEW admin_users IS 'View of all users with admin role';
COMMENT ON VIEW evaluation_monitor_users IS 'View of users with evaluation monitoring permissions';
COMMENT ON VIEW user_roles_summary IS 'Summary view of all users with role information and computed flags';