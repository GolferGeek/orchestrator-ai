# 🚨 URGENT: API Key Leak Cleanup Instructions

## Exposed Keys Found in Git History

The following API keys were found committed to git history:
- ✅ **Anthropic API Key** (`sk-ant-api03-2ZsOQTK...`)
- ✅ **OpenAI API Key** (`sk-proj-PmJ1oauNny...`)
- ✅ **Helicone API Key** (`sk-helicone-4we2lsy...`)

## Immediate Actions Required

### Step 1: Revoke the Exposed Keys (DO THIS FIRST!)

**Before cleaning git history, revoke these keys to prevent abuse:**

1. **Anthropic** (https://console.anthropic.com/settings/keys)
   - Delete the exposed key
   - Generate a new one
   - Update your `.env` file

2. **OpenAI** (https://platform.openai.com/api-keys)
   - Delete the exposed key
   - Generate a new one
   - Update your `.env` file

3. **Helicone** (https://helicone.ai/settings)
   - Delete the exposed key
   - Generate a new one
   - Update your `.env` file

### Step 2: Clean Git History

**⚠️ WARNING: This rewrites git history. All collaborators must re-clone!**

```bash
# Run the cleanup script
./scripts/cleanup-secrets.sh
```

This script will:
- Create a backup branch (`backup-before-secret-removal`)
- Install `git-filter-repo` if needed
- Remove all instances of the exposed keys from history
- Clean up refs and reflogs

### Step 3: Force Push to GitHub

```bash
# Re-add remote (filter-repo removes it for safety)
git remote add origin https://github.com/GolferGeek/orchestrator-ai.git

# Force push all branches
git push origin --force --all

# Force push all tags
git push origin --force --tags
```

### Step 4: Verify Cleanup

```bash
# These should return NO results:
git log --all -S 'sk-ant-api03'
git log --all -S 'sk-proj-'
git log --all -S 'sk-helicone'
```

### Step 5: Notify Collaborators

If anyone else has cloned this repo, they MUST:

```bash
# Delete their local copy
rm -rf orchestrator-ai

# Re-clone fresh
git clone https://github.com/GolferGeek/orchestrator-ai.git
```

## Prevention Installed

✅ **Pre-commit hook** is now installed at `.git/hooks/pre-commit`
- Automatically scans for API keys before each commit
- Will reject commits containing secrets
- To bypass (not recommended): `git commit --no-verify`

## Files Affected in History

Keys were found in these deleted `.env` files:
- `.env.backup`
- `.env.backup-debug`
- `.env.bak`
- `.env.development`
- `.env.local`
- `.env.production`
- `.env.server`

All were committed between August-October 2025 and have been removed from history.

## Current Status

- ✅ `.env` is properly gitignored
- ✅ Pre-commit hook installed to prevent future leaks
- ✅ Cleanup script ready to run
- ⏳ **YOU NEED TO**: Revoke keys and run cleanup script

## Questions?

If you encounter issues, the backup branch is available:
```bash
git checkout backup-before-secret-removal
```
