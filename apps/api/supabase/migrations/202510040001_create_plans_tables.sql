-- Migration: Create plans and plan_versions tables
-- Date: 2025-10-04
-- Description: Creates plans and plan_versions tables with identical structure to deliverables
-- Drops old conversation_plan table and replaces with new versioned architecture

-- Drop old conversation_plan and conversation_plans tables if they exist
DROP TABLE IF EXISTS conversation_plan CASCADE;
DROP TABLE IF EXISTS public.conversation_plans CASCADE;

-- Create plans table (mirrors deliverables structure)
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  namespace TEXT NOT NULL,
  title TEXT NOT NULL,
  current_version_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- One plan per conversation constraint
  CONSTRAINT unique_conversation_plan UNIQUE (conversation_id)
);

-- Create plan_versions table (mirrors deliverable_versions structure)
CREATE TABLE IF NOT EXISTS plan_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'markdown' CHECK (format IN ('markdown', 'json', 'text')),
  created_by_type TEXT NOT NULL CHECK (created_by_type IN ('agent', 'user')),
  created_by_id UUID,
  task_id UUID,
  metadata JSONB DEFAULT '{}',
  is_current_version BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique constraint on plan_id + version_number
  CONSTRAINT unique_plan_version UNIQUE (plan_id, version_number)
);

-- Add foreign key from plans to plan_versions for current_version_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_plans_current_version' 
    AND table_name = 'plans'
  ) THEN
    ALTER TABLE plans
      ADD CONSTRAINT fk_plans_current_version
      FOREIGN KEY (current_version_id)
      REFERENCES plan_versions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_plans_conversation_id ON plans(conversation_id);
CREATE INDEX IF NOT EXISTS idx_plans_user_id ON plans(user_id);
CREATE INDEX IF NOT EXISTS idx_plan_versions_plan_id ON plan_versions(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_versions_is_current ON plan_versions(is_current_version) WHERE is_current_version = true;
CREATE INDEX IF NOT EXISTS idx_plan_versions_task_id ON plan_versions(task_id) WHERE task_id IS NOT NULL;

-- Create updated_at trigger for plans table
CREATE OR REPLACE FUNCTION update_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_plans_updated_at ON plans;
CREATE TRIGGER trigger_plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW
  EXECUTE FUNCTION update_plans_updated_at();

-- Add RLS policies (mirroring deliverables)
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_versions ENABLE ROW LEVEL SECURITY;

-- Plans policies: users can only access their own plans
DROP POLICY IF EXISTS plans_select_policy ON plans;
CREATE POLICY plans_select_policy ON plans
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS plans_insert_policy ON plans;
CREATE POLICY plans_insert_policy ON plans
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS plans_update_policy ON plans;
CREATE POLICY plans_update_policy ON plans
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS plans_delete_policy ON plans;
CREATE POLICY plans_delete_policy ON plans
  FOR DELETE
  USING (auth.uid() = user_id);

-- Plan versions policies: users can access versions of their plans
DROP POLICY IF EXISTS plan_versions_select_policy ON plan_versions;
CREATE POLICY plan_versions_select_policy ON plan_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plans
      WHERE plans.id = plan_versions.plan_id
      AND plans.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS plan_versions_insert_policy ON plan_versions;
CREATE POLICY plan_versions_insert_policy ON plan_versions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM plans
      WHERE plans.id = plan_versions.plan_id
      AND plans.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS plan_versions_update_policy ON plan_versions;
CREATE POLICY plan_versions_update_policy ON plan_versions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM plans
      WHERE plans.id = plan_versions.plan_id
      AND plans.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS plan_versions_delete_policy ON plan_versions;
CREATE POLICY plan_versions_delete_policy ON plan_versions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM plans
      WHERE plans.id = plan_versions.plan_id
      AND plans.user_id = auth.uid()
    )
  );

-- Add comments for documentation
COMMENT ON TABLE plans IS 'Stores plan metadata for agent2agent conversations. One plan per conversation with versioned content.';
COMMENT ON TABLE plan_versions IS 'Stores immutable versions of plans. Each edit/refinement creates a new version.';
COMMENT ON COLUMN plans.current_version_id IS 'Points to the currently active version of this plan';
COMMENT ON COLUMN plan_versions.created_by_type IS 'Whether this version was created by an agent or manually edited by a user';
COMMENT ON COLUMN plan_versions.task_id IS 'Reference to the agent task that created this version (if applicable)';
COMMENT ON COLUMN plan_versions.metadata IS 'Additional metadata like LLM model used, merge source versions, etc.';
