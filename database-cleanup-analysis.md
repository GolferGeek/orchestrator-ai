# Database Cleanup Analysis

## Expected Tables (from migration files)

Based on the main migration `20250812000001_orchestrator_ai_complete.sql` and incremental migration `20250815000001_add_deliverable_task_linking.sql`, these tables SHOULD exist:

### Public Schema Tables:
1. `users` - Core user management with full profile support
2. `llm_providers` - AI service provider configurations  
3. `llm_models` - AI model specifications and capabilities
4. `cidafm_commands` - Command interface definitions and function modifiers
5. `agent_conversations` - Core conversation management with work product binding
6. `tasks` - Individual task execution and tracking with comprehensive metadata
7. `projects` - Multi-step project orchestration with hierarchical task management
8. `deliverables` - Work products and outputs with versioning (includes task_id column from incremental migration)

### Company Schema Tables:
1. `companies` - Basic company information
2. `departments` - Organizational structure
3. `kpi_metrics` - Key performance indicator definitions
4. `kpi_goals` - Target values for metrics
5. `kpi_data` - Historical performance data

### Views:
1. `agent_conversations_with_stats` - Agent conversations with task statistics

### Functions:
1. `update_updated_at_column()` - Trigger function for timestamp updates
2. `exec_sql()` - SQL execution function for dynamic queries
3. `search_deliverables()` - Search function for deliverables

## Common Unwanted Tables (Manual Verification Required)

These are commonly created tables that might exist but are NOT in our intended schema:

### Potential Supabase System Tables (usually safe to keep):
- `auth.*` tables - Authentication system
- `storage.*` tables - File storage system  
- `realtime.*` tables - Real-time subscriptions
- `extensions.*` tables - PostgreSQL extensions
- `information_schema.*` - Database metadata
- `pg_*` tables - PostgreSQL system tables

### Potential Development/Migration Artifacts:
- Old migration tracking tables
- Temporary tables (names starting with `tmp_`, `temp_`, etc.)
- Backup tables (names ending with `_backup`, `_old`, etc.)
- Test tables (names starting with `test_`, etc.)

## Next Steps

1. **Manual Database Inspection Required**: Connect to Supabase and run:
   ```sql
   SELECT schemaname, tablename 
   FROM pg_tables 
   WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'auth', 'storage', 'realtime', 'extensions', 'graphql', 'graphql_public', 'net', 'pgsodium', 'pgsodium_masks', 'vault')
   ORDER BY schemaname, tablename;
   ```

2. **Compare Results**: Compare the actual table list with the expected tables above

3. **Create Drop Script**: For any tables not in the expected list, add them to the drop script below