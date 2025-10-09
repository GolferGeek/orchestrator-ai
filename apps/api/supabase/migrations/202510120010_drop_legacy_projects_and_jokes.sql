BEGIN;

-- Drop legacy projects & steps
DROP TABLE IF EXISTS public.project_steps CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;

-- Drop legacy jokes tables
DROP TABLE IF EXISTS public.jokes_analysis CASCADE;
DROP TABLE IF EXISTS public.jokes CASCADE;

COMMIT;
