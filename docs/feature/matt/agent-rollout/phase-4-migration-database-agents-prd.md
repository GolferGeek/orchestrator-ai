# Phase 4: Migrate File-Based Agents to Database

## Overview
Migrate all existing file-based agents (YAML-defined demo agents) to database-backed agents while maintaining backward compatibility and ensuring zero downtime.

## Goals
- Convert all demo agents from YAML files to database records
- Maintain 100% feature parity during migration
- Ensure both systems work simultaneously during transition
- Validate migration with automated tests
- Create repeatable migration process for future agents

## Prerequisites
- ✅ Phase 1 complete (context agents working)
- ✅ Phase 2 complete (conversation-only agents working)
- ✅ Phase 3 complete (API agents working)
- ✅ Agent platform can handle all agent types
- ✅ Both file-based and database systems working independently

## Scope

### In Scope
1. **Agent Inventory & Analysis**
   - Catalog all file-based agents
   - Categorize by type (context, function, orchestrator, etc.)
   - Identify dependencies and hierarchy relationships
   - Document special configurations

2. **Migration Scripts**
   - YAML parser → database record converter
   - Hierarchy preservation
   - Configuration validation
   - Dry-run capability
   - Rollback capability

3. **Agent Categories to Migrate**
   - Simple context agents (blog_post_writer, etc.)
   - Conversation-only agents (HR, etc.)
   - Function agents (already have function_code column)
   - Orchestrators (defer execution, just structure)
   - All demo namespace agents

4. **Testing & Validation**
   - Side-by-side comparison tests
   - Ensure database agents behave identically
   - Verify hierarchy display
   - Validate all execution modes

5. **Data Migration**
   - One-time bulk import
   - Incremental updates if needed
   - Preserve agent slugs and relationships

### Out of Scope
- Removing file-based system (Phase 5)
- Orchestration execution (Phase 6)
- Creating new agents (just migrating existing)
- UI changes (both systems already supported)

## Success Criteria

### Migration Complete When:
1. ✅ All demo agents exist in database with status: active
2. ✅ Database agents produce identical results to file-based agents
3. ✅ Hierarchy relationships preserved
4. ✅ All agent configurations valid
5. ✅ Zero regression in existing functionality
6. ✅ Migration is repeatable and documented

### Quality Gates:
1. ✅ 100% of file-based agents migrated
2. ✅ Automated test suite passes for all migrated agents
3. ✅ Side-by-side comparison shows identical behavior
4. ✅ Manual testing confirms equivalence
5. ✅ Documentation complete

## Agent Inventory

### Demo Agents (File-Based)
Will be cataloged during implementation. Expected categories:

**Context Agents:**
- blog_post_writer ✅ (already in database)
- social_media_post_writer
- email_campaign_writer
- content_strategist
- copywriter
- ... (full list TBD)

**Conversation-Only Agents:**
- hr_agent
- customer_support_agent
- ... (full list TBD)

**Function Agents:**
- image_openai_generator ✅ (already migrated)
- image_google_generator ✅ (already migrated)
- agent_builder_chat ✅ (already migrated)
- ... (full list TBD)

**Orchestrators:**
- hiverarchy_orchestrator
- marketing_orchestrator
- image_orchestrator
- ... (full list TBD)

## Implementation Tasks

### Phase 4.1: Inventory & Planning (2 days)
1. **Create agent inventory script**
   - Scan `apps/api/src/agents/` directory
   - Parse all YAML files
   - Extract metadata: name, type, hierarchy, config
   - Generate inventory report (CSV or JSON)

2. **Categorize agents**
   - By type (context, function, orchestrator, etc.)
   - By complexity (simple, medium, complex)
   - By dependencies (standalone, has children, has parent)
   - Priority order for migration

3. **Document special cases**
   - Agents with unique configurations
   - Complex hierarchy relationships
   - Agents that may need manual adjustment

