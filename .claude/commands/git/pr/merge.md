---
description: "Merge a pull request after approval and quality checks"
argument-hint: "[PR-number]"
---

# Merge Pull Request

Merge a pull request after verifying approval, CI status, and quality checks. Supports different merge strategies.

**Usage:** `/git:pr:merge [PR-number]`

**Examples:**
- `/git:pr:merge 123` (merge PR #123)
- `/git:pr:merge 123 --squash` (squash and merge)
- `/git:pr:merge` (prompt for PR number)

## Process

### 1. Get PR Information

Use GitHub CLI to get PR details:

```bash
gh pr view [PR-number] --json number,title,state,author,headRefName,baseRefName,url,statusCheckRollup,reviewDecision,mergeable
```

**Extract:**
- PR number, title, author
- Source branch and target branch
- CI status
- Review decision (approved/rejected/changes requested)
- Mergeable status

### 2. Verify PR is Mergeable

**Check prerequisites:**
- PR is open (not closed/merged)
- CI checks are passing
- PR has approvals (if required)
- No merge conflicts
- PR is mergeable

**If not mergeable:**
```
❌ PR Cannot Be Merged

📋 Issues:
   ❌ CI checks failing: [list failed checks]
   ❌ Review not approved: [review status]
   ❌ Merge conflicts: [conflict files]

💡 Fix Issues:
   1. Wait for CI to pass
   2. Get approvals: /git:pr:review [PR-number]
   3. Resolve conflicts: git merge [branch]
```

### 3. Show Merge Preview

Display what will be merged:

```
📋 Merge Preview

PR: #123 - feat(auth): add user authentication
Author: @username
Branch: feature/auth → main
Commits: [X] commits
Files Changed: [X] files

📊 Status:
   ✅ CI Checks: Passing
   ✅ Reviews: Approved
   ✅ Mergeable: Yes

⚠️  This will merge PR #123 into main branch.
```

**Require confirmation:** User must confirm merge.

### 4. Execute Merge

Merge PR using GitHub CLI:

```bash
gh pr merge [PR-number] --squash --delete-branch
```

**Merge strategies:**
- `--squash` - Squash and merge (recommended, creates single commit)
- `--merge` - Create merge commit
- `--rebase` - Rebase and merge
- `--delete-branch` - Delete branch after merge (recommended)

### 5. Verify Merge Success

Check merge status:

```bash
gh pr view [PR-number] --json state
```

### 6. Output Summary

```
✅ Pull Request Merged Successfully

📋 Merge Details:
   PR: #123 - feat(auth): add user authentication
   Merged into: main
   Merge Strategy: Squash and merge
   Branch Deleted: feature/auth

📊 Results:
   ✅ PR merged
   ✅ Branch deleted
   ✅ Commits: [X] commits squashed into 1

📤 Next Steps:
   - Pull latest: git checkout main && git pull
   - Verify changes: git log -1
   - Deploy if needed
```

## Important Notes

- **CRITICAL**: Only merge PRs that have approvals and passing CI
- Squash and merge is recommended (cleaner history)
- Delete branch after merge (keeps repo clean)
- Verify merge success before proceeding
- Pull latest main after merge

## Merge Strategies

- **Squash and Merge** (Recommended): Creates single commit, cleaner history
- **Merge Commit**: Creates merge commit, preserves branch history
- **Rebase and Merge**: Replays commits, linear history

## Error Handling

- If PR not mergeable: Show specific issues
- If CI failing: Show failed checks
- If not approved: Show review status
- If conflicts: Show conflict files
- If merge fails: Show error and suggest manual merge

## Related Commands

- `/git:pr:list` - List PRs
- `/git:pr:review` - Review PR before merging
- `/git:pr` - Create new PR

## Skill Reference

This command leverages the `github-workflow-skill` for context. See `.claude/skills/github-workflow-skill/SKILL.md` for detailed GitHub workflow patterns.

