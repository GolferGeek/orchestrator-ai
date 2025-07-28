#!/bin/bash

# Script to convert snake_case to camelCase in TypeScript files
# This handles common patterns in our codebase

echo "Converting snake_case to camelCase in TypeScript files..."

# Find all relevant TypeScript files (excluding node_modules)
find ./src -name "*.ts" -type f | while read -r file; do
    echo "Processing: $file"
    
    # Create a temporary file for sed operations
    temp_file="${file}.tmp"
    cp "$file" "$temp_file"
    
    # Common property name conversions
    sed -i '' \
        -e 's/total_cost/totalCost/g' \
        -e 's/total_tokens/totalTokens/g' \
        -e 's/total_requests/totalRequests/g' \
        -e 's/input_tokens/inputTokens/g' \
        -e 's/output_tokens/outputTokens/g' \
        -e 's/response_time_ms/responseTimeMs/g' \
        -e 's/user_rating/userRating/g' \
        -e 's/speed_rating/speedRating/g' \
        -e 's/accuracy_rating/accuracyRating/g' \
        -e 's/user_notes/userNotes/g' \
        -e 's/evaluation_details/evaluationDetails/g' \
        -e 's/evaluation_timestamp/evaluationTimestamp/g' \
        -e 's/provider_id/providerId/g' \
        -e 's/model_id/modelId/g' \
        -e 's/user_id/userId/g' \
        -e 's/session_id/sessionId/g' \
        -e 's/api_base_url/apiBaseUrl/g' \
        -e 's/auth_type/authType/g' \
        -e 's/created_at/createdAt/g' \
        -e 's/updated_at/updatedAt/g' \
        -e 's/pricing_input_per_1k/pricingInputPer1k/g' \
        -e 's/pricing_output_per_1k/pricingOutputPer1k/g' \
        -e 's/max_tokens/maxTokens/g' \
        -e 's/context_window/contextWindow/g' \
        -e 's/supports_thinking/supportsThinking/g' \
        -e 's/use_cases/useCases/g' \
        -e 's/is_builtin/isBuiltin/g' \
        -e 's/is_active/isActive/g' \
        -e 's/default_active/defaultActive/g' \
        -e 's/by_provider/byProvider/g' \
        -e 's/by_model/byModel/g' \
        -e 's/daily_stats/dailyStats/g' \
        -e 's/average_response_time/averageResponseTime/g' \
        -e 's/average_user_rating/averageUserRating/g' \
        -e 's/date_range/dateRange/g' \
        -e 's/start_date/startDate/g' \
        -e 's/end_date/endDate/g' \
        -e 's/include_details/includeDetails/g' \
        -e 's/llm_selection/llmSelection/g' \
        -e 's/cidafm_options/cidafmOptions/g' \
        -e 's/message_id/messageId/g' \
        -e 's/command_name/commandName/g' \
        -e 's/command_type/commandType/g' \
        -e 's/active_state_modifiers/activeStateModifiers/g' \
        -e 's/executed_commands/executedCommands/g' \
        -e 's/processing_notes/processingNotes/g' \
        -e 's/modified_prompt/modifiedPrompt/g' \
        -e 's/current_state/currentState/g' \
        -e 's/custom_modifiers/customModifiers/g' \
        -e 's/user_message/userMessage/g' \
        -e 's/assistant_response/assistantResponse/g' \
        -e 's/display_name/displayName/g' \
        -e 's/access_token/accessToken/g' \
        -e 's/refresh_token/refreshToken/g' \
        -e 's/token_type/tokenType/g' \
        -e 's/expires_in/expiresIn/g' \
        -e 's/email_confirmed_at/emailConfirmedAt/g' \
        -e 's/confirmed_at/confirmedAt/g' \
        -e 's/last_sign_in_at/lastSignInAt/g' \
        -e 's/app_metadata/appMetadata/g' \
        -e 's/user_metadata/userMetadata/g' \
        "$temp_file"
    
    # Check if the file changed
    if ! cmp -s "$file" "$temp_file"; then
        mv "$temp_file" "$file"
        echo "  ✓ Updated $file"
    else
        rm "$temp_file"
        echo "  - No changes needed in $file"
    fi
done

echo "Conversion complete!"