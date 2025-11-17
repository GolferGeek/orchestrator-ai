#!/bin/bash

# Setup git hooks to prevent committing secrets
# This creates a pre-commit hook that scans for API keys

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Setting up git secrets protection...${NC}"

# Create pre-commit hook
HOOK_FILE=".git/hooks/pre-commit"

cat > "$HOOK_FILE" <<'HOOK_SCRIPT'
#!/bin/bash

# Pre-commit hook to prevent committing secrets
# Scans staged files for common API key patterns

RED='\033[0;31m'
NC='\033[0m'

echo "🔍 Scanning for secrets..."

# Define patterns to search for
PATTERNS=(
  'sk-ant-api[0-9]{2}-[A-Za-z0-9_-]{95,}'  # Anthropic API keys
  'sk-proj-[A-Za-z0-9_-]{100,}'            # OpenAI project keys
  'sk-[A-Za-z0-9]{48}'                     # Generic OpenAI keys
  'sk-helicone-[a-z0-9-]+'                 # Helicone keys
  '(ANTHROPIC_API_KEY|OPENAI_API_KEY|HELICONE_API_KEY)=sk-[A-Za-z0-9_-]+'
)

# Check staged files
FOUND_SECRET=0
for pattern in "${PATTERNS[@]}"; do
  if git diff --cached --name-only | xargs -I {} grep -H -n -E "$pattern" {} 2>/dev/null; then
    FOUND_SECRET=1
  fi
done

if [ $FOUND_SECRET -eq 1 ]; then
  echo -e "${RED}❌ COMMIT REJECTED: Secrets detected in staged files!${NC}"
  echo ""
  echo "Please remove the secrets before committing."
  echo "To bypass this check (NOT RECOMMENDED): git commit --no-verify"
  exit 1
fi

echo "✅ No secrets detected"
exit 0
HOOK_SCRIPT

chmod +x "$HOOK_FILE"

echo -e "${GREEN}✅ Pre-commit hook installed at $HOOK_FILE${NC}"
echo ""
echo "This hook will scan for API keys before each commit."
echo "To bypass (not recommended): use 'git commit --no-verify'"
