-- System settings store and global model config accessor

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- Key/value JSONB settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.system_settings IS 'System-wide settings (key/value JSON). Used for global model configuration and feature flags.';

-- Function to fetch the global model configuration
CREATE OR REPLACE FUNCTION public.get_global_model_config()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT value FROM public.system_settings WHERE key = 'model_config_global';
$$;

GRANT ALL ON TABLE public.system_settings TO anon;
GRANT ALL ON TABLE public.system_settings TO authenticated;
GRANT ALL ON TABLE public.system_settings TO service_role;

GRANT EXECUTE ON FUNCTION public.get_global_model_config() TO anon;
GRANT EXECUTE ON FUNCTION public.get_global_model_config() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_global_model_config() TO service_role;

