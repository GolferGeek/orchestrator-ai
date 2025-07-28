#!/bin/bash

# Script to convert snake_case to camelCase in TypeScript properties and object literals
# Preserves database column names in SQL queries and .from() operations

echo "Converting TypeScript properties to camelCase (preserving database column names)..."

# Function to process a file safely
process_file() {
    local file="$1"
    local temp_file="${file}.tmp"
    
    echo "Processing: $file"
    
    # Copy original file
    cp "$file" "$temp_file"
    
    # Only convert TypeScript properties, not SQL column references
    # We'll be careful to only convert object property names and return types
    
    # Convert property names in object literals and interfaces
    sed -i '' \
        -e 's/\([[:space:]]*\)total_cost\([[:space:]]*:\)/\1totalCost\2/g' \
        -e 's/\([[:space:]]*\)total_tokens\([[:space:]]*:\)/\1totalTokens\2/g' \
        -e 's/\([[:space:]]*\)total_requests\([[:space:]]*:\)/\1totalRequests\2/g' \
        -e 's/\([[:space:]]*\)input_tokens\([[:space:]]*:\)/\1inputTokens\2/g' \
        -e 's/\([[:space:]]*\)output_tokens\([[:space:]]*:\)/\1outputTokens\2/g' \
        -e 's/\([[:space:]]*\)response_time_ms\([[:space:]]*:\)/\1responseTimeMs\2/g' \
        -e 's/\([[:space:]]*\)user_rating\([[:space:]]*:\)/\1userRating\2/g' \
        -e 's/\([[:space:]]*\)speed_rating\([[:space:]]*:\)/\1speedRating\2/g' \
        -e 's/\([[:space:]]*\)accuracy_rating\([[:space:]]*:\)/\1accuracyRating\2/g' \
        -e 's/\([[:space:]]*\)user_notes\([[:space:]]*:\)/\1userNotes\2/g' \
        -e 's/\([[:space:]]*\)evaluation_details\([[:space:]]*:\)/\1evaluationDetails\2/g' \
        -e 's/\([[:space:]]*\)evaluation_timestamp\([[:space:]]*:\)/\1evaluationTimestamp\2/g' \
        -e 's/\([[:space:]]*\)by_provider\([[:space:]]*:\)/\1byProvider\2/g' \
        -e 's/\([[:space:]]*\)by_model\([[:space:]]*:\)/\1byModel\2/g' \
        -e 's/\([[:space:]]*\)daily_stats\([[:space:]]*:\)/\1dailyStats\2/g' \
        -e 's/\([[:space:]]*\)average_response_time\([[:space:]]*:\)/\1averageResponseTime\2/g' \
        -e 's/\([[:space:]]*\)average_user_rating\([[:space:]]*:\)/\1averageUserRating\2/g' \
        -e 's/\([[:space:]]*\)date_range\([[:space:]]*:\)/\1dateRange\2/g' \
        -e 's/\([[:space:]]*\)start_date\([[:space:]]*:\)/\1startDate\2/g' \
        -e 's/\([[:space:]]*\)end_date\([[:space:]]*:\)/\1endDate\2/g' \
        -e 's/\([[:space:]]*\)llm_selection\([[:space:]]*:\)/\1llmSelection\2/g' \
        -e 's/\([[:space:]]*\)cidafm_options\([[:space:]]*:\)/\1cidafmOptions\2/g' \
        -e 's/\([[:space:]]*\)active_state_modifiers\([[:space:]]*:\)/\1activeStateModifiers\2/g' \
        -e 's/\([[:space:]]*\)executed_commands\([[:space:]]*:\)/\1executedCommands\2/g' \
        -e 's/\([[:space:]]*\)processing_notes\([[:space:]]*:\)/\1processingNotes\2/g' \
        -e 's/\([[:space:]]*\)modified_prompt\([[:space:]]*:\)/\1modifiedPrompt\2/g' \
        -e 's/\([[:space:]]*\)current_state\([[:space:]]*:\)/\1currentState\2/g' \
        -e 's/\([[:space:]]*\)session_id\([[:space:]]*:\)/\1sessionId\2/g' \
        "$temp_file"
    
    # Convert property access patterns (but not in SQL contexts)
    sed -i '' \
        -e 's/\(stats\.\)total_cost/\1totalCost/g' \
        -e 's/\(stats\.\)total_tokens/\1totalTokens/g' \
        -e 's/\(stats\.\)total_requests/\1totalRequests/g' \
        -e 's/\(stats\.\)by_provider/\1byProvider/g' \
        -e 's/\(stats\.\)by_model/\1byModel/g' \
        -e 's/\(stats\.\)daily_stats/\1dailyStats/g' \
        -e 's/\(stats\.\)average_response_time/\1averageResponseTime/g' \
        -e 's/\(stats\.\)average_user_rating/\1averageUserRating/g' \
        -e 's/\(options\.\)include_details/\1includeDetails/g' \
        -e 's/\(dto\.\)user_rating/\1userRating/g' \
        -e 's/\(dto\.\)speed_rating/\1speedRating/g' \
        -e 's/\(dto\.\)accuracy_rating/\1accuracyRating/g' \
        -e 's/\(dto\.\)user_notes/\1userNotes/g' \
        -e 's/\(dto\.\)evaluation_details/\1evaluationDetails/g' \
        -e 's/\(dto\.\)llm_selection/\1llmSelection/g' \
        -e 's/\(evaluationDto\.\)user_rating/\1userRating/g' \
        -e 's/\(evaluationDto\.\)speed_rating/\1speedRating/g' \
        -e 's/\(evaluationDto\.\)accuracy_rating/\1accuracyRating/g' \
        -e 's/\(evaluationDto\.\)user_notes/\1userNotes/g' \
        -e 's/\(evaluationDto\.\)evaluation_details/\1evaluationDetails/g' \
        -e 's/\(messageCreateDto\.\)llm_selection/\1llmSelection/g' \
        "$temp_file"
    
    # Check if the file changed
    if ! cmp -s "$file" "$temp_file"; then
        mv "$temp_file" "$file"
        echo "  ✓ Updated $file"
    else
        rm "$temp_file"
        echo "  - No changes needed in $file"
    fi
}

# Process TypeScript files in src directory (excluding node_modules)
find ./src -name "*.ts" -type f | grep -v ".spec.ts" | while read -r file; do
    process_file "$file"
done

echo ""
echo "✅ TypeScript property casing conversion complete!"
echo "📝 Database column names in SQL queries remain as snake_case"
echo "🔄 Use case-converter.ts for database ↔ API mapping"