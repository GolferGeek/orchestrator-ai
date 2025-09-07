# Database Migration Plan: Remove LLM Provider/Model UUIDs

## Current State Analysis

### Tables to Modify:

1. **`llm_providers`** (public schema)
   - **Current**: `id UUID PRIMARY KEY` + `name VARCHAR(255) UNIQUE NOT NULL`
   - **Target**: `name VARCHAR(255) PRIMARY KEY` (remove `id` column)

2. **`llm_models`** (public schema)  
   - **Current**: `id UUID PRIMARY KEY` + `provider_id UUID REFERENCES llm_providers(id)`
   - **Target**: `name VARCHAR(255) PRIMARY KEY` + `provider_name VARCHAR(255) REFERENCES llm_providers(name)`

3. **`llm_usage`** (public schema)
   - **Current**: Has both UUID foreign keys AND name fields:
     - `provider_id UUID REFERENCES public.llm_providers(id)` ❌ (unused, causing issues)
     - `model_id UUID REFERENCES public.llm_models(id)` ❌ (unused, causing issues)  
     - `provider_name VARCHAR(255) NOT NULL` ✅ (working)
     - `model_name VARCHAR(255) NOT NULL` ✅ (working)
   - **Target**: Remove `provider_id` and `model_id` columns, keep name fields

### Key Insight:
The **name-based system already works** - we just need to **remove the broken UUID foreign keys** that are causing the lookup failures.

## Migration Strategy

### Phase 1: Backup and Preparation
1. **Full database backup** using Supabase dashboard or `pg_dump`
2. **Test environment setup** to validate migration
3. **Document rollback procedure**

### Phase 2: Schema Migration (Safe Order)
1. **Drop foreign key constraints** on `llm_usage` table first (safest)
2. **Drop unused UUID columns** from `llm_usage` (`provider_id`, `model_id`)
3. **Modify `llm_models`** table to use name-based relationships
4. **Modify `llm_providers`** table to use name as primary key
5. **Update indexes** to reflect new structure

### Phase 3: Validation
1. **Verify schema changes** are correct
2. **Test LLM usage tracking** with agent calls
3. **Confirm no UUID references remain**

## Detailed Migration Steps

### Step 1: Backup Database
```sql
-- Via Supabase CLI or dashboard backup feature
-- Or manual pg_dump if direct access available
```

### Step 2: Drop Foreign Key Constraints (Safe)
```sql
-- Remove the problematic foreign key constraints
ALTER TABLE public.llm_usage DROP CONSTRAINT IF EXISTS llm_usage_provider_id_fkey;
ALTER TABLE public.llm_usage DROP CONSTRAINT IF EXISTS llm_usage_model_id_fkey;
```

### Step 3: Drop Unused UUID Columns
```sql
-- Remove the unused UUID columns that are causing issues
ALTER TABLE public.llm_usage DROP COLUMN IF EXISTS provider_id;
ALTER TABLE public.llm_usage DROP COLUMN IF EXISTS model_id;
```

### Step 4: Modify llm_models Table
```sql
-- Add provider_name column if it doesn't exist
ALTER TABLE public.llm_models ADD COLUMN IF NOT EXISTS provider_name VARCHAR(255);

-- Update provider_name from existing provider_id relationships (if any data exists)
UPDATE public.llm_models 
SET provider_name = p.name 
FROM public.llm_providers p 
WHERE llm_models.provider_id = p.id 
AND llm_models.provider_name IS NULL;

-- Drop the old foreign key constraint
ALTER TABLE public.llm_models DROP CONSTRAINT IF EXISTS llm_models_provider_id_fkey;

-- Drop the provider_id column
ALTER TABLE public.llm_models DROP COLUMN IF EXISTS provider_id;

-- Make provider_name NOT NULL and add foreign key to provider name
ALTER TABLE public.llm_models ALTER COLUMN provider_name SET NOT NULL;
ALTER TABLE public.llm_models ADD CONSTRAINT llm_models_provider_name_fkey 
    FOREIGN KEY (provider_name) REFERENCES public.llm_providers(name) ON DELETE CASCADE;

-- Change primary key to name (if data allows)
-- Note: This requires model names to be unique across all providers
-- Alternative: Use composite key (provider_name, model_name)
```

### Step 5: Modify llm_providers Table  
```sql
-- Drop the UUID primary key and make name the primary key
ALTER TABLE public.llm_providers DROP CONSTRAINT llm_providers_pkey;
ALTER TABLE public.llm_providers DROP COLUMN id;
ALTER TABLE public.llm_providers ADD PRIMARY KEY (name);
```

### Step 6: Update Indexes
```sql
-- Update any indexes that referenced the old UUID columns
-- Most indexes in llm_usage already use name fields, so minimal changes needed
```

## Risk Assessment

### Low Risk:
- **Dropping unused UUID columns** from `llm_usage` - these aren't being populated anyway
- **Name fields already work** - the working system stays intact

### Medium Risk:  
- **Changing primary keys** - requires careful handling of existing data
- **Foreign key updates** - need to ensure referential integrity

### Mitigation:
- **Test in staging first** with copy of production data
- **Incremental approach** - drop unused columns first, then modify structure
- **Rollback plan** - full database restore from backup if needed

## Success Criteria

1. ✅ **Agent LLM calls are tracked** without "null model_name" errors
2. ✅ **No UUID foreign key constraints** remain in `llm_usage`
3. ✅ **Name-based relationships work** throughout system
4. ✅ **All existing functionality preserved** 
5. ✅ **Performance maintained** or improved

## Rollback Plan

If migration fails:
1. **Restore from full database backup**
2. **Revert application code changes**
3. **Investigate issues** in staging environment
4. **Retry with fixes**

## Timeline

- **Backup & Preparation**: 30 minutes
- **Schema Migration**: 1-2 hours (depending on data volume)
- **Testing & Validation**: 1 hour
- **Total Estimated Time**: 2-4 hours
