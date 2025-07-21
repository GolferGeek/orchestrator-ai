"""LLM service client for making HTTP calls to the NestJS LLM service"""

import requests
import json
import sys
import os
from typing import Dict, Any, Optional

# Load environment variables from .env file
def load_env_file():
    """Load environment variables from .env file"""
    try:
        # Try to find .env file starting from current directory up to root
        current_dir = os.getcwd()
        for i in range(5):  # Search up to 5 levels up
            env_path = os.path.join(current_dir, '.env')
            if os.path.exists(env_path):
                with open(env_path, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#') and '=' in line:
                            key, value = line.split('=', 1)
                            os.environ.setdefault(key, value)
                break
            current_dir = os.path.dirname(current_dir)
    except Exception as e:
        print(f"Warning: Could not load .env file: {e}", file=sys.stderr)

# Load environment on import
load_env_file()


class LLMServiceClient:
    """Client for making HTTP calls to the NestJS LLM service"""
    
    def __init__(self, api_url: str = None):
        if api_url is None:
            # Read from environment variables
            base_url = os.getenv('AGENT_BASE_URL', 'http://localhost')
            api_port = os.getenv('API_PORT', '4000')
            self.api_url = f"{base_url}:{api_port}/llm"
        else:
            self.api_url = api_url
    
    async def call_llm_service(
        self, 
        system_prompt: str, 
        user_prompt: str, 
        options: Optional[Dict[str, Any]] = None
    ) -> str:
        """Make HTTP call to LLM service"""
        try:
            payload = {
                "systemPrompt": system_prompt,
                "userPrompt": user_prompt,
                "options": options or {}
            }
            
            response = requests.post(f"{self.api_url}/generate", json=payload)
            response.raise_for_status()
            
            result = response.json()
            return result.get("response", "")
            
        except Exception as e:
            print(f"LLM service call failed: {e}", file=sys.stderr)
            # Fallback for development/testing
            return f"Generated response for: {user_prompt[:100]}..."
    
    def create_options(
        self,
        provider_id: Optional[str] = None,
        model_id: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        auth_token: Optional[str] = None,
        session_id: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Create options dictionary for LLM service call"""
        options = {}
        
        if provider_id:
            options["providerId"] = provider_id
        if model_id:
            options["modelId"] = model_id
        if temperature is not None:
            options["temperature"] = temperature
        if max_tokens:
            options["maxTokens"] = max_tokens
        if auth_token:
            options["authToken"] = auth_token
        if session_id:
            options["sessionId"] = session_id
        
        # Add any additional options
        options.update(kwargs)
        
        return options


def extract_user_preferences(metadata: Dict[str, Any]) -> Dict[str, Any]:
    """Extract LLM preferences from agent metadata"""
    llm_prefs = metadata.get('llmPreferences', {})
    return {
        'providerId': llm_prefs.get('providerId'),
        'modelId': llm_prefs.get('modelId'),
        'temperature': llm_prefs.get('temperature'),
        'maxTokens': llm_prefs.get('maxTokens'),
        'cidafmOptions': llm_prefs.get('cidafmOptions'),
        'authToken': metadata.get('authToken'),
        'sessionId': metadata.get('sessionId')
    }


def merge_llm_preferences(
    base_options: Dict[str, Any],
    user_preferences: Dict[str, Any]
) -> Dict[str, Any]:
    """Merge user preferences with base LLM options"""
    merged = base_options.copy()
    
    # User preferences take priority
    preference_keys = [
        'providerId', 'modelId', 'temperature', 'maxTokens', 
        'cidafmOptions', 'authToken', 'sessionId'
    ]
    
    for key in preference_keys:
        if key in user_preferences and user_preferences[key] is not None:
            merged[key] = user_preferences[key]
    
    return merged


# Global client instance
llm_client = LLMServiceClient()