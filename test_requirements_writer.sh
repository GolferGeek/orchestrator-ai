#!/bin/bash

# Test script for Python Requirements Writer LangGraph implementation

echo "🔐 Authenticating with test credentials..."

# Get auth token
AUTH_RESPONSE=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "testuser@golfergeek.com", "password": "testuser01!"}')

# Extract token from response (use accessToken field name)
TOKEN=$(echo $AUTH_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Authentication failed. Response: $AUTH_RESPONSE"
  exit 1
fi

echo "✅ Authentication successful! Token: ${TOKEN:0:20}..."

echo ""
echo "🔍 Debugging agent discovery..."

# Check what engineering agents are available
echo "Available engineering agents:"
curl -s http://localhost:4000/agents | jq -r '.agents[] | select(.type == "engineering") | "\(.name) - \(.type)"'

echo ""
echo "🚀 Testing Python Requirements Writer LangGraph implementation..."

# Test the Requirements Writer API
curl -X POST http://localhost:4000/agents/engineering/requirements_writer/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "method": "write_requirements",
    "prompt": "I need to create a Product Requirements Document (PRD) for a new task management mobile app that helps teams collaborate on projects with real-time updates and file sharing capabilities",
    "params": {
      "document_type": "prd",
      "project_name": "TeamSync Mobile App",
      "features": ["real-time collaboration", "file sharing", "task management", "mobile app"],
      "complexity": "medium"
    }
  }' | jq '.'

echo ""
echo "🏁 Test completed!"