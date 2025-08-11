# Database Migration Files

Generated: 2025-08-11T14:25:46.220Z

## Files in this directory:

- `20250811_142546_clean_database_migration.sql` - Main migration script
- `20250811_142546_rollback_clean_database_migration.sql` - Rollback script  
- `20250811_142546_migration_summary.json` - Migration statistics
- `README.md` - This file

## Usage:

### For Local Supabase:

1. Start local Supabase:
   ```bash
   npm run supabase:start
   ```

2. Run the migration:
   ```bash
   psql "postgresql://postgres:postgres@localhost:54322/postgres" -f 20250811_142546_clean_database_migration.sql
   ```

3. Update your environment:
   ```bash
   export SUPABASE_MODE=local
   npm run dev
   ```

### For Production Database:

⚠️ **CAUTION**: This will replace existing data. Always backup first!

```bash
psql "your-production-connection-string" -f 20250811_142546_clean_database_migration.sql
```

### To Rollback:

```bash
psql "your-connection-string" -f 20250811_142546_rollback_clean_database_migration.sql
```

## Migration Summary:

- **Total Records**: 2281
- **Tables Processed**: 14
- **Successful Tables**: 14

### Table Breakdown:

- **llm_providers**: success (4 records)
- **llm_models**: success (9 records)
- **cidafm_commands**: success (27 records)
- **users**: success (6 records)
- **user_cidafm_commands**: success (0 records)
- **projects**: success (3 records)
- **agent_conversations**: success (71 records)
- **tasks**: success (137 records)
- **deliverables**: success (5 records)
- **project_steps**: success (0 records)
- **langgraph_states**: success (19 records)
- **human_inputs**: success (0 records)
- **kpi_data**: success (1000 records)
- **kpi_goals**: success (1000 records)

## Benefits of SQL Migration vs JSON:

✅ **Version Control Friendly**: Readable diffs  
✅ **Database Agnostic**: Works with any PostgreSQL instance  
✅ **Transaction Safe**: Atomic operations with BEGIN/COMMIT  
✅ **Performance**: Direct SQL is faster than JSON imports  
✅ **Professional**: Standard database migration approach  
✅ **Debugging**: Easy to read and modify SQL statements  

## Integration with Supabase CLI:

You can integrate this with Supabase migrations:

1. Copy the migration file to your Supabase migrations folder:
   ```bash
   cp 20250811_142546_clean_database_migration.sql supabase/migrations/
   ```

2. Run via Supabase CLI:
   ```bash
   supabase db reset --local
   ```
