#!/bin/bash

# Test Requirements Writer N8N Workflow
# This script tests the requirements writer workflow with sample data

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
N8N_BASE_URL="http://localhost:5678"
WEBHOOK_URL="$N8N_BASE_URL/webhook/requirements"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Testing Requirements Writer N8N Workflow${NC}"

# Check if N8N is running
if ! curl -s "$N8N_BASE_URL" > /dev/null; then
    echo -e "${RED}❌ N8N is not running on $N8N_BASE_URL${NC}"
    echo -e "${YELLOW}Please start N8N first:${NC}"
    echo "  cd $SCRIPT_DIR/.. && ./manage.sh up"
    exit 1
fi

echo -e "${GREEN}✅ N8N is running${NC}"

# Test cases
declare -a TEST_CASES=(
    "Create a user authentication system for our mobile app"
    "I need a technical requirements document for a microservices architecture"
    "Generate API documentation for our REST API"
    "Create user stories for an e-commerce checkout process"
    "Design architecture requirements for a real-time chat application"
    "Write general requirements for a project management tool"
)

# Test function
test_requirements() {
    local test_message="$1"
    local test_number="$2"
    
    echo -e "${YELLOW}📝 Test $test_number: $test_message${NC}"
    
    # Prepare test data
    local test_data=$(cat <<EOF
{
  "userMessage": "$test_message",
  "conversationHistory": [
    {
      "role": "user",
      "content": "I need help with requirements"
    }
  ],
  "mode": "build",
  "sessionId": "test-session-$test_number"
}
EOF
)
    
    # Make request
    local response=$(curl -s -X POST "$WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "$test_data" \
        --max-time 60)
    
    # Check response
    if echo "$response" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ Test $test_number passed${NC}"
        
        # Extract key information
        local document_type=$(echo "$response" | jq -r '.metadata.documentType.value // "unknown"' 2>/dev/null || echo "unknown")
        local processing_time=$(echo "$response" | jq -r '.metadata.processingTime // "unknown"' 2>/dev/null || echo "unknown")
        local sections=$(echo "$response" | jq -r '.metadata.sections // "unknown"' 2>/dev/null || echo "unknown")
        
        echo -e "${BLUE}   📊 Document Type: $document_type${NC}"
        echo -e "${BLUE}   ⏱️  Processing Time: ${processing_time}ms${NC}"
        echo -e "${BLUE}   📄 Sections: $sections${NC}"
        
        # Show first 200 characters of response
        local preview=$(echo "$response" | jq -r '.response // ""' 2>/dev/null | head -c 200 || echo "No response content")
        echo -e "${BLUE}   📝 Preview: ${preview}...${NC}"
        
    else
        echo -e "${RED}❌ Test $test_number failed${NC}"
        echo -e "${RED}   Response: $response${NC}"
        return 1
    fi
    
    echo ""
}

# Run tests
echo -e "${BLUE}🚀 Running ${#TEST_CASES[@]} test cases...${NC}"
echo ""

success_count=0
total_count=${#TEST_CASES[@]}

for i in "${!TEST_CASES[@]}"; do
    test_number=$((i + 1))
    if test_requirements "${TEST_CASES[$i]}" "$test_number"; then
        ((success_count++))
    fi
done

echo -e "${BLUE}📊 Test Results:${NC}"
echo -e "${GREEN}✅ Passed: $success_count${NC}"
echo -e "${RED}❌ Failed: $((total_count - success_count))${NC}"
echo -e "${BLUE}📈 Success Rate: $((success_count * 100 / total_count))%${NC}"

if [ $success_count -eq $total_count ]; then
    echo -e "${GREEN}🎉 All tests passed! Requirements Writer N8N workflow is working correctly.${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Some tests failed. Check the output above for details.${NC}"
    exit 1
fi

