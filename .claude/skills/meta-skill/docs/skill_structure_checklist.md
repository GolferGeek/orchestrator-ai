# Skill Structure Checklist

> Quick reference for creating skills with multiple file types, aligned with the Claude Code Development Ecosystem PRD.

## Quick Reference

When creating any of the 12 skills mentioned in the PRD, use this checklist:

### ✅ Required Files

- [ ] `SKILL.md` - Main instructions with YAML frontmatter
  - [ ] `name` field (max 64 chars)
  - [ ] `description` field (max 1024 chars, includes trigger keywords)
  - [ ] `allowed-tools` (if restricting tool access)

### ✅ Recommended Structure (Choose Based on Skill Type)

#### For All Skills:
- [ ] `REFERENCE.md` - Detailed API/command reference
- [ ] `EXAMPLES.md` - Usage examples and patterns
- [ ] `TROUBLESHOOTING.md` - Common issues and solutions

#### For Development Skills (N8N, LangGraph, API Agents):
- [ ] `PATTERNS.md` - Design patterns and conventions
- [ ] `ARCHITECTURE.md` - Architecture guidelines
- [ ] `templates/` - Code/workflow templates
  - [ ] `workflow.yaml` - Workflow template
  - [ ] `agent-config.yaml` - Agent configuration template
- [ ] `scripts/` - Utility scripts
  - [ ] `validate.sh` - Validation script
  - [ ] `test.sh` - Testing script

#### For Database Skills (Supabase):
- [ ] `STORAGE_SYSTEM.md` - Storage-based sync system docs
- [ ] `COMMANDS.md` - Command reference
- [ ] `scripts/` - Storage script wrappers
  - [ ] `export-snapshot.sh` - Snapshot export
  - [ ] `apply-snapshot.sh` - Snapshot apply
  - [ ] `validate-migration.py` - Migration validation
- [ ] `templates/` - SQL templates
  - [ ] `migration-template.sql` - Migration template
- [ ] `config/` - Configuration
  - [ ] `storage-paths.yaml` - Storage path configuration

#### For Quality Gate Skills:
- [ ] `STANDARDS.md` - Quality standards and rules
- [ ] `WORKFLOW.md` - Quality gate workflow
- [ ] `scripts/` - Quality scripts
  - [ ] `lint.sh` - Lint runner
  - [ ] `build.sh` - Build runner
  - [ ] `test.sh` - Test runner
  - [ ] `fix-lint.py` - Auto-fix script
- [ ] `config/` - Configuration
  - [ ] `lint-rules.yaml` - Lint rules configuration

#### For Coding Skills (Front-end, Back-end):
- [ ] `PATTERNS.md` - Code patterns and conventions
- [ ] `ARCHITECTURE.md` - Architecture guidelines
- [ ] `TRANSPORT_TYPES.md` - Transport type usage
- [ ] `templates/` - Code templates
  - [ ] `component.vue` - Vue component template
  - [ ] `module.ts` - NestJS module template
  - [ ] `service.ts` - Service template
- [ ] `scripts/` - Scaffolding scripts
  - [ ] `scaffold.sh` - Component/module generator

#### For Git Skills:
- [ ] `WORKFLOWS.md` - Git workflow documentation
- [ ] `COMMITS.md` - Commit message standards
- [ ] `BRANCHES.md` - Branch naming conventions
- [ ] `scripts/` - Git utilities
  - [ ] `validate-commit.sh` - Commit validation
  - [ ] `create-pr.sh` - PR creation script

## File Type Guidelines

### Markdown (`.md`, `.mdx`)
- Use for: Documentation, instructions, examples
- Structure: Clear headings, code blocks, links to other files

### YAML/JSON (`.yaml`, `.yml`, `.json`)
- Use for: Configuration, schemas, structured data
- Location: `config/` directory

### Shell Scripts (`.sh`)
- Use for: System operations, file manipulation, command execution
- Location: `scripts/` directory
- Make executable: `chmod +x scripts/*.sh`

