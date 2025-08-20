### Purpose
Standardize large initiatives using a strict flow: PRD → Taskmaster plan → execution → archive.

### When required
Use this for “large tasks”:
- Estimated > 2 engineering days, or
- Cross-cutting (schema/infra/auth/billing/major UX), or
- Multi-person/coordination heavy.

### Directory layout
- `docs/prd/templates/prd-template.md` — single source of truth template
- `docs/prd/active/` — in-progress PRDs
- `docs/prd/history/<YYYYMMDD>-<slug>/` — archived PRDs + Taskmaster exports

### Naming
- `<slug>`: kebab-case, short, descriptive (e.g., `project-steps-v1`).

### End-to-end flow
1) Create a PRD:
- Copy the template to `docs/prd/active/<slug>.md` and fill it completely, or run:
```bash
npm run initiative:kickoff -- <slug> --title "Title"
# Optional auto mode (will validate PRD for placeholders):
npm run initiative:kickoff -- <slug> --title "Title" --auto
```

2) Create an isolated Taskmaster tag for this initiative:
```bash
task-master add-tag <slug> --description "Large initiative: <title>"
task-master use-tag <slug>
```

3) Parse PRD → Taskmaster:
```bash
task-master parse-prd docs/prd/active/<slug>.md --tag <slug> --force
task-master analyze-complexity --tag <slug> --threshold 6
task-master expand --tag <slug>
task-master generate --tag <slug>
```

4) Work and track:
```bash
task-master next --tag <slug>
task-master set-status --id=<id> --status=in-progress --tag <slug>
task-master set-status --id=<id> --status=done --tag <slug>
```

5) Finalization & archive (last commit of the initiative):
```bash
ARCHIVE=docs/prd/history/$(date +"%Y%m%d")-<slug>
mkdir -p "$ARCHIVE"
cp docs/prd/active/<slug>.md "$ARCHIVE/PRD.md"
cp .taskmaster/tasks/tasks.json "$ARCHIVE/tasks.json"
task-master generate --tag <slug> --output "$ARCHIVE/tasks"
task-master complexity-report --tag <slug> --file "$ARCHIVE/complexity-report.json"

# Optional cleanup
git rm docs/prd/active/<slug>.md
# Optional: retire tag (or keep for audit)
task-master delete-tag <slug> --yes

git add "$ARCHIVE" docs/prd/active || true
git commit -m "chore(archive): finalize and archive <slug> PRD and Taskmaster artifacts"
git push
```

### Intern LLM kickoff prompt
Use this prompt to create the PRD with Cursor/Claude:
```
You are helping me produce a PRD for a large task using the provided template.
- Fill every section concisely and actionably.
- Ask targeted questions only if information is missing or ambiguous; otherwise make reasonable defaults and list them under Assumptions.
- Ensure deliverables and acceptance criteria are testable.
- Produce the final result ready for Taskmaster parsing.
```

### Small tasks
Skip PRD. Add a 3–5 bullet mini-brief in the PR description with goal, scope, acceptance criteria, and risks.

### Enforcement
Use the PR template checklist. Optional future step: CI can require a PRD link + Taskmaster tag for PRs labeled “large”.


