#!/usr/bin/env python3

import os
import sys
import json
import subprocess

# Test our Python script directly to see debug output
print("🔍 Testing Python script directly...")

# Change to the correct directory
agent_dir = "/Users/golfergeek/projects/golfergeek/orchestrator-ai/apps/api/src/agents/actual/engineering/requirements_writer"
script_path = os.path.join(agent_dir, "agent-function.py")

print(f"Script path: {script_path}")
print(f"Script exists: {os.path.exists(script_path)}")

# Prepare test input
test_input = {
    "userMessage": "Create a PRD for a mobile fitness tracking app",
    "sessionId": "test-session",
    "metadata": {
        "taskId": "test-task",
        "llmPreferences": {
            "temperature": 0.7,
            "maxTokens": 1000
        }
    }
}

print(f"Test input: {json.dumps(test_input, indent=2)}")

# Execute the Python script
print("\n" + "="*50)
print("EXECUTING PYTHON SCRIPT")
print("="*50)

try:
    # Use pdm run python to match how NestJS executes it
    process = subprocess.Popen(
        ["pdm", "run", "python", script_path],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=agent_dir,
        text=True
    )
    
    # Send input and get output
    stdout, stderr = process.communicate(input=json.dumps(test_input))
    
    print(f"Exit code: {process.returncode}")
    print(f"STDOUT length: {len(stdout)}")
    print(f"STDERR length: {len(stderr)}")
    
    print("\n" + "-"*30 + " STDERR (Debug Messages) " + "-"*30)
    print(stderr)
    
    print("\n" + "-"*30 + " STDOUT (JSON Response) " + "-"*30)
    print(stdout[:1000] + "..." if len(stdout) > 1000 else stdout)
    
except Exception as e:
    print(f"Error executing script: {e}")