### Python Scripts (`.py`)
- Use for: Data processing, API calls, complex logic
- Location: `scripts/` directory
- Include PEP 723 inline dependencies
- Make executable: `chmod +x scripts/*.py`

### TypeScript/JavaScript (`.ts`, `.js`)
- Use for: Node.js utilities, type-safe operations, validation
- Location: `scripts/` directory

### SQL Files (`.sql`)
- Use for: Database queries, migrations, schema definitions
- Location: `queries/` or `templates/` directory

## Skill-Specific Checklist

### 1. Supabase Management Skill (CRITICAL) ⚠️
- [ ] Prevents direct Supabase operations
- [ ] Enforces storage-based sync system
- [ ] Includes all 10 command workflows
- [ ] Storage script wrappers
- [ ] Migration validation

### 2. Quality Gates Skill
- [ ] Lint/build/test workflows
- [ ] Auto-fix capabilities (up to 3 attempts)
- [ ] Blocks commits/PRs when failing
- [ ] Quality standards documentation

### 3. API Agent Development Skill
- [ ] YAML structure patterns
- [ ] Request/response transforms
- [ ] A2A protocol compliance
- [ ] Wrapping workflows (N8N, LangGraph, CrewAI)

### 4. N8N Development Skill
- [ ] Helper LLM pattern (ID: `9jxl03jCcqg17oOy`)
- [ ] Webhook status system
- [ ] MCP integration patterns
- [ ] Workflow templates

### 5. LangGraph Development Skill
- [ ] State machine patterns
- [ ] Webhook streaming
- [ ] Workflow templates
- [ ] Integration patterns

### 6. Front-End Structure Skill
- [ ] Vue 3 patterns
- [ ] Pinia store patterns
- [ ] Transport types usage
- [ ] Component templates

### 7. Back-End Structure Skill
- [ ] NestJS patterns
- [ ] Module/service/controller structure
- [ ] Transport types usage
- [ ] A2A protocol compliance

### 8. GitHub Workflow Skill
- [ ] PR workflows
- [ ] Review processes
- [ ] Merge strategies
- [ ] Automation scripts

### 9. Worktree Lifecycle Skill
- [ ] Creation workflows
- [ ] Management operations
- [ ] Cleanup procedures
- [ ] Port management

### 10. Orchestrator Git Standards Skill
- [ ] Git conventions
- [ ] Branch strategies
- [ ] Commit standards
- [ ] Workflow documentation

### 11. Conventional Commits Skill
- [ ] Commit message format
- [ ] Type guidelines
- [ ] Scope conventions
- [ ] Examples and templates

### 12. CrewAI Development Skill (FUTURE)
- [ ] CrewAI patterns
- [ ] Agent composition
- [ ] Workflow templates
- [ ] Integration patterns

## Quality Checklist

Before considering a skill complete:

- [ ] All scripts are executable (`chmod +x`)
- [ ] All files referenced in SKILL.md exist
- [ ] File paths use relative references from skill root
- [ ] Progressive disclosure is used (main workflow in SKILL.md, details in other files)
- [ ] Examples cover common use cases
- [ ] Troubleshooting covers known issues
- [ ] Description includes trigger keywords
- [ ] Scripts include error handling
- [ ] Configuration files are documented
- [ ] Templates are tested and work

## Testing Checklist

- [ ] Skill loads when trigger keywords are used
- [ ] All referenced files can be accessed
- [ ] Scripts execute successfully
- [ ] Examples demonstrate correct usage
- [ ] Troubleshooting solves known issues
- [ ] Multiple skills can load simultaneously (skills stack)
- [ ] Skills can reference each other (cross-references)

## Summary

**Remember:**
1. ✅ Use multiple file types - Match file type to purpose
2. ✅ Organize by concern - Separate documentation, scripts, templates
3. ✅ Progressive disclosure - Load only what's needed
4. ✅ Reference files - Link instead of duplicating
5. ✅ Make scripts executable - Enable direct execution
6. ✅ Document purposes - Explain file relationships

For complete guidance, see [multi_file_skill_patterns.md](multi_file_skill_patterns.md).

