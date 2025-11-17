#!/bin/bash

# Script to remove API keys from git history
# WARNING: This rewrites git history and requires force push

set -e

echo "⚠️  WARNING: This script will rewrite git history!"
echo "⚠️  All collaborators will need to re-clone the repository."
echo ""
echo "Press Ctrl+C to cancel, or Enter to continue..."
read

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Creating backup branch...${NC}"
git branch backup-before-secret-removal || echo "Backup branch already exists"

echo -e "${YELLOW}Step 2: Checking git-filter-repo...${NC}"
if ! command -v git-filter-repo &> /dev/null; then
    echo -e "${RED}ERROR: git-filter-repo not found!${NC}"
    echo "Install it with: brew install git-filter-repo"
    exit 1
fi
echo "✓ git-filter-repo is installed"

echo -e "${YELLOW}Step 3: Creating expressions file for secrets to remove...${NC}"
cat > /tmp/secrets-to-remove.txt <<'EOF'
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
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
sk-helicone-4we2lsy-sdbukri-rvnklcy-pwdujqy
EOF

echo -e "${YELLOW}Step 4: Removing secrets from git history...${NC}"
git filter-repo --replace-text /tmp/secrets-to-remove.txt --force

echo -e "${YELLOW}Step 5: Cleaning up...${NC}"
rm /tmp/secrets-to-remove.txt

echo -e "${GREEN}✅ Secrets removed from git history!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Verify the cleanup: git log --all -S 'sk-ant-api03' (should return nothing)"
echo "2. Re-add your remote: git remote add origin <your-repo-url>"
echo "3. Force push: git push origin --force --all"
echo "4. Force push tags: git push origin --force --tags"
echo ""
echo -e "${RED}⚠️  IMPORTANT: Revoke the exposed keys on Anthropic, OpenAI, and Helicone dashboards!${NC}"
