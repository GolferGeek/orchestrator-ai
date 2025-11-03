# Supabase Management Troubleshooting

Common issues and solutions for Supabase management operations in Orchestrator AI.

## Common Issues

### Issue: "Snapshot directory not found"

**Symptoms:**
```
❌ Error: Snapshot directory not found: storage/snapshots/latest/
```

**Solutions:**
1. Check if snapshot exists: `ls -la storage/snapshots/`
2. Export a new snapshot: `npm run db:export-snapshot`
3. Use specific snapshot path: `bash storage/scripts/apply-snapshot.sh storage/snapshots/<timestamp>/`

### Issue: "Schema.sql not found in snapshot"

**Symptoms:**
```
❌ Error: schema.sql not found in snapshot
```

**Solutions:**
1. Verify snapshot was exported correctly
2. Re-export snapshot: `npm run db:export-snapshot`
3. Check snapshot directory contents: `ls -la storage/snapshots/latest/`

### Issue: "Agent not found" when exporting

**Symptoms:**
```
❌ Error: Agent 'agent-name' not found
```

**Solutions:**
1. List all agents: Check database `public.agents` table
2. Verify agent slug (use exact slug, not display name)
3. Check agent is in correct organization

### Issue: "Workflow not found" when exporting N8N

**Symptoms:**
```
❌ Error: Workflow 'workflow-name' not found
```

**Solutions:**
1. List all workflows: Check `n8n.workflow_entity` table
2. Use exact workflow name (case-sensitive)
3. Check quotes around workflow name: `npm run db:export-n8n "Helper: LLM Task"`

### Issue: "Database connection failed"

**Symptoms:**
```
❌ Error: connection to database failed
```

**Solutions:**
1. Verify Docker containers are running: `docker ps | grep supabase`
2. Check container name: Should be `supabase_db_api-dev`
3. Verify port: Should be `7012` for Supabase, `7013` for N8N
4. Check database is accessible: `docker exec -it supabase_db_api-dev psql -U postgres -d postgres -c "SELECT 1;"`

### Issue: "Permission denied" when running scripts

**Symptoms:**
```
❌ Permission denied: storage/scripts/export-snapshot.sh
```

**Solutions:**
1. Make script executable: `chmod +x storage/scripts/*.sh`
2. Use bash explicitly: `bash storage/scripts/export-snapshot.sh`
3. Check file permissions: `ls -la storage/scripts/`

### Issue: "PGPASSWORD not set"

**Symptoms:**
```
❌ Error: password authentication failed
```

**Solutions:**
1. Scripts should set `PGPASSWORD=postgres` automatically
2. If manual psql needed: `export PGPASSWORD=postgres`
3. Check script sets environment variable

### Issue: "Snapshot apply deleted my data"

**Symptoms:**
- All data in schemas is gone after applying snapshot

**Prevention:**
- Snapshots include warning prompts
- Always backup before applying: `./storage/scripts/backup-all-daily.sh`

**Recovery:**
1. Restore from backup: `./storage/scripts/restore-from-backup.sh supabase <backup-file>`
2. Check backup directory: `ls -la storage/backups/`

### Issue: "Agent import failed - validation error"

**Symptoms:**
```
❌ Error: Agent validation failed
```

**Solutions:**
1. Check JSON format is valid: `jq . storage/snapshots/agents/<agent>.json`
2. Verify required fields: `id`, `slug`, `display_name`, `agent_type`
3. Check organization_slug matches your organization
4. Validate YAML structure if present

### Issue: "N8N workflow import failed"

**Symptoms:**
```
❌ Error: Workflow import failed
```

**Solutions:**
1. Check JSON format: `jq . storage/snapshots/n8n/<workflow>.json`
2. Verify workflow ID is unique
3. Check workflow name doesn't conflict
4. Validate nodes and connections structure

### Issue: "Migration application failed"

**Symptoms:**
```
❌ Error: Migration failed to apply
```

**Solutions:**
1. Check SQL syntax: `cat storage/migrations/proposed/<file>.sql`
2. Verify schema exists before modifying
3. Check for dependencies (other migrations must be applied first)
4. Test migration manually: `docker exec -e PGPASSWORD=postgres supabase_db_api-dev psql -U postgres -d postgres -f <migration-file>`

### Issue: "Backup file not found"

**Symptoms:**
```
❌ Error: Backup file not found
```

**Solutions:**
1. List available backups: `ls -la storage/backups/`
2. Check backup was created: Verify timestamp in filename
3. Use full path: `./storage/scripts/restore-from-backup.sh supabase storage/backups/<exact-filename>.sql.gz`

### Issue: "Sync deleted workflows I didn't want deleted"

**Symptoms:**
- Workflows removed from database after sync

**Prevention:**
- Sync operations delete workflows that don't have JSON files
- Ensure all workflows are exported before sync: `npm run db:export-all-n8n`

**Recovery:**
1. Check if workflow JSON exists: `ls storage/snapshots/n8n/`
2. Import missing workflow: `npm run db:import-n8n <workflow-file>`
3. Restore from backup if needed

## Prevention Best Practices

1. **Always backup before major operations**
   ```bash
   ./storage/scripts/backup-all-daily.sh
   ```

2. **Verify snapshot contents before applying**
   ```bash
   ls -la storage/snapshots/latest/
   cat storage/snapshots/latest/metadata.json
   ```

3. **Test migrations locally before applying**
   ```bash
   docker exec -e PGPASSWORD=postgres supabase_db_api-dev psql -U postgres -d postgres -f storage/migrations/proposed/<file>.sql
   ```

4. **Export before sync operations**
   ```bash
   npm run db:export-all-agents
   npm run db:export-all-n8n
   ```

5. **Use specific paths, not "latest"**
   ```bash
   # Instead of: storage/snapshots/latest/
   # Use: storage/snapshots/2025-01-13-143022/
   ```

## Getting Help

If issues persist:
1. Check script logs for detailed error messages
2. Verify Docker containers are running correctly
3. Check database connection details match configuration
4. Review [storage/scripts/README.md](../../storage/scripts/README.md) for detailed documentation