### Phase 4.2: Migration Scripts (3 days)
4. **Create YAML → Database converter**
   ```typescript
   // apps/api/src/scripts/migrate-agents.ts
   async function migrateAgent(yamlPath: string, dryRun: boolean) {
     // Parse YAML
     // Map to database schema
     // Validate configuration
     // Insert or update database record
     // Log results
   }
   ```

5. **Implement field mappings**
   - YAML `name` → `name`
   - YAML `type` → `agent_type`
   - YAML `config` → `config` (JSONB)
   - YAML `hierarchy` → `yaml` field (preserve for now)
   - YAML `systemPrompt` → `config.systemPrompt`
   - Function code → `function_code` column

6. **Handle hierarchy relationships**
   - Extract `hierarchy.team` (orchestrator)
   - Extract `hierarchy.reportsTo` (team member)
   - Preserve in YAML field for hierarchy building
   - Validate circular references

7. **Add validation logic**
   - Required fields present
   - Valid agent_type
   - Valid execution_profile
   - Config schema validation
   - Function agents have function_code
   - Orchestrators have hierarchy.team

8. **Create rollback script**
   - Delete migrated agents by tag
   - Restore from backup
   - Verify file-based system still works

### Phase 4.3: Dry Run & Testing (2 days)
9. **Run migration in dry-run mode**
   ```bash
   npm run migrate:agents -- --dry-run
   ```
   - Generate migration plan
   - Show what would be created/updated
   - Validate all agents
   - Report any errors

10. **Create comparison tests**
    - Execute same request on file-based agent
    - Execute same request on database agent
    - Compare responses
    - Assert equality

11. **Automated test suite**
    - For each migrated agent:
      - Test basic conversation
      - Test execution modes (if applicable)
      - Test hierarchy display
      - Test configuration loading

### Phase 4.4: Migration Execution (2 days)
12. **Execute migration**
    ```bash
    npm run migrate:agents -- --execute
    ```
    - Backup current database
    - Run migration script
    - Log all creations/updates
    - Tag migrated agents (metadata: `migrated_from: 'file'`)

13. **Verify migration**
    - Count: file agents = database agents
    - Spot-check random agents
    - Verify hierarchy still displays correctly
    - Run automated test suite

14. **Fix any issues**
    - Manual adjustments if needed
    - Re-run migration for specific agents
    - Update migration script with fixes

### Phase 4.5: Validation & Documentation (1 day)
15. **Manual testing**
    - Test each agent category
    - Verify deliverables work
    - Verify conversation history
    - Test edge cases

16. **Document migration process**
    - Migration script usage guide
    - Field mapping documentation
    - Known issues and workarounds
    - Rollback procedure

17. **Create migration report**
    - Agents migrated: X
    - Agents failed: Y (with reasons)
    - Manual adjustments needed: Z
    - Total time: N hours

## Data Model

### Migration Metadata
Add to agent record:
```typescript
{
  metadata: {
    migration: {
      source: 'file',
      migrated_at: '2025-10-10T00:00:00Z',
      migrated_by: 'script',
      original_yaml_path: 'apps/api/src/agents/demo/blog_post_writer.yaml',
      migration_version: 'v1'
    }
  }
}
```

### Migration Log Table (Optional)
```sql
CREATE TABLE agent_migrations (
  id UUID PRIMARY KEY,
  agent_slug TEXT NOT NULL,
  source_type TEXT, -- 'file' | 'manual'
  source_path TEXT,
  status TEXT, -- 'pending' | 'completed' | 'failed'
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Migration Script Design

### Command-Line Interface
```bash
# Dry run - show what would be migrated
npm run migrate:agents -- --dry-run

# Migrate all agents
npm run migrate:agents -- --execute

# Migrate specific agent
npm run migrate:agents -- --agent blog_post_writer --execute

# Migrate by category
npm run migrate:agents -- --type context --execute

# Rollback migration
npm run migrate:agents -- --rollback --tag migration-2025-10-10

