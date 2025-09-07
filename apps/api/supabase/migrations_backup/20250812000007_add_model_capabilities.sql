-- Add capability and complexity fields to llm_models table
-- This allows the LocalLLMService to intelligently choose models based on:
-- 1. What's currently loaded (via ollama ps)
-- 2. What the task requires (complexity, capabilities)
-- 3. Available system resources

ALTER TABLE llm_models ADD COLUMN IF NOT EXISTS capabilities_json JSONB DEFAULT '{}'::jsonb;
ALTER TABLE llm_models ADD COLUMN IF NOT EXISTS complexity_level TEXT CHECK (complexity_level IN ('simple', 'medium', 'complex', 'reasoning')) DEFAULT 'medium';
ALTER TABLE llm_models ADD COLUMN IF NOT EXISTS thinking_mode BOOLEAN DEFAULT false;
ALTER TABLE llm_models ADD COLUMN IF NOT EXISTS speed_tier TEXT CHECK (speed_tier IN ('ultra-fast', 'fast', 'medium', 'slow')) DEFAULT 'medium';
ALTER TABLE llm_models ADD COLUMN IF NOT EXISTS resource_requirements JSONB DEFAULT '{}'::jsonb;

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_llm_models_complexity ON llm_models(complexity_level);
CREATE INDEX IF NOT EXISTS idx_llm_models_speed_tier ON llm_models(speed_tier);
CREATE INDEX IF NOT EXISTS idx_llm_models_thinking ON llm_models(thinking_mode);
CREATE INDEX IF NOT EXISTS idx_llm_models_local_active ON llm_models(is_local, is_active);

-- Update existing models with capability metadata
-- Ultra-fast tier models
UPDATE llm_models SET 
    complexity_level = 'simple',
    thinking_mode = false,
    speed_tier = 'ultra-fast',
    capabilities_json = '{"tasks": ["chat", "simple_qa", "basic_reasoning"], "strengths": ["speed", "efficiency"]}'::jsonb,
    resource_requirements = '{"min_ram_gb": 4, "optimal_ram_gb": 8, "supports_gpu": true}'::jsonb
WHERE model_name IN ('llama3.2:latest');

-- Balanced tier models  
UPDATE llm_models SET 
    complexity_level = 'medium',
    thinking_mode = false,
    speed_tier = 'fast',
    capabilities_json = '{"tasks": ["chat", "qa", "reasoning", "analysis"], "strengths": ["balance", "versatility"]}'::jsonb,
    resource_requirements = '{"min_ram_gb": 8, "optimal_ram_gb": 16, "supports_gpu": true}'::jsonb
WHERE model_name IN ('qwen3:8b');

-- High-quality reasoning models
UPDATE llm_models SET 
    complexity_level = 'complex',
    thinking_mode = true,
    speed_tier = 'medium',
    capabilities_json = '{"tasks": ["reasoning", "analysis", "complex_qa", "problem_solving"], "strengths": ["reasoning", "accuracy", "thinking"]}'::jsonb,
    resource_requirements = '{"min_ram_gb": 16, "optimal_ram_gb": 32, "supports_gpu": true}'::jsonb
WHERE model_name IN ('qwq:latest');

-- Large reasoning models
UPDATE llm_models SET 
    complexity_level = 'reasoning',
    thinking_mode = true,
    speed_tier = 'slow',
    capabilities_json = '{"tasks": ["complex_reasoning", "research", "analysis", "expert_qa"], "strengths": ["intelligence", "reasoning", "accuracy"]}'::jsonb,
    resource_requirements = '{"min_ram_gb": 32, "optimal_ram_gb": 64, "supports_gpu": true}'::jsonb
WHERE model_name IN ('gpt-oss:20b', 'deepseek-r1:70b');

-- Code-specialized models
UPDATE llm_models SET 
    complexity_level = 'medium',
    thinking_mode = false,
    speed_tier = 'fast',
    capabilities_json = '{"tasks": ["coding", "debugging", "code_review", "programming"], "strengths": ["code_generation", "programming"]}'::jsonb,
    resource_requirements = '{"min_ram_gb": 8, "optimal_ram_gb": 16, "supports_gpu": true}'::jsonb
WHERE model_name IN ('codellama:latest');

-- General purpose models
UPDATE llm_models SET 
    complexity_level = 'medium',
    thinking_mode = false,
    speed_tier = 'medium',
    capabilities_json = '{"tasks": ["chat", "qa", "general"], "strengths": ["reliability", "general_purpose"]}'::jsonb,
    resource_requirements = '{"min_ram_gb": 8, "optimal_ram_gb": 16, "supports_gpu": true}'::jsonb
WHERE model_name IN ('llama2:latest', 'mistral:latest', 'deepseek-r1:latest');

-- Add comment explaining the schema
COMMENT ON COLUMN llm_models.complexity_level IS 'Model capability level: simple (basic tasks), medium (general purpose), complex (advanced reasoning), reasoning (expert-level thinking)';
COMMENT ON COLUMN llm_models.thinking_mode IS 'Whether model shows explicit thinking/reasoning process';
COMMENT ON COLUMN llm_models.speed_tier IS 'Response speed category: ultra-fast, fast, medium, slow';
COMMENT ON COLUMN llm_models.capabilities_json IS 'JSON object describing model capabilities, tasks, and strengths';
COMMENT ON COLUMN llm_models.resource_requirements IS 'JSON object with minimum and optimal resource requirements';
