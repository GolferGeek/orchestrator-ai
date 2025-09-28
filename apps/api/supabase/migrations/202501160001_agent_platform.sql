-- Agent platform base tables

-- Drop legacy filesystem-driven agent tables once we move to database-backed agents
DROP TABLE IF EXISTS public.agent_usage_analytics CASCADE;
DROP TABLE IF EXISTS public.agent_skills CASCADE;
DROP TABLE IF EXISTS public.agent_creation_metrics CASCADE;
DROP TABLE IF EXISTS public.agent_creation_logs CASCADE;
DROP TABLE IF EXISTS public.agent_creation_events CASCADE;
DROP TABLE IF EXISTS public.agent_creation_conversations CASCADE;
DROP TABLE IF EXISTS public.agent_configurations CASCADE;

-- agents table stores metadata, yaml, and derived context/config for runtime
CREATE TABLE IF NOT EXISTS public.agents (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    organization_slug text,
    slug text NOT NULL,
    display_name text NOT NULL,
    description text,
    agent_type text NOT NULL,
    mode_profile text NOT NULL,
    version text,
    status text DEFAULT 'active',
    yaml text NOT NULL,
    agent_card jsonb,
    context jsonb,
    config jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT agents_slug_unique UNIQUE (organization_slug, slug)
);

COMMENT ON TABLE public.agents IS 'Database-backed agent descriptors for the new platform.';
COMMENT ON COLUMN public.agents.organization_slug IS 'Namespace / organization identifier (e.g., demo, my-org).';
COMMENT ON COLUMN public.agents.yaml IS 'Raw YAML/JSON descriptor for auditability.';
COMMENT ON COLUMN public.agents.agent_card IS 'Cached agent card served to clients.';
COMMENT ON COLUMN public.agents.context IS 'System prompt, plan rubric, and reference data.';
COMMENT ON COLUMN public.agents.config IS 'Execution configuration (capabilities, supporting agents, checkpoints, etc.).';

-- organization credentials per org/alias
CREATE TABLE IF NOT EXISTS public.organization_credentials (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    organization_slug text NOT NULL,
    alias text NOT NULL,
    credential_type text NOT NULL,
    encrypted_value bytea NOT NULL,
    encryption_metadata jsonb DEFAULT '{}'::jsonb,
    rotated_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT organization_credentials_alias_unique UNIQUE (organization_slug, alias)
);

COMMENT ON TABLE public.organization_credentials IS 'Encrypted secrets per organization (API keys, service credentials).';

-- conversation plans capture structured plans tied to conversations
CREATE TABLE IF NOT EXISTS public.conversation_plans (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    organization_slug text,
    agent_slug text NOT NULL,
    version integer DEFAULT 1,
    status text DEFAULT 'draft',
    summary text,
    plan_json jsonb NOT NULL,
    created_by uuid,
    approved_by uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.conversation_plans IS 'Structured plans generated during plan mode, linked to conversations.';
COMMENT ON COLUMN public.conversation_plans.plan_json IS 'Plan structure including phases, steps, dependencies, checkpoints.';

-- saved orchestrations act as reusable execution recipes for agents
CREATE TABLE IF NOT EXISTS public.agent_orchestrations (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    organization_slug text,
    agent_slug text NOT NULL,
    slug text NOT NULL,
    display_name text NOT NULL,
    description text,
    status text DEFAULT 'active',
    orchestration_json jsonb NOT NULL,
    prompt_templates jsonb DEFAULT '[]'::jsonb,
    tags text[] DEFAULT ARRAY[]::text[],
    version text,
    created_by uuid,
    updated_by uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT agent_orchestrations_slug_unique UNIQUE (organization_slug, agent_slug, slug)
);

COMMENT ON TABLE public.agent_orchestrations IS 'Reusable orchestration recipes bound to a specific agent.';
COMMENT ON COLUMN public.agent_orchestrations.orchestration_json IS 'Structured orchestration definition (phases, steps, dependencies).';
COMMENT ON COLUMN public.agent_orchestrations.prompt_templates IS 'Prompt templates with parameter metadata required to launch orchestrations.';

-- orchestration runs instantiate execution of approved plans
CREATE TABLE IF NOT EXISTS public.orchestration_runs (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    plan_id uuid REFERENCES public.conversation_plans(id) ON DELETE SET NULL,
    origin_type text DEFAULT 'plan',
    origin_id uuid,
    orchestration_slug text,
    prompt_inputs jsonb DEFAULT '{}'::jsonb,
    organization_slug text,
    status text DEFAULT 'pending',
    current_step_index integer,
    completed_steps jsonb DEFAULT '[]'::jsonb,
    step_state jsonb DEFAULT '{}'::jsonb,
    human_checkpoint_id text,
    metadata jsonb DEFAULT '{}'::jsonb,
    started_at timestamptz DEFAULT now(),
    completed_at timestamptz
);

COMMENT ON TABLE public.orchestration_runs IS 'Live orchestration execution state derived from conversation plans or saved orchestrations.';
COMMENT ON COLUMN public.orchestration_runs.step_state IS 'Per-step status metadata including conversations, deliverables, assignments.';
COMMENT ON COLUMN public.orchestration_runs.origin_type IS 'Execution source (plan, saved_orchestration, ad_hoc).';
COMMENT ON COLUMN public.orchestration_runs.orchestration_slug IS 'Slug of the saved orchestration recipe when origin_type = saved_orchestration.';
COMMENT ON COLUMN public.orchestration_runs.prompt_inputs IS 'Resolved prompt parameter payload provided at orchestration launch.';

-- optional organization reference on users (nullable for legacy accounts)
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS organization_slug text;

CREATE INDEX IF NOT EXISTS idx_agents_org_slug ON public.agents(organization_slug);
CREATE INDEX IF NOT EXISTS idx_agents_slug ON public.agents(slug);
CREATE INDEX IF NOT EXISTS idx_conversation_plans_conversation ON public.conversation_plans(conversation_id);
CREATE INDEX IF NOT EXISTS idx_agent_orchestrations_agent ON public.agent_orchestrations(agent_slug);
CREATE INDEX IF NOT EXISTS idx_agent_orchestrations_org ON public.agent_orchestrations(organization_slug);
CREATE INDEX IF NOT EXISTS idx_orchestration_runs_plan ON public.orchestration_runs(plan_id);
CREATE INDEX IF NOT EXISTS idx_org_credentials_org ON public.organization_credentials(organization_slug);
