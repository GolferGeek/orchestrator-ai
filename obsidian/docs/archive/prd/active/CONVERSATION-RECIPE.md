### PRD Conversation Recipe (Use this with Cursor/Claude)

This is the stable conversation formula. The PRD format can evolve; always use the current template at `docs/prd/templates/prd-template.md`.

#### 1) Kickoff message to LLM
Paste this and answer questions briefly:
```
I want to create a PRD for a large task. Use the repository's current PRD template at docs/prd/templates/prd-template.md.
- Fill every section concisely and actionably
- Ask only targeted questions to fill gaps; otherwise make reasonable defaults and list them under Assumptions
- Ensure Deliverables and Acceptance Criteria are testable
- Optimize for Taskmaster parsing later (clear goals, scope, API contracts, data model changes)
```

Optional context to add:
- Business goal and constraints
- Existing APIs/services to leverage
- Security/compliance requirements

#### 2) Iteration loop
- Answer the LLM’s targeted questions
- Review each section; push for testable acceptance criteria and measurable success metrics
- Confirm risks and mitigations

Stop when: the PRD has no placeholders (no `<...>` or “TODO”) and every acceptance criterion is testable.

#### 3) Save the PRD
- Create or reuse: `docs/prd/active/<slug>.md`
- If needed, run:
```bash
npm run initiative:kickoff -- <slug> --title "Title"
# then paste the PRD into docs/prd/active/<slug>.md
```

#### 4) Hand-off to Taskmaster
When the PRD is complete:
```bash
npm run initiative:kickoff -- <slug> --title "Title" --auto
```
This will:
- Create/use Taskmaster tag `<slug>`
- Parse PRD
- Analyze complexity (threshold 6 by default)
- Expand tasks
- Generate Markdown files

#### 5) Execution and archival
- Work using `task-master next --tag <slug>`
- On completion: `npm run initiative:archive -- <slug>`

Quick links:
- Template: `docs/prd/templates/prd-template.md`
- How-to: `docs/HOWTO-LARGE-INITIATIVES.md`
- Full guide: `docs/prd/README.md`


