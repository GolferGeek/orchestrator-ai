---
description: "Review a pull request systematically, checking CI status, running quality checks, and generating review comments"
argument-hint: "[PR-number]"
---

# Review Pull Request

Systematically review a pull request by checking CI status, running quality checks locally, and generating review comments. This command invokes the pr-review-agent for comprehensive review.

**Usage:** `/git:pr:review [PR-number]`

**Examples:**
- `/git:pr:review 123` (review PR #123)
- `/git:pr:review` (prompt for PR number or list PRs)

## Process

### 1. Get PR Information

Use GitHub CLI to get PR details:

```bash
gh pr view [PR-number] --json number,title,state,author,headRefName,baseRefName,url,files,body,statusCheckRollup,reviewDecision
```

**Extract:**
- PR number, title, author
- Source branch and target branch
- Files changed
- CI status
- Review decision

### 2. Check PR Status

**Check if PR is reviewable:**
- Verify PR is open (not closed/merged)
- Verify PR is not draft (unless reviewing drafts is acceptable)
- Check CI status (should be passing or at least running)

**If CI failing:**
```
⚠️  Warning: CI checks are failing

📋 Failed Checks:
   [List failed checks]

💡 Suggestion: Wait for CI to pass or request author to fix issues before reviewing.
```

### 3. Checkout PR Branch

Checkout the PR branch locally:

```bash
gh pr checkout [PR-number]
```

**Or fetch and checkout:**
```bash
git fetch origin [head-ref-name]
git checkout [head-ref-name]
```

### 4. Run Quality Checks

Run quality gates on PR branch:

```bash
npm run format -- --check
npm run lint
npm test
npm run build
```

**Check results:**
- Format: Should pass
- Lint: Should pass
- Tests: Should pass
- Build: Should pass

### 5. Invoke PR Review Agent

Invoke `@pr-review-agent` for comprehensive review:

```
@pr-review-agent

PR Review Request:
- PR Number: [PR-number]
- PR Title: [title]
- Author: [author]
- Files Changed: [list]
- CI Status: [status]
- Quality Checks: [results]

Review this PR systematically.
```

**The agent will:**
- Review code changes
- Check for architecture violations
- Check for test coverage
- Check for documentation
- Generate review comments
- Suggest improvements

### 6. Generate Review Comments

The agent generates review comments covering:
- Code quality issues
- Architecture compliance
- Test coverage
- Documentation
- Security concerns
- Performance issues

### 7. Post Review Comments

Post review comments to GitHub:

```bash
gh pr comment [PR-number] --body "[review-comment]"
```

**Or for inline comments:**
```bash
gh pr review [PR-number] --comment --body "[review-comment]"
```

### 8. Output Summary

```
✅ PR Review Completed

📋 PR Details:
   #123: feat(auth): add user authentication
   Author: @username
   Branch: feature/auth → main
   CI Status: ✅ Passing

📊 Review Results:
   ✅ Code Quality: Good
   ✅ Architecture: Compliant
   ✅ Tests: Coverage adequate
   ⚠️  Documentation: Needs improvement
   ✅ Security: No issues found

📝 Review Comments Posted:
   - [X] comments posted
   - [X] suggestions made
   - [X] approvals/rejections

📤 Next Steps:
   - Author addresses comments
   - Re-review after updates: /git:pr:review 123
   - Merge when approved: /git:pr:merge 123
```

## Important Notes

- **CRITICAL**: Review agent checks for architecture compliance, test coverage, and code quality
- CI status should be passing before approving
- Quality gates should pass locally
- Review comments are constructive and actionable
- Approve only if all checks pass and code is ready

## Review Checklist

- [ ] CI checks passing
- [ ] Quality gates passing locally
- [ ] Code follows architecture patterns
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No security issues
- [ ] Performance acceptable

## Related Commands

- `/git:pr:list` - List all PRs
- `/git:pr:merge` - Merge PR after approval
- `/quality:all` - Run quality gates

## Agent Reference

- `@pr-review-agent` - Specialized agent for PR reviews

## Skill Reference

This command leverages the `github-workflow-skill` and `quality-gates-skill` for context. See `.claude/skills/github-workflow-skill/SKILL.md` and `.claude/skills/quality-gates-skill/SKILL.md` for detailed guidelines.

