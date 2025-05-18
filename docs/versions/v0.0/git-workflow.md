# Git Workflow: Branches and Pull Requests

This document explains the process of using Git branches and pull requests (PRs) for collaborative development. It's divided into two sections:

1. **For Contributors**: How to create branches and submit pull requests
2. **For Maintainers**: How to review and merge pull requests

## Why Use Branches?

Working directly on the main branch can lead to several problems:

- Multiple people working simultaneously can create conflicts
- Broken code immediately affects everyone
- It's harder to review changes before they go live
- Rollbacks become more complicated

Using branches creates a separate workspace for each feature or fix, allowing for isolated development, proper review, and controlled integration.

## For Contributors (Mentees)

### Creating a New Branch

```bash
# Make sure you're on the main branch and it's up to date
git checkout main
git pull

# Create a new branch and switch to it
git checkout -b feature/your-feature-name
```

Name your branch with a prefix that indicates the type of change:
- `feature/` for new features
- `fix/` for bug fixes
- `docs/` for documentation changes
- `refactor/` for code improvements

### Working on Your Branch

1. Make your changes, committing frequently with clear commit messages:

```bash
git add .
git commit -m "Implement X functionality"
```

2. Keep your branch updated with changes from main:

```bash
git checkout main
git pull
git checkout feature/your-feature-name
git merge main
```

3. Push your branch to GitHub:

```bash
git push -u origin feature/your-feature-name
```

### Testing Your Changes

**Writing tests is a crucial part of the development process.** For each feature or fix:

1. **Create appropriate tests** that verify your changes work correctly:
   - Unit tests for individual functions
   - Integration tests for feature interactions
   - API tests for endpoints

2. **Run existing tests** to ensure your changes don't break existing functionality:
   ```bash
   # Run API tests
   npm run test:api
   
   # Run specific tests
   python -m pdm run pytest tests/path/to/specific_test.py
   ```

3. **Verify test coverage** to ensure your changes are adequately tested:
   - Aim for at least 80% test coverage for new code
   - Test both happy paths and edge cases/error conditions

4. **Include test results** in your PR description to demonstrate that your changes have been properly tested

### Creating a Pull Request

1. Go to the repository on GitHub
2. Click on "Pull requests" tab
3. Click the green "New pull request" button
4. Select your branch from the dropdown
5. Click "Create pull request"
6. Fill out the PR template with:
   - Description of changes
   - Why the changes are needed
   - How to test the changes
   - Test results showing your changes work correctly
   - Any related issues
7. Click "Create pull request" to submit

### Pull Request Best Practices

- Keep PRs focused on a single feature or fix
- Write clear descriptions explaining the purpose and implementation
- Include screenshots for UI changes
- Always include tests for your changes
- Respond to feedback promptly
- Make requested changes on the same branch and push again (the PR will update automatically)

## For Maintainers (Project Owners)

### Viewing Pull Requests

1. Go to your repository on GitHub
2. Click on the "Pull requests" tab to see all open PRs
3. Click on a specific PR to view its details

### Reviewing a Pull Request

1. On the PR page, click the "Files changed" tab to see the code changes
2. Review the code by:
   - Examining the changes line by line
   - Leaving comments by clicking the "+" button next to any line
   - Adding general comments in the conversation tab

3. Check out the branch locally (optional, for more thorough testing):
   ```bash
   git fetch origin
   git checkout feature/branch-name
   # Test the changes locally
   ```

### Evaluating Tests

A critical part of reviewing PRs is ensuring adequate test coverage:

1. **Verify test existence**:
   - Check that appropriate tests have been added for new features
   - Confirm bug fixes include regression tests
   
2. **Review test quality**:
   - Ensure tests cover both common usage and edge cases
   - Check that tests are meaningful, not just increasing coverage numbers
   - Verify mocks and test data are realistic

3. **Run tests locally**:
   ```bash
   # Run API tests
   npm run test:api
   
   # Run specific tests related to the PR
   python -m pdm run pytest tests/path/to/relevant_test.py
   ```

