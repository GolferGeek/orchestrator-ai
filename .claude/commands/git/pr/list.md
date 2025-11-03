---
description: "List all open pull requests with status and details"
argument-hint: "[status-filter]"
---

# List Pull Requests

List all open pull requests with their status, CI status, reviewers, and other details using GitHub CLI.

**Usage:** `/git:pr:list [status-filter]`

**Examples:**
- `/git:pr:list` (list all open PRs)
- `/git:pr:list open` (list open PRs)
- `/git:pr:list merged` (list merged PRs)
- `/git:pr:list draft` (list draft PRs)

## Process

### 1. Query GitHub PRs

Use GitHub CLI to list PRs:

```bash
gh pr list [--state open|closed|merged|all] [--limit 50]
```

**If status filter provided:**
- Filter by status (open, closed, merged, draft)

**If no filter:**
- List all open PRs (default)

### 2. Get PR Details

For each PR, get additional details:

```bash
gh pr view [PR-number] --json number,title,state,author,headRefName,baseRefName,url,createdAt,updatedAt,isDraft,reviewDecision,statusCheckRollup
```

### 3. Format Output

Display PRs in formatted table:

```
📋 Pull Requests

┌──────┬─────────────────────────────────────┬──────────┬─────────────┬──────────────┬────────────┐
│  #   │ Title                               │ Status   │ Author      │ Branch       │ CI Status  │
├──────┼─────────────────────────────────────┼──────────┼─────────────┼──────────────┼────────────┤
│ 123  │ feat(auth): add user authentication │ Open     │ @username   │ feature/auth │ ✅ Passing │
│ 122  │ fix(api): resolve endpoint bug      │ Draft    │ @username   │ fix/api-bug  │ ⏳ Running │
│ 121  │ chore(deps): update dependencies    │ Merged   │ @username   │ chore/deps   │ ✅ Passing │
└──────┴─────────────────────────────────────┴──────────┴─────────────┴──────────────┴────────────┘

📊 Summary:
   - Open: [X]
   - Draft: [X]
   - Merged: [X]
   - Total: [X]

📋 Next Actions:
   - Review PR: /git:pr:review [PR-number]
   - View PR: gh pr view [PR-number]
   - Merge PR: /git:pr:merge [PR-number]
```

## Important Notes

- **CRITICAL**: Requires GitHub CLI (`gh`) to be installed and authenticated
- CI status shows GitHub Actions/checks status
- Review decision shows approval status
- PRs are sorted by number (newest first)

## Status Filters

- `open` - Open PRs (default)
- `closed` - Closed PRs
- `merged` - Merged PRs
- `draft` - Draft PRs
- `all` - All PRs

## Related Commands

- `/git:pr:review` - Review a specific PR
- `/git:pr:merge` - Merge a PR
- `/git:pr` - Create a new PR

## Skill Reference

This command leverages the `github-workflow-skill` for context. See `.claude/skills/github-workflow-skill/SKILL.md` for detailed GitHub workflow patterns.

