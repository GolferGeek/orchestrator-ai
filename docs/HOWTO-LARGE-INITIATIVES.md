### Large Initiatives: PRD → Taskmaster → Archive (Quick HOWTO)

Use this for large tasks (>2 days, cross-cutting, or multi-person).

#### 1) Kickoff (creates or reuses a PRD; optionally auto-runs Taskmaster steps)
```bash
# Typical two-step flow:
npm run initiative:kickoff -- <slug> --title "Title"
# Fill docs/prd/active/<slug>.md with the LLM
npm run initiative:kickoff -- <slug> --title "Title" --auto

# Notes:
# - If the PRD file already exists, kickoff will reuse it.
# - --auto validates there are no placeholders like <...> or TODO before proceeding.
# - Use --force-auto to bypass the check (not recommended).
```

#### 2) Create isolated tag and parse PRD → Taskmaster
```bash
task-master add-tag <slug> --description "Large initiative: <Title>"
task-master use-tag <slug>
task-master parse-prd docs/prd/active/<slug>.md --tag <slug> --force
```

#### 3) Plan refinement
```bash
task-master analyze-complexity --tag <slug> --threshold 6
task-master expand --tag <slug>
task-master generate --tag <slug>
```

#### 4) Execute and track
```bash
task-master next --tag <slug>
task-master set-status --id=<id> --status=in-progress --tag <slug>
task-master set-status --id=<id> --status=done --tag <slug>
```

#### 5) Finalize and archive (last commit for the initiative)
```bash
npm run initiative:archive -- <slug>
# This snapshots PRD, tasks.json, generated markdown, and complexity report into docs/prd/history/<date>-<slug>/
# It also removes the active PRD and retires the tag (use --keep-tag to retain it)
```

#### Locations
- Template: `docs/prd/templates/prd-template.md`
- Active PRDs: `docs/prd/active/`
- Archive: `docs/prd/history/<YYYYMMDD>-<slug>/`

#### PR checklist (for large tasks)
- PRD completed using the template
- Parsed to Taskmaster with a dedicated tag
- Complexity analyzed / expanded as needed
- Acceptance criteria met
- Final archive prepared (PRD + tasks snapshot + generated markdown + complexity report)

See detailed guide: `docs/prd/README.md`


