#!/bin/bash
# Simple shell script to send hook events to observability server
# Much more efficient than spawning Node/Python processes

# Parse arguments
SOURCE_APP=""
EVENT_TYPE=""
SERVER_URL="http://localhost:4100/events"
ADD_CHAT=false
SUMMARIZE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --source-app)
      SOURCE_APP="$2"
      shift 2
      ;;
    --event-type)
      EVENT_TYPE="$2"
      shift 2
      ;;
    --server-url)
      SERVER_URL="$2"
      shift 2
      ;;
    --add-chat)
      ADD_CHAT=true
      shift
      ;;
    --summarize)
      SUMMARIZE=true
      shift
      ;;
    *)
      shift
      ;;
  esac
done

# Read JSON from stdin
INPUT=$(cat)

# Extract session_id (use jq if available, otherwise basic grep)
if command -v jq &> /dev/null; then
  SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"')
else
  SESSION_ID="unknown"
fi

# Build event JSON
TIMESTAMP=$(date +%s)000
EVENT_JSON=$(cat <<EOF
{
  "source_app": "$SOURCE_APP",
  "session_id": "$SESSION_ID",
  "hook_event_type": "$EVENT_TYPE",
  "payload": $INPUT,
  "timestamp": $TIMESTAMP
}
EOF
)

# Send to server (silent, don't block on failure)
curl -s -X POST "$SERVER_URL" \
  -H "Content-Type: application/json" \
  -H "User-Agent: Claude-Code-Hook/1.0" \
  -d "$EVENT_JSON" \
  --max-time 2 \
  > /dev/null 2>&1 || true

# Always exit 0 to not block Claude Code
exit 0
