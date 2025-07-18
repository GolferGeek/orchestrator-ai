#!/bin/bash

# Test script for Product Launch Coordinator with automatic authentication

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

# Check what paths are actually registered
echo "Available product agents:"
curl -s http://localhost:4000/agents | jq -r '.agents[] | select(.type == "product") | "\(.name) - \(.type)"'

echo ""
echo "🚀 Testing Product Launch Coordinator with product (singular)..."

# Test the Product Launch Coordinator API (note: product is singular)
curl -X POST http://localhost:4000/agents/product/product_launch_coordinator/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "method": "coordinate_product_launch",
    "prompt": "Coordinate the launch of a new AI-powered productivity tool called ProductiBot targeting small business owners",
    "params": {
      "productName": "ProductiBot",
      "targetMarket": "Small Business Owners",
      "launchDate": "2024-06-01",
      "budget": 250000
    }
  }' | jq '.'

echo ""
echo "🏁 Test completed!"