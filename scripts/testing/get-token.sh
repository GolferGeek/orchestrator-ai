#!/bin/bash
curl -s -X POST http://localhost:7100/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo.user@orchestratorai.io","password":"DemoUser123!"}' | jq -r '.access_token'