4. **Consider test coverage**:
   - For new features, aim for at least 80% coverage
   - For critical components, aim for higher coverage

5. **Request additional tests** if coverage or scenarios are insufficient

### Providing Feedback

You can leave three types of feedback:
- **Comments**: General feedback without explicit approval/rejection
- **Request changes**: Required changes before the PR can be merged
- **Approve**: The PR is ready to be merged

To do this:
1. Go to the "Files changed" tab
2. Add your line comments
3. Click "Review changes" in the top right
4. Select your feedback type and add a summary
5. Click "Submit review"

### Merging a Pull Request

Once you're satisfied with the changes:

1. Go to the PR page
2. Scroll to the bottom
3. Click the green "Merge pull request" button
4. Choose a merge method:
   - **Create a merge commit**: Preserves all commits from the branch as separate commits
   - **Squash and merge**: Combines all branch commits into a single commit
   - **Rebase and merge**: Applies all commits from the branch individually without a merge commit
5. Click "Confirm merge"
6. (Optional) Delete the branch after merging

### Handling Merge Conflicts

If GitHub shows "This branch has conflicts that must be resolved":

1. Click the "Resolve conflicts" button on the PR page
2. GitHub will show the conflicting files
3. Edit the files to resolve conflicts
4. Click "Mark as resolved" for each file
5. Click "Commit merge" when all conflicts are resolved

Alternatively, resolve conflicts locally:

```bash
git checkout feature/branch-name
git merge main
# Resolve conflicts in your editor
git add .
git commit -m "Resolve merge conflicts"
git push
```

## Common GitHub PR Review Workflows

### Standard Review Workflow

1. **Maintainer views PR**: Checks description and purpose
2. **Maintainer reviews code**: Examines changes, leaves comments
3. **Maintainer reviews tests**: Ensures changes are properly tested
4. **Contributor addresses feedback**: Makes requested changes
5. **Maintainer approves**: After changes are satisfactory
6. **Maintainer merges**: Integrates changes into main branch

### Team-Based Review Workflow

1. **PR is submitted**: Author assigns reviewers
2. **Team members review**: Leave comments and suggestions
3. **Test coverage is evaluated**: Team ensures test coverage is adequate
4. **Author addresses feedback**: Makes requested changes
5. **Reviewers approve**: At least two team members approve
6. **Maintainer merges**: After required approvals

## Tips for Efficient Review Process

### For Contributors:
- Keep PRs small and focused
- Use the PR template thoroughly
- Add screenshots or videos for visual changes
- **Include tests for all changes**
- **Document test scenarios and results**
- Respond to feedback promptly

### For Maintainers:
- Set clear expectations for PR quality and test coverage
- Be specific in feedback
- Use GitHub's suggested changes feature
- Consider using automation tools (GitHub Actions)
- **Enforce test requirements consistently**
- Provide constructive feedback

## GitHub UI Navigation for Pull Requests

### Finding Pull Requests
1. On your repository page, click the "Pull requests" tab
2. Use filters to sort by:
   - Author
   - Labels
   - Assignee
   - Status (open, closed, draft)

### Key PR Actions in UI
- **Comment**: Add general feedback
- **Approve**: Mark PR as ready to merge
- **Request changes**: Require further modifications
- **Merge**: Integrate changes into main branch
- **Close**: Reject the PR without merging
- **Reopen**: Reactivate a closed PR

## Test-Driven Development Workflow

For the best results, consider following a test-driven development (TDD) approach:

1. **Write tests first** that define the expected behavior
2. **Run the tests** to confirm they fail (since the feature doesn't exist yet)
3. **Implement the minimum code** needed to make the tests pass
4. **Refactor the code** to improve quality while ensuring tests continue to pass
5. **Submit your PR** with both tests and implementation

This approach ensures that all features are testable by design and have appropriate test coverage.

## Conclusion

Using branches and pull requests creates a more organized, collaborative, and safer development process. By following these workflows and ensuring proper test coverage, contributors can work independently while maintainers ensure code quality through thorough reviews before changes reach the main branch. 