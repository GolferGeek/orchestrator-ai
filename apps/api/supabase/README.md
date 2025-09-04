# Supabase Database Management

This directory contains all Supabase database configurations and migrations for the Orchestrator AI project.

## Directory Structure

```
apps/api/supabase/
├── .branches/              # Supabase branch configurations
├── .temp/                  # Temporary Supabase files
├── config.toml             # Main Supabase configuration
├── config.toml.root-backup # Backup of root config before consolidation
├── migrations/             # Database migrations
│   ├── incremental/        # Incremental migrations (chronological order)
│   │   ├── 20250103000001_add_local_model_columns.sql
│   │   ├── 20250103000001_three_tier_local_model_configuration.sql
│   │   ├── 20250103000002_three_tier_local_model_system.sql
│   │   ├── 20250103000003_create_llm_usage_tracking.sql
│   │   ├── 20250103000004_add_caller_fields_to_llm_usage.sql
│   │   ├── 20250103000005_update_models_to_current_2025.sql
│   │   ├── 20250103000006_add_model_capabilities.sql
│   │   ├── 20250120000001_flexible_deliverable_conversations.sql
│   │   ├── 20250120000002_fix_deliverable_version_creation_types.sql
│   │   ├── 20250815000001_add_deliverable_task_linking.sql
│   │   ├── 20250816000001_add_project_steps.sql
│   │   ├── 20250816000002_clean_existing_data.sql
│   │   ├── 20250816000003_deliverables_versioning_system.sql
│   │   ├── 20250818000001_cleanup_deliverables_table.sql
│   │   ├── 20250825000001_implement_real_exec_sql.sql
│   │   ├── 20250826000001_create_exec_sql_function.sql
│   │   ├── 20250827000003_clean_existing_data.sql
│   │   ├── 20250829000001_move_company_tables_to_public.sql
│   │   ├── 20250903000001_redaction_and_pseudonym_schema.sql
│   │   ├── 20250903000002_enhanced_llm_usage_tracking.sql
│   │   └── drop-unused-tables.sql
│   ├── 20250101000001_orchestrator_ai_complete.sql.backup  # Main schema backup
│   ├── 20250811000001_sample_environment_complete.sql      # Sample environment
│   ├── 20250811000002_sample_environment_seed_data.sql     # Sample data
│   ├── 20250811000003_production_environment_complete.sql  # Production schema
│   └── 20250811000004_production_environment_seed_data.sql # Production data
└── README.md               # This file
```

## Migration Strategy

### Main Migrations
- **20250101000001_orchestrator_ai_complete.sql.backup**: Complete original schema
- **20250811000001-4**: Environment-specific schemas and seed data

### Incremental Migrations
All incremental migrations are in chronological order and should be applied sequentially:

1. **Model & LLM System** (20250103000001-6): Core model configuration and LLM tracking
2. **Deliverables System** (20250120000001-2): Flexible deliverable conversations
3. **Project Management** (20250815000001, 20250816000001-3): Task linking and project steps
4. **Data Cleanup** (20250818000001, 20250827000003): Table cleanup operations
5. **SQL Functions** (20250825000001, 20250826000001): Custom SQL functions
6. **Schema Migrations** (20250829000001): Table organization
7. **Privacy System** (20250903000001-2): **PII detection, pseudonymization, and enhanced LLM tracking**

### Latest Privacy Features (September 2025)
- **20250903000001_redaction_and_pseudonym_schema.sql**: Complete privacy infrastructure
  - `redaction_patterns` table for custom PII patterns
  - `pseudonym_mappings` table for consistent pseudonym generation
  - `pseudonym_dictionaries` table for pseudonym word lists
  - `audit_logs` table for compliance tracking
  - `sensitive_data_vault` table for encrypted original data storage

- **20250903000002_enhanced_llm_usage_tracking.sql**: Enhanced LLM metrics
  - Extended `llm_usage_metrics` with privacy tracking
  - PII detection counts, pseudonymization metrics, redaction counts
  - Cost analysis, performance tracking, sanitization overhead metrics

## Usage

### Running Migrations
From the `apps/api` directory:

```bash
# Apply all migrations
supabase db reset

# Apply specific migration
supabase migration up --file 20250903000001_redaction_and_pseudonym_schema.sql

# Create new migration
supabase migration new your_migration_name
```

### Development Workflow
1. All database work should be done from `apps/api/supabase/`
2. Frontend should **never** directly access Supabase
3. All database operations go through the NestJS API layer
4. Use incremental migrations for schema changes
5. Test migrations on sample environment before production

### Environment Configuration
- **Development**: Uses local Supabase instance
- **Testing**: Uses `SUPABASE_TEST_USER` and `SUPABASE_TEST_PASSWORD`
- **Production**: Uses environment-specific configuration

## Key Features

### Privacy-First Architecture
- **PII Detection**: Automated detection of personally identifiable information
- **Pseudonymization**: Consistent replacement of PII with pseudonyms
- **Secret Redaction**: Automatic redaction of API keys and sensitive data
- **Audit Trail**: Complete logging of all privacy operations
- **Reversibility**: Encrypted storage of original data for authorized access

### LLM Integration
- **Enhanced Metrics**: Comprehensive tracking of LLM usage and costs
- **Privacy Metrics**: Track sanitization overhead and effectiveness
- **Multi-Provider Support**: OpenAI, Anthropic, Ollama routing
- **Local-First**: Prefer local models when possible for privacy

### API Management
- **CRUD Operations**: Full API for managing PII patterns
- **Testing Endpoints**: Live testing of PII detection and sanitization
- **Statistics**: Usage analytics and performance metrics
- **Access Control**: Role-based access to privacy management features

---

**Note**: This directory was consolidated from the root `supabase/` directory on 2025-09-04 to centralize all database management under the API layer.
