import { Injectable } from '@nestjs/common';

export interface LLMCallOptions {
  providerName?: string;
  modelName?: string;
  temperature?: number;
  maxTokens?: number;
  cidafmOptions?: any;
  authToken?: string;
  sessionId?: string;
}

export interface LLMRequest {
  systemPrompt: string;
  userPrompt: string;
  options?: LLMCallOptions;
}

export interface LLMResponse {
  response: string;
  metadata?: any;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  costCalculation?: {
    totalCost: number;
  };
}

/**
 * Service for generating Python code that makes HTTP calls to the LLM service
 * This helps Python agents make proper LLM service calls with user preferences
 * and error handling
 */
@Injectable()
export class PythonLLMClientService {
  /**
   * Generate Python code for making LLM service calls
   */
  generateLLMServiceCallCode(
    llmServiceUrl: string = `http://localhost:${process.env.WEB_PORT || '9001'}/api/llm`,
    includeErrorHandling: boolean = true,
  ): string {
    return `
import requests
import json
from typing import Dict, Any, Optional

class LLMServiceClient:
    """Client for making HTTP calls to the NestJS LLM service"""
    
    def __init__(self, api_url: str = "${llmServiceUrl}"):
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
            ${
              includeErrorHandling
                ? `
            print(f"LLM service call failed: {e}", file=sys.stderr)
            # Fallback for development/testing
            return f"Generated response for: {user_prompt[:100]}..."
            `
                : `
            raise e
            `
            }
    
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
            options["providerName"] = provider_id
        if model_id:
            options["modelName"] = model_id
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

# Global client instance
llm_client = LLMServiceClient()
`;
  }

  /**
   * Generate Python code for a specific LLM call
   */
  generateSpecificCallCode(
    systemPrompt: string,
    userPromptVariable: string,
    optionsVariable?: string,
    resultVariable: string = 'llm_response',
  ): string {
    const optionsParam = optionsVariable ? `, ${optionsVariable}` : '';

    return `
# Make LLM service call
${resultVariable} = await llm_client.call_llm_service(
    system_prompt=\"\"\"${systemPrompt}\"\"\",
    user_prompt=${userPromptVariable}${optionsParam}
)
`;
  }

  /**
   * Generate Python code for agent-to-agent LLM calls
   */
  generateAgentCallCode(
    agentName: string,
    agentEndpoint: string,
    userMessageVariable: string,
    optionsVariable?: string,
  ): string {
    const optionsParam = optionsVariable ? `, ${optionsVariable}` : '';

    return `
async def call_${agentName.toLowerCase()}_agent(
    user_message: str,
    options: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Call the ${agentName} agent via HTTP API"""
    try:
        payload = {
            "userMessage": user_message,
            "options": options or {}
        }
        
        response = requests.post("${agentEndpoint}", json=payload)
        response.raise_for_status()
        
        return response.json()
        
    except Exception as e:
        print(f"Agent call to ${agentName} failed: {e}", file=sys.stderr)
        return {
            "response": f"Error calling ${agentName} agent: {str(e)}",
            "error": True
        }

# Call ${agentName} agent
${agentName.toLowerCase()}_result = await call_${agentName.toLowerCase()}_agent(
    ${userMessageVariable}${optionsParam}
)
`;
  }

  /**
   * Generate Python code for preference merging
   */
  generatePreferenceMergingCode(): string {
    return `
def merge_llm_preferences(
    base_options: Dict[str, Any],
    user_preferences: Dict[str, Any]
) -> Dict[str, Any]:
    """Merge user preferences with base LLM options"""
    merged = base_options.copy()
    
    # User preferences take priority
    preference_keys = [
        'providerName', 'modelName', 'temperature', 'maxTokens', 
        'cidafmOptions', 'authToken', 'sessionId'
    ]
    
    for key in preference_keys:
        if key in user_preferences and user_preferences[key] is not None:
            merged[key] = user_preferences[key]
    
    return merged

def extract_user_preferences(metadata: Dict[str, Any]) -> Dict[str, Any]:
    """Extract LLM preferences from agent metadata"""
    llm_prefs = metadata.get('llmPreferences', {})
    return {
        'providerName': llm_prefs.get('providerName'),
        'modelName': llm_prefs.get('modelName'),
        'temperature': llm_prefs.get('temperature'),
        'maxTokens': llm_prefs.get('maxTokens'),
        'cidafmOptions': llm_prefs.get('cidafmOptions'),
        'authToken': metadata.get('authToken'),
        'sessionId': metadata.get('sessionId')
    }
`;
  }

  /**
   * Generate complete Python LLM integration code
   */
  generateCompleteLLMIntegration(
    llmServiceUrl: string = `http://localhost:${process.env.WEB_PORT || '9001'}/api/llm`,
  ): string {
    return `
${this.generateLLMServiceCallCode(llmServiceUrl)}

${this.generatePreferenceMergingCode()}

# Usage example:
# user_prefs = extract_user_preferences(metadata)
# options = llm_client.create_options(**user_prefs)
# response = await llm_client.call_llm_service(system_prompt, user_prompt, options)
`;
  }

  /**
   * Create LLM request object for validation
   */
  createLLMRequest(
    systemPrompt: string,
    userPrompt: string,
    options?: LLMCallOptions,
  ): LLMRequest {
    return {
      systemPrompt,
      userPrompt,
      options,
    };
  }

  /**
   * Validate LLM request before sending to Python
   */
  validateLLMRequest(request: LLMRequest): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!request.systemPrompt || request.systemPrompt.trim().length === 0) {
      errors.push('System prompt is required');
    }

    if (!request.userPrompt || request.userPrompt.trim().length === 0) {
      errors.push('User prompt is required');
    }

    if (request.options?.temperature !== undefined) {
      if (request.options.temperature < 0 || request.options.temperature > 2) {
        errors.push('Temperature must be between 0 and 2');
      }
    }

    if (request.options?.maxTokens !== undefined) {
      if (request.options.maxTokens < 1 || request.options.maxTokens > 100000) {
        errors.push('Max tokens must be between 1 and 100000');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
