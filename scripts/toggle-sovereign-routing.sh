#!/bin/bash

# Toggle Sovereign Routing Feature Flag
# Usage: ./scripts/toggle-sovereign-routing.sh [on|off|status]

ENV_FILE=".env"
FLAG_VAR="FEATURE_FLAG_SOVEREIGN_ROUTING_ENABLED"

show_status() {
    echo "🔍 Current Sovereign Routing Status:"
    echo "----------------------------------------"
    
    if grep -q "^${FLAG_VAR}=" "$ENV_FILE"; then
        current_value=$(grep "^${FLAG_VAR}=" "$ENV_FILE" | cut -d'=' -f2)
        if [ "$current_value" = "true" ]; then
            echo "✅ ENABLED - Sovereign routing is ACTIVE"
            echo "   Users will see sovereign mode restrictions"
        else
            echo "❌ DISABLED - Legacy routing is ACTIVE" 
            echo "   No sovereign mode restrictions (default behavior)"
        fi
    else
        echo "❌ DISABLED - Variable not set (defaults to false)"
        echo "   No sovereign mode restrictions (default behavior)"
    fi
    
    echo ""
    echo "📍 Test endpoints:"
    echo "   GET  http://localhost:3000/feature-flags/sovereign-routing"
    echo "   GET  http://localhost:3000/sovereign-policy"
    echo ""
}

turn_on() {
    echo "🔄 Enabling Sovereign Routing..."
    
    # Remove existing line if present
    sed -i.bak "/^${FLAG_VAR}=/d" "$ENV_FILE" 2>/dev/null || true
    
    # Add the enabled flag
    echo "${FLAG_VAR}=true" >> "$ENV_FILE"
    
    echo "✅ Sovereign Routing is now ENABLED"
    echo ""
    echo "🚀 To see it in action:"
    echo "   1. Make an LLM request (any agent or direct LLM call)"
    echo "   2. Check the reasoning path in logs/response"
    echo "   3. Look for 'Sovereign routing feature flag: ENABLED'"
    echo ""
    echo "🔧 To test sovereign mode restrictions:"
    echo "   The feature flag just enables the CODE - sovereign mode settings control BEHAVIOR:"
    echo "   - SOVEREIGN_MODE_ENFORCED=true (force all users)"
    echo "   - SOVEREIGN_MODE_ALLOWED_PROVIDERS=ollama,local (restrict providers)"
    echo ""
}

turn_off() {
    echo "🔄 Disabling Sovereign Routing..."
    
    # Remove existing line if present  
    sed -i.bak "/^${FLAG_VAR}=/d" "$ENV_FILE" 2>/dev/null || true
    
    # Add the disabled flag
    echo "${FLAG_VAR}=false" >> "$ENV_FILE"
    
    echo "❌ Sovereign Routing is now DISABLED"
    echo ""
    echo "📝 System will use legacy routing logic (original behavior)"
    echo "   No sovereign mode checks will be performed"
    echo ""
}

case "$1" in
    "on"|"enable"|"true")
        turn_on
        show_status
        ;;
    "off"|"disable"|"false")  
        turn_off
        show_status
        ;;
    "status"|"check"|"")
        show_status
        ;;
    *)
        echo "Usage: $0 [on|off|status]"
        echo ""
        echo "Commands:"
        echo "  on      - Enable sovereign routing feature flag"
        echo "  off     - Disable sovereign routing feature flag" 
        echo "  status  - Show current status (default)"
        echo ""
        exit 1
        ;;
esac
