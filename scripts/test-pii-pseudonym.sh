#!/bin/bash

echo "🧪 Running PII and Pseudonym End-to-End Tests"
echo "============================================="
echo ""

cd "$(dirname "$0")/.."

echo "📦 Ensuring dependencies are installed..."
npm install

echo ""
echo "🔍 Running PII/Pseudonym E2E tests..."
echo ""

cd apps/api

npx jest src/llms/pii-pseudonym-e2e.spec.ts \
  --verbose \
  --forceExit \
  --detectOpenHandles \
  --testTimeout=60000

TEST_EXIT_CODE=$?

if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo ""
  echo "✅ All PII/Pseudonym tests passed!"
  echo ""
  echo "Summary:"
  echo "- ✓ IP address and URL flagging detection"
  echo "- ✓ Pseudonym replacement for known entities"
  echo "- ✓ Complete sanitization pipeline"
  echo "- ✓ LLM request with PII metadata tracking"
  echo "- ✓ Database storage verification"
  echo "- ✓ Reversible sanitization"
  echo "- ✓ Metrics extraction"
  echo "- ✓ Cache management"
  echo "- ✓ Safe logging"
else
  echo ""
  echo "❌ Some tests failed. Please review the output above."
fi

exit $TEST_EXIT_CODE