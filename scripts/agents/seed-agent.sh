#!/usr/bin/env bash
set -euo pipefail

API_BASE=${API_BASE:-"http://localhost:7100"}
TOKEN=${TOKEN:-""}

if [ $# -lt 1 ]; then
  echo "Usage: $0 payload.json [--validate]" >&2
  exit 1
fi

FILE="$1"; shift || true
VALIDATE=false
if [ "${1:-}" = "--validate" ]; then
  VALIDATE=true
fi

if [ ! -f "$FILE" ]; then
  echo "Payload file not found: $FILE" >&2
  exit 1
fi

HDRS=("Content-Type: application/json")
if [ -n "$TOKEN" ]; then
  HDRS+=("Authorization: Bearer $TOKEN")
fi

if $VALIDATE; then
  echo "-- Validating payload ($FILE)"
  curl -sS -X POST "${API_BASE}/api/admin/agents/validate?dryRun=true" -H "${HDRS[@]}" --data-binary @"$FILE" | jq .
else
  echo "-- Upserting agent from $FILE"
  curl -sS -X POST "${API_BASE}/api/admin/agents" -H "${HDRS[@]}" --data-binary @"$FILE" | jq .
fi
