#!/bin/bash
# VIP Management via API Examples

API_BASE="http://localhost:9000"

echo "🎭 VIP Management via API"
echo "=========================="

# 1. Add VIP Executive Pattern
echo "1️⃣ Adding VIP Executive Pattern..."
curl -X POST "$API_BASE/sanitization/pii/patterns" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "vip_tech_executives",
    "dataType": "name",
    "pattern": "\\b(?:Tim Cook|Elon Musk|Jeff Bezos|Satya Nadella)\\b",
    "description": "Tech executive VIP names",
    "priority": 5
  }' | jq '.'

echo -e "\n"

# 2. Add VIP Company Pattern
echo "2️⃣ Adding VIP Company Pattern..."
curl -X POST "$API_BASE/sanitization/pii/patterns" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "vip_tech_companies",
    "dataType": "custom",
    "pattern": "\\b(?:Apple|Microsoft|Google|Amazon|Tesla)\\b",
    "description": "Major tech companies",
    "priority": 10
  }' | jq '.'

echo -e "\n"

# 3. Test VIP Detection
echo "3️⃣ Testing VIP Detection..."
curl -X POST "$API_BASE/sanitization/test" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hi, I am Tim Cook from Apple and I need to discuss our partnership with Microsoft.",
    "enablePseudonymization": true,
    "enableRedaction": false
  }' | jq '.result | {sanitizedText, piiDetected, pseudonymsApplied}'

echo -e "\n"

# 4. Get All PII Patterns
echo "4️⃣ Current PII Patterns..."
curl -X GET "$API_BASE/sanitization/pii/patterns" | jq '.patterns | length'

# 5. Get Service Stats
echo "5️⃣ Service Statistics..."
curl -X GET "$API_BASE/sanitization/stats" | jq '.piiPatternStats'
