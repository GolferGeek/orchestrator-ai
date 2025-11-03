# Multi-File Skill Patterns

> Skills can use multiple file types to organize expertise effectively. This guide shows how to structure skills with diverse file types for maximum clarity and maintainability.

## Key Principle: Use Multiple File Types

**Skills are not limited to markdown files.** Claude Code skills can include any file type that helps organize and present expertise:

- **Markdown** (`.md`, `.mdx`) - Instructions, documentation, examples
- **YAML/JSON** (`.yaml`, `.yml`, `.json`) - Configuration, schemas, data structures
- **Scripts** (`.sh`, `.py`, `.ts`, `.js`) - Executable utilities and automation
- **Templates** (`.txt`, `.md`, `.ts`, `.yaml`) - Reusable code/documentation templates
- **Data** (`.csv`, `.json`, `.sql`) - Reference data, schemas, examples
- **Documentation** (`.md`, `.rst`) - Additional guides and references

## Why Multiple File Types Matter

### 1. **Progressive Disclosure**
Different file types load at different times:
- **Metadata** (YAML frontmatter) - Always loaded
- **Instructions** (SKILL.md) - Loaded when triggered
- **Resources** (scripts, templates, data) - Loaded as needed via filesystem

### 2. **Clear Organization**
Separate concerns into appropriate file types:
- **SKILL.md** - Main workflow and overview
- **REFERENCE.md** - Detailed API/command reference
- **EXAMPLES.md** - Usage examples and patterns
- **TROUBLESHOOTING.md** - Common issues and solutions
- **scripts/** - Executable utilities
- **templates/** - Reusable templates
- **config/** - Configuration schemas

### 3. **Tool-Specific Formatting**
Use file types that best match their purpose:
- **Shell scripts** (`.sh`) - System operations, file manipulation
- **Python scripts** (`.py`) - Data processing, API calls, complex logic
- **TypeScript/JavaScript** (`.ts`, `.js`) - Node.js utilities, validation
- **YAML/JSON** (`.yaml`, `.json`) - Configuration, schemas, structured data
- **SQL** (`.sql`) - Database queries, migrations

## Recommended Skill Structure

### Standard Multi-File Skill Layout

```
skill-name/
├── SKILL.md                    # Main instructions (REQUIRED)
├── REFERENCE.md                 # Detailed reference documentation
├── EXAMPLES.md                  # Usage examples and patterns
├── TROUBLESHOOTING.md           # Common issues and solutions
├── PATTERNS.md                  # Design patterns and best practices
├── config/
│   ├── schema.yaml              # Configuration schema
│   └── defaults.json            # Default configurations
├── scripts/
│   ├── validate.sh              # Validation script
│   ├── process.py                # Python processing utility
│   └── helper.ts                 # TypeScript helper
├── templates/
│   ├── template.md              # Markdown template
│   ├── config.yaml              # Configuration template
│   └── example.ts               # Code template
└── data/
    ├── mappings.json            # Reference data
    └── examples.csv              # Example datasets
```

### Skill Type Variations

#### 1. **Development Skill** (Code Generation)
```
development-skill/
├── SKILL.md
├── PATTERNS.md                  # Code patterns and conventions
├── ARCHITECTURE.md              # Architecture guidelines
├── templates/
│   ├── component.ts             # Component template
│   ├── service.ts                # Service template
│   └── test.spec.ts              # Test template
└── scripts/
    └── scaffold.sh               # Scaffolding script
```

#### 2. **Database Skill** (Data Management)
```
database-skill/
├── SKILL.md
├── SCHEMA.md                    # Schema documentation
├── QUERIES.md                   # Common queries
├── scripts/
│   ├── migrate.sh               # Migration script
│   └── backup.py                 # Backup utility
└── queries/
    ├── common.sql                # SQL queries
    └── examples.sql              # Example queries
```

#### 3. **API Skill** (API Integration)
```
api-skill/
├── SKILL.md
├── ENDPOINTS.md                 # API endpoint reference
├── AUTHENTICATION.md            # Auth patterns
├── config/
│   └── endpoints.yaml           # Endpoint configuration
├── scripts/
│   └── test-api.sh              # API testing script
└── examples/
    └── requests.json             # Example API requests
```

#### 4. **Workflow Skill** (Process Automation)
```
workflow-skill/
├── SKILL.md
├── WORKFLOWS.md                 # Workflow definitions
├── STEPS.md                     # Step-by-step processes
├── templates/
│   └── workflow.yaml            # Workflow template
└── scripts/
    └── execute.sh                # Execution script
```

## File Type Guidelines

### Markdown Files (`.md`, `.mdx`)

**Use for:**
- Main instructions (SKILL.md)
- Documentation and guides
- Examples and tutorials
- Troubleshooting guides

**Structure:**
```markdown
# Section Title

## Subsection

Content with:
- Bullet points
- Code blocks
- Links to other files: [REFERENCE.md](REFERENCE.md)
```

### YAML/JSON Files (`.yaml`, `.yml`, `.json`)

**Use for:**
- Configuration schemas
- Default values
- Structured data
- API specifications

**Example YAML:**
```yaml
# config/schema.yaml
skill:
  name: example-skill
  version: 1.0.0
  options:
    - name: verbose
      type: boolean
      default: false
```

**Example JSON:**
```json
{
  "skill": {
    "name": "example-skill",
    "defaults": {
      "timeout": 30,
      "retries": 3
    }
  }
}
```

### Shell Scripts (`.sh`)

**Use for:**
- System operations
- File manipulation
- Command execution
- Quick utilities

**Example:**
```bash
#!/bin/bash
# scripts/validate.sh

set -euo pipefail

if [ ! -f "$1" ]; then
  echo "Error: File $1 not found"
  exit 1
fi

# Validation logic
echo "Validating $1..."
```

### Python Scripts (`.py`)

**Use for:**
- Data processing
- API calls
- Complex logic
- Cross-platform utilities

**Example with PEP 723 inline dependencies:**
```python
# /// script
# requires-python = ">=3.10"
# dependencies = ["requests", "click"]
# ///

import requests
import click

@click.command()
@click.argument('url')
def fetch(url):
    response = requests.get(url)
    print(response.text)

if __name__ == '__main__':
    fetch()
```

### TypeScript/JavaScript (`.ts`, `.js`)

**Use for:**
- Node.js utilities
- Type-safe operations
- Integration with existing codebase
- Validation logic

**Example:**
```typescript
// scripts/helper.ts
import { readFileSync } from 'fs';

export function validateConfig(path: string): boolean {
  const config = JSON.parse(readFileSync(path, 'utf-8'));
  return config.version !== undefined;
}
```

### SQL Files (`.sql`)

**Use for:**
- Database queries
- Migration scripts
- Schema definitions
- Data examples

**Example:**
```sql
-- queries/common.sql
SELECT * FROM users WHERE status = 'active';

-- queries/create_table.sql
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL
);
```

## Referencing Files in SKILL.md

### Relative Path References

Use relative paths from SKILL.md:

```markdown
## Instructions

For detailed patterns, see [PATTERNS.md](PATTERNS.md).

Run the validation script:
```bash
bash scripts/validate.sh input.txt
```

Load configuration from [config/defaults.json](config/defaults.json):
```json
{
  "timeout": 30
}
```
```

### Executing Scripts

Reference scripts with full path from skill root:

```markdown
## Workflow

1. Run the preprocessing script:
   ```bash
   python scripts/preprocess.py input.csv output.json
   ```

2. Validate the output:
   ```bash
   bash scripts/validate.sh output.json
   ```

3. Process with TypeScript utility:
   ```bash
   npx tsx scripts/transform.ts output.json
   ```
```

## Progressive Disclosure Pattern

Structure files so Claude loads only what's needed:

### Level 1: SKILL.md (Always Loaded When Triggered)
- Overview and quick start
- Main workflow steps
- References to other files

### Level 2: Core Documentation (Loaded When Referenced)
- REFERENCE.md - Detailed API reference
- EXAMPLES.md - Usage examples
- PATTERNS.md - Design patterns

### Level 3: Resources (Loaded As Needed)
- Scripts executed via bash (don't load into context)
- Templates referenced but not loaded
- Data files used by scripts

## Example: Complete Multi-File Skill

### Directory Structure
```
supabase-management-skill/
├── SKILL.md
├── STORAGE_SYSTEM.md
├── COMMANDS.md
├── TROUBLESHOOTING.md
├── config/
│   └── storage-paths.yaml
├── scripts/
│   ├── export-snapshot.sh
│   ├── apply-snapshot.sh
│   └── validate-migration.py
└── templates/
    └── migration-template.sql
```

### SKILL.md
```markdown
---
name: Supabase Management
description: Manage Supabase database using storage-based sync system. Use when working with Supabase, database migrations, snapshots, or storage scripts.
---

# Supabase Management

## Quick Start

**CRITICAL**: All Supabase operations MUST use storage scripts. Never use direct Supabase CLI.

See [STORAGE_SYSTEM.md](STORAGE_SYSTEM.md) for the complete storage-based sync system.

## Commands

See [COMMANDS.md](COMMANDS.md) for all available commands.

## Workflow

1. Export snapshot:
   ```bash
   bash scripts/export-snapshot.sh
   ```

2. Apply snapshot:
   ```bash
   bash scripts/apply-snapshot.sh storage/snapshots/latest.json
   ```

3. Validate migration:
   ```bash
   python scripts/validate-migration.py storage/migrations/new.sql
   ```

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues.
```

### STORAGE_SYSTEM.md
```markdown
# Storage-Based Sync System

## Overview

All Supabase operations must go through the storage system:
- `storage/snapshots/` - Database snapshots
- `storage/migrations/` - Migration files
- `storage/scripts/` - Execution scripts

## Paths

See [config/storage-paths.yaml](config/storage-paths.yaml) for all paths.
```

### scripts/export-snapshot.sh
```bash
#!/bin/bash
# Export Supabase snapshot to storage/snapshots/

set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT="storage/snapshots/snapshot_${TIMESTAMP}.json"

supabase db dump --data-only > "$OUTPUT"
echo "Snapshot exported to $OUTPUT"
```

## Best Practices

### 1. **Separate Concerns**
- Main workflow → SKILL.md
- Detailed reference → REFERENCE.md
- Examples → EXAMPLES.md
- Troubleshooting → TROUBLESHOOTING.md

### 2. **Use Appropriate File Types**
- Markdown for documentation
- YAML/JSON for configuration
- Scripts for execution
- Templates for code generation

### 3. **Reference, Don't Duplicate**
- Link to files instead of copying content
- Use progressive disclosure
- Keep SKILL.md focused

### 4. **Make Scripts Executable**
```bash
chmod +x scripts/*.sh
chmod +x scripts/*.py
```

### 5. **Document File Purposes**
- Add comments in scripts
- Include README in complex directories
- Explain file relationships in SKILL.md

## Skills Stack Together

**Multiple skills can load simultaneously:**

```
User: "Create a new API agent and run quality gates"

→ api-agent-development-skill loads
→ quality-gates-skill loads
→ Both skills guide the workflow
```

**Skills reference each other:**

```markdown
# In api-agent-development-skill/SKILL.md

## Quality Gates

After creating the agent, use the quality-gates-skill to validate:
1. Run lint
2. Run tests
3. Verify build
```

## Summary

**Key Takeaways:**

1. ✅ **Use multiple file types** - Match file type to purpose
2. ✅ **Organize by concern** - Separate documentation, scripts, templates
3. ✅ **Progressive disclosure** - Load only what's needed
4. ✅ **Reference files** - Link instead of duplicating
5. ✅ **Make scripts executable** - Enable direct execution
6. ✅ **Document purposes** - Explain file relationships

**Remember:** Skills are your automated, context-aware documentation system. Multiple file types make them more powerful, organized, and maintainable.

