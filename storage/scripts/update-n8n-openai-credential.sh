#!/bin/bash
# Script to update n8n workflow OpenAI credential references
# Usage: ./update-n8n-openai-credential.sh <new-credential-id>

set -e

NEW_CREDENTIAL_ID="$1"

if [ -z "$NEW_CREDENTIAL_ID" ]; then
    echo "❌ Error: Missing credential ID"
    echo ""
    echo "Usage: $0 <new-credential-id>"
    echo ""
    echo "Steps to fix the missing OpenAI credential:"
    echo ""
    echo "1. Open n8n UI: http://localhost:5678"
    echo "2. Go to Settings → Credentials"
    echo "3. Click 'Add Credential' → Search for 'OpenAI'"
    echo "4. Select 'OpenAI API'"
    echo "5. Enter your OpenAI API key"
    echo "6. Name it (e.g., 'OpenAI API Key')"
    echo "7. Save it"
    echo ""
    echo "8. Get the credential ID:"
    echo "   - After saving, check the URL: it will be like /credentials/XXXXX"
    echo "   - Or check the credential details page"
    echo ""
    echo "9. Run this script with the new credential ID:"
    echo "   $0 <new-credential-id>"
    exit 1
fi

echo "🔄 Updating n8n workflow credential references..."
echo "   New Credential ID: $NEW_CREDENTIAL_ID"
echo ""

# Load database connection from environment or use defaults
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-7012}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-postgres}"

export PGPASSWORD=postgres

docker exec -i supabase_db_api-dev psql -U postgres -d postgres << EOF
-- Update all workflows that have OpenAI credential references
UPDATE n8n.workflow_entity
SET nodes = (
    SELECT jsonb_agg(
        CASE 
            WHEN node->'credentials'->'openAiApi' IS NOT NULL
            THEN jsonb_set(
                node,
                ARRAY['credentials', 'openAiApi', 'id'],
                '"$NEW_CREDENTIAL_ID"'
            )
            ELSE node
        END
    )
    FROM jsonb_array_elements(nodes::jsonb) AS node
)::json
WHERE nodes::text LIKE '%openAiApi%';

-- Verify the update
SELECT 
    id,
    name,
    (SELECT jsonb_agg(
        jsonb_build_object(
            'node_name', node->>'name',
            'credential_id', node->'credentials'->'openAiApi'->>'id'
        )
    )
    FROM jsonb_array_elements(nodes::jsonb) AS node
    WHERE node->'credentials'->'openAiApi' IS NOT NULL) as updated_credentials
FROM n8n.workflow_entity
WHERE nodes::text LIKE '%openAiApi%';
EOF

echo ""
echo "✅ Workflow credential references updated!"
echo ""
echo "⚠️  Note: You may need to refresh the workflow in n8n UI or restart n8n"
echo "   for the changes to take effect."

