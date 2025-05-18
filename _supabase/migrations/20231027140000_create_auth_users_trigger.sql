-- supabase/migrations/20231027140000_create_auth_users_trigger.sql

-- Helper function public.handle_new_user() should already exist from the previous migration.
-- This migration attempts to create the trigger on auth.users.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'on_auth_user_created' AND
              tgrelid = 'auth.users'::regclass
    )
    THEN
        CREATE TRIGGER on_auth_user_created
            AFTER INSERT ON auth.users
            FOR EACH ROW
            EXECUTE FUNCTION public.handle_new_user();
        RAISE NOTICE 'Trigger on_auth_user_created created on auth.users.';
    ELSE
        RAISE NOTICE 'Trigger on_auth_user_created on auth.users already exists. Skipping.';
    END IF;
END;
$$;

-- Verification Note:
-- After applying this migration, it's still good practice to verify in the Supabase Dashboard
-- (Database > Triggers) that the trigger 'on_auth_user_created' is present on the 'auth.users' table
-- and is active, pointing to 'public.handle_new_user'. 