---
description: "Check errors/lint, commit changes, and create a PR"
argument-hint: "[PR title]"
---

# Create Pull Request

Automated workflow to check code quality, commit changes, and create a pull request.

**Usage:** `/git:pr [optional PR title]`

**Examples:**
- `/git:pr Add new agent orchestration feature`
- `/git:pr Fix authentication bug`
- `/git:pr` (will auto-generate PR title from commits)

## Process

This command automates the complete PR workflow:

### 1. Pre-flight Checks

Run all quality checks in parallel:
- **Linting:** `npm run lint`
- **Type checking:** `npm run build` (turbo will run all builds)
- **Tests:** `npm run test`

If any checks fail, stop and report errors to the user.

### 2. Git Status Check

- Run `git status` to see all changes
- Run `git diff` to review staged and unstaged changes
- Check current branch name
- Verify not on main/master branch

### 3. Commit Changes

If there are uncommitted changes:
- Stage all changes: `git add .`
- Create commit with message following this format:
  ```
  [Brief description of changes]

  🤖 Generated with [Claude Code](https://claude.com/claude-code)

  Co-Authored-By: Claude <noreply@anthropic.com>
  ```

If no changes to commit, proceed with existing commits.

### 4. Push to Remote

- Check if branch has remote tracking: `git status -sb`
- Push to remote: `git push` or `git push -u origin <branch-name>` if needed

### 5. Create Pull Request

Use GitHub CLI (`gh`) to create PR:
- If PR title provided in $ARGUMENTS, use that
- Otherwise, auto-generate from commit history
- Include summary of all changes from `git log main..HEAD`
- Format PR body as:
  ```markdown
  ## Summary
  [Bullet points of key changes]

  ## Changes
  [Details from commits]

  ## Test Plan
  - [ ] Lint checks passed
  - [ ] Type checks passed
  - [ ] Tests passed
  - [ ] Manual testing complete

  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  ```

Command: `gh pr create --title "<title>" --body "<body>"`

### 6. Output

Display the PR URL and summary:
```
✅ Pull Request Created Successfully

🔗 URL: https://github.com/{owner}/{repo}/pull/{number}
📋 Title: {title}
🌿 Branch: {branch} → main

Quality Checks:
✅ Linting passed
✅ Type checks passed
✅ Tests passed
```

## Error Handling

- If lint fails: Show errors and stop
- If build fails: Show type errors and stop
- If tests fail: Show failed tests and stop
- If not on feature branch: Warn and ask for confirmation
- If no remote: Set up tracking branch
- If gh CLI not available: Show install instructions

## Important Notes

- Always run quality checks before committing
- Never force push
- Use conventional commit message format
- Auto-generate PR title from commits if not provided
- Include all commits in PR description
- Mark PR as draft if there are TODOs
