#!/bin/bash

echo "🧪 Testing NestJS Logging Configuration"
echo "======================================"

cd apps/api

echo ""
echo "1️⃣ Testing with minimal logging (error only):"
echo "LOG_LEVEL=error npm run start:dev"
echo "Press Ctrl+C after a few seconds to stop..."
LOG_LEVEL=error timeout 10s npm run start:dev || echo "✅ Minimal logging test completed"

echo ""
echo "2️⃣ Testing with default logging (error, warn, log):"
echo "LOG_LEVEL=error,warn,log npm run start:dev"
echo "Press Ctrl+C after a few seconds to stop..."
LOG_LEVEL=error,warn,log timeout 10s npm run start:dev || echo "✅ Default logging test completed"

echo ""
echo "3️⃣ Testing with debug enabled (error, warn, log, debug):"
echo "LOG_LEVEL=error,warn,log,debug npm run start:dev"
echo "Press Ctrl+C after a few seconds to stop..."
LOG_LEVEL=error,warn,log,debug timeout 10s npm run start:dev || echo "✅ Debug logging test completed"

echo ""
echo "🎯 Logging configuration tests completed!"
echo "Use these environment variables to control logging:"
echo "- LOG_LEVEL=error                    (Minimal)"
echo "- LOG_LEVEL=error,warn              (Production)"
echo "- LOG_LEVEL=error,warn,log          (Development)"
echo "- LOG_LEVEL=error,warn,log,debug    (Debug/Troubleshooting)"
