# Database Migration - Quick Reference

## 🎯 Most Common Commands

### Generate New Migration (You)

```bash
./scripts/generate-complete-migration.sh
```

Creates timestamped files:
- `YYYYMMDDHHMMSS_complete_schema.sql`
- `YYYYMMDDHHMMSS_complete_data.sql`
- `YYYYMMDDHHMMSS_MIGRATION_README.md`

### Apply Migration (Your Nephew)

```bash
# Start Supabase
cd apps/api
npx supabase start

# Apply migration (use the timestamp from the filenames)
cd ../..
./scripts/apply-complete-migration.sh 20251013160000
```

### Manual Apply (Alternative)

```bash
# Schema
PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres \
  -f apps/api/supabase/migrations/20251013160000_complete_schema.sql

# Data
PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres \
  -f apps/api/supabase/migrations/20251013160000_complete_data.sql
```

## 🔍 Verification

```bash
# Check table counts
PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres \
  -c "SELECT schemaname, COUNT(*) FROM pg_stat_user_tables WHERE schemaname IN ('public', 'n8n', 'company') GROUP BY schemaname;"

# Check users
PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres \
  -c "SELECT COUNT(*) FROM auth.users;"
```

## 🧹 Reset Database

```bash
# Drop everything and start fresh
PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres << 'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
DROP SCHEMA IF EXISTS n8n CASCADE;
DROP SCHEMA IF EXISTS company CASCADE;
CREATE SCHEMA public;
CREATE SCHEMA n8n;
CREATE SCHEMA company;
SQL

# Then apply migration
./scripts/apply-complete-migration.sh 20251013160000
```

## 📦 What's Included

- ✅ **public** schema - Core tables (agents, conversations, orchestrations)
- ✅ **n8n** schema - n8n workflow engine
- ✅ **company** schema - Companies, departments, KPIs
- ✅ **auth.users** - User authentication data

## 🚨 Important Notes

1. **Order matters**: Schema file BEFORE data file
2. **Fresh install**: These files create everything from scratch
3. **Destructive**: Running will DROP existing schemas
4. **Portable**: Works on any PostgreSQL/Supabase instance

## 📝 File Naming

```
20251013160000_complete_schema.sql
└─┬─────┘ └────┬────┘ └────┬────┘
  │            │            └─ Type (schema or data)
  │            └─ Description
  └─ Timestamp (YYYYMMDDHHmmss)
```

## 🔗 More Info

- Full guide: `scripts/COMPLETE_MIGRATION_GUIDE.md`
- Generated README: `apps/api/supabase/migrations/*_MIGRATION_README.md`

---

**Need help?** Contact the team or check the full guide.