# Generate inventory report
npm run migrate:agents -- --inventory --output agents-inventory.json
```

### Migration Algorithm
```typescript
async function migrateAllAgents(options: MigrationOptions) {
  // 1. Load all YAML agents
  const yamlAgents = await loadAllYamlAgents();

  // 2. For each agent
  for (const yamlAgent of yamlAgents) {
    // 3. Check if already exists in database
    const existing = await findAgentBySlug(yamlAgent.slug);

    if (existing && !options.overwrite) {
      log(`Skipping ${yamlAgent.slug} - already exists`);
      continue;
    }

    // 4. Convert YAML to database schema
    const dbRecord = convertYamlToDatabase(yamlAgent);

    // 5. Validate
    const validation = validateAgent(dbRecord);
    if (!validation.valid) {
      log(`Failed validation for ${yamlAgent.slug}: ${validation.errors}`);
      continue;
    }

    // 6. Insert or update (if not dry run)
    if (!options.dryRun) {
      await upsertAgent(dbRecord);
      log(`✅ Migrated ${yamlAgent.slug}`);
    } else {
      log(`[DRY RUN] Would migrate ${yamlAgent.slug}`);
    }
  }

  // 7. Verify hierarchy relationships
  await verifyHierarchy();

  // 8. Generate report
  return generateMigrationReport();
}
```

## Testing Strategy

### Automated Tests
1. **Unit Tests**
   - YAML parser
   - Field mapping logic
   - Validation logic
   - Hierarchy preservation

2. **Integration Tests**
   - Full migration flow
   - Database insertion
   - Rollback functionality

3. **Comparison Tests**
   - For each agent type:
     - Load from file
     - Load from database
     - Execute identical request
     - Assert responses match

### Manual Testing Checklist
- [ ] Run inventory script → verify count matches file count
- [ ] Run dry-run migration → verify plan looks correct
- [ ] Execute migration → verify all agents created
- [ ] Test blog_post_writer (database) → same as file version
- [ ] Test HR agent (database) → same as file version
- [ ] Test image generator (database) → same as file version
- [ ] Test orchestrator hierarchy → displays correctly
- [ ] Create new conversation with database agent → works
- [ ] Verify old file-based agents still work (backward compat)

## Risks & Mitigations

### Risk: Data loss during migration
**Mitigation:** Database backup before migration, dry-run validation, rollback script

### Risk: Configuration incompatibilities
**Mitigation:** Validation before insertion, manual review of complex agents

### Risk: Hierarchy relationships broken
**Mitigation:** Preserve YAML field, test hierarchy display, manual verification

### Risk: Migration script bugs
**Mitigation:** Dry-run mode, incremental migration, extensive testing

### Risk: Production downtime
**Mitigation:** Both systems work simultaneously, migrate in dev first, phased rollout

## Timeline Estimate
- Phase 4.1 (Inventory): 2 days
- Phase 4.2 (Scripts): 3 days
- Phase 4.3 (Testing): 2 days
- Phase 4.4 (Execution): 2 days
- Phase 4.5 (Validation): 1 day
- **Total: 10 days**

## Dependencies
- Phases 1-3 complete ✅
- Database schema supports all agent types ✅
- Agent platform can execute all agent types ✅

## Definition of Done
- [ ] Migration script created and tested
- [ ] Dry-run shows all agents can be migrated
- [ ] Migration executed successfully
- [ ] All demo agents exist in database
- [ ] Automated comparison tests pass
- [ ] Manual testing confirms equivalence
- [ ] Migration documentation complete
- [ ] Rollback procedure tested
- [ ] Migration report generated
- [ ] Code reviewed and merged

## Post-Migration

### Monitoring
- Watch for errors in database agent execution
- Compare metrics: file vs database agent usage
- User feedback on any behavioral changes

### Quick Rollback Plan
If critical issues found:
1. Set database agents to `status: 'archived'`
2. File-based system continues working
3. Fix issues in database agents
4. Re-activate database agents

### Success Metrics
- 0 regressions reported
- Database agent adoption rate
- Performance comparison (should be equal or better)

## Notes
This migration is the foundation for Phase 5 (removing file-based system). Taking time to get it right ensures smooth transition and maintains user trust.

After Phase 4, the system supports BOTH file-based and database agents. Phase 5 will remove file-based support entirely.
