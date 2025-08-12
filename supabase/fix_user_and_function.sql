-- Create the demo user in auth.users table
-- Note: The encrypted_password is for 'demouser'
INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    instance_id,
    aud,
    role,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
)
VALUES (
    '84ad4ef6-8900-409c-8915-fbf7ec2ab37a',
    'demo.user@playground.com',
    crypt('demouser', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '',
    '',
    '',
    ''
) ON CONFLICT (id) DO NOTHING;

-- Create the user in public.users table to match auth user
INSERT INTO public.users (id, email, created_at, updated_at) 
VALUES ('84ad4ef6-8900-409c-8915-fbf7ec2ab37a', 'demo.user@playground.com', NOW(), NOW()) 
ON CONFLICT (id) DO NOTHING;

-- Create the search_deliverables function
CREATE OR REPLACE FUNCTION public.search_deliverables(
    search_term text DEFAULT NULL,
    filter_type text DEFAULT NULL,
    filter_format text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0
)
RETURNS TABLE (
    id uuid,
    user_id uuid,
    conversation_id uuid,
    type text,
    format text,
    content text,
    metadata jsonb,
    created_at timestamptz,
    updated_at timestamptz,
    version integer,
    is_current boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.user_id,
        d.conversation_id,
        d.type,
        d.format,
        d.content,
        d.metadata,
        d.created_at,
        d.updated_at,
        d.version,
        d.is_current
    FROM public.deliverables d
    WHERE 
        (search_term IS NULL OR d.content ILIKE '%' || search_term || '%')
        AND (filter_type IS NULL OR d.type = filter_type)
        AND (filter_format IS NULL OR d.format = filter_format)
    ORDER BY d.created_at DESC
    LIMIT limit_count
    OFFSET offset_count;
END;
$$;