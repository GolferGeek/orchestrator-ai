-- Row Level Security Policies for LLM Evaluation Tables
-- Enable RLS and create policies for secure access to LLM evaluation data

-- Enable RLS on all new tables
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cidafm_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_cidafm_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_usage_stats ENABLE ROW LEVEL SECURITY;

-- Providers policies (read-only for all authenticated users)
CREATE POLICY "Allow authenticated users to read providers"
ON public.providers FOR SELECT
TO authenticated
USING (status = 'active');

-- Models policies (read-only for all authenticated users)
CREATE POLICY "Allow authenticated users to read models"
ON public.models FOR SELECT
TO authenticated
USING (status = 'active');

-- CIDAFM Commands policies (read-only for all authenticated users)
CREATE POLICY "Allow authenticated users to read builtin cidafm commands"
ON public.cidafm_commands FOR SELECT
TO authenticated
USING (is_builtin = true);

-- User CIDAFM Commands policies (users can manage their own custom commands)
CREATE POLICY "Allow users to manage their own cidafm commands"
ON public.user_cidafm_commands FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- User Usage Stats policies (users can read their own stats)
CREATE POLICY "Allow users to read their own usage stats"
ON public.user_usage_stats FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admin policies for managing providers and models
-- Note: These will be used by service role or specific admin users
CREATE POLICY "Allow admin to manage providers"
ON public.providers FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow admin to manage models"
ON public.models FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow admin to manage builtin cidafm commands"
ON public.cidafm_commands FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow admin to read all usage stats"
ON public.user_usage_stats FOR SELECT
TO service_role
USING (true);

-- Function to check if user is admin (for future use)
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- For now, return false. This can be enhanced later with admin role checks
  -- Could check against a user_roles table or specific admin user IDs
  RETURN false;
END;
$$;

-- Grant necessary permissions
GRANT SELECT ON public.providers TO authenticated;
GRANT SELECT ON public.models TO authenticated;
GRANT SELECT ON public.cidafm_commands TO authenticated;
GRANT ALL ON public.user_cidafm_commands TO authenticated;
GRANT SELECT ON public.user_usage_stats TO authenticated;

-- Grant full access to service role for administrative operations
GRANT ALL ON public.providers TO service_role;
GRANT ALL ON public.models TO service_role;
GRANT ALL ON public.cidafm_commands TO service_role;
GRANT ALL ON public.user_cidafm_commands TO service_role;
GRANT ALL ON public.user_usage_stats TO service_role;

-- Ensure sequences can be used by authenticated users
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;