"""Agent-to-agent HTTP call utilities for specialist agent integration"""

import requests
import json
import sys
from typing import Dict, Any, Optional


async def call_specialist_agent(
    agent_type: str,
    agent_category: str, 
    agent_name: str,
    task_data: Dict[str, Any],
    base_url: str = "http://localhost:3000/api"
) -> Dict[str, Any]:
    """Call a specialist agent via HTTP API"""
    try:
        # Construct the specialist agent endpoint
        # Format: /agent-pool/agents/specialist/{category}/{name}/tasks
        endpoint = f"{base_url}/agent-pool/agents/{agent_type}/{agent_category}/{agent_name}/tasks"
        
        payload = {
            "userMessage": task_data.get("user_message", ""),
            "sessionId": task_data.get("session_id"),
            "metadata": task_data.get("metadata", {}),
            **task_data
        }
        
        response = requests.post(endpoint, json=payload)
        response.raise_for_status()
        
        return response.json()
        
    except Exception as e:
        print(f"Specialist agent call to {agent_name} failed: {e}", file=sys.stderr)
        return {
            "response": f"Error calling {agent_name} specialist: {str(e)}",
            "error": True,
            "fallback": True
        }


async def call_agent_endpoint(
    endpoint: str,
    payload: Dict[str, Any],
    base_url: str = "http://localhost:3000/api"
) -> Dict[str, Any]:
    """Call any agent endpoint with payload"""
    try:
        full_url = f"{base_url}{endpoint}" if not endpoint.startswith('http') else endpoint
        
        response = requests.post(full_url, json=payload)
        response.raise_for_status()
        
        return response.json()
        
    except Exception as e:
        print(f"Agent endpoint call to {endpoint} failed: {e}", file=sys.stderr)
        return {
            "response": f"Error calling agent endpoint: {str(e)}",
            "error": True,
            "fallback": True
        }


def create_agent_task_data(
    user_message: str,
    session_id: str,
    additional_context: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Create standardized task data for agent calls"""
    task_data = {
        "user_message": user_message,
        "session_id": session_id,
        "metadata": additional_context or {}
    }
    
    if additional_context:
        task_data.update(additional_context)
    
    return task_data


# Future: When specialist agents are built, these will be real calls
# For now, they serve as placeholders that can be implemented later

async def call_prd_writer(requirements_data: Dict[str, Any]) -> str:
    """Call PRD Writer specialist agent (placeholder)"""
    # Future implementation will call actual specialist
    result = await call_specialist_agent(
        agent_type="specialist",
        agent_category="writers", 
        agent_name="prd_writer",
        task_data=requirements_data
    )
    
    # For now, return a fallback until specialist is built
    if result.get("error"):
        return generate_prd_fallback(requirements_data)
    
    return result.get("response", "")


async def call_technical_writer(requirements_data: Dict[str, Any]) -> str:
    """Call Technical Requirements Writer specialist agent (placeholder)"""
    result = await call_specialist_agent(
        agent_type="specialist",
        agent_category="writers", 
        agent_name="technical_writer",
        task_data=requirements_data
    )
    
    if result.get("error"):
        return generate_trd_fallback(requirements_data)
    
    return result.get("response", "")


async def call_requirements_analyst(analysis_data: Dict[str, Any]) -> Dict[str, Any]:
    """Call Requirements Analyst specialist agent (placeholder)"""
    result = await call_specialist_agent(
        agent_type="specialist",
        agent_category="analysts", 
        agent_name="requirements_analyst",
        task_data=analysis_data
    )
    
    if result.get("error"):
        return {"analysis": "Basic analysis pending specialist implementation"}
    
    return result


# Fallback functions for when specialists aren't available yet
def generate_prd_fallback(data: Dict[str, Any]) -> str:
    """Fallback PRD generation until specialist is available"""
    return f"""# Product Requirements Document (Generated via Fallback)

## Overview
Based on: {data.get('user_message', 'No requirements provided')}

## Note
This is a fallback response. Full PRD generation will be available when the PRD Writer specialist agent is implemented.

## Next Steps
- Implement PRD Writer specialist agent
- Integrate with this requirements writer workflow
"""


def generate_trd_fallback(data: Dict[str, Any]) -> str:
    """Fallback TRD generation until specialist is available"""
    return f"""# Technical Requirements Document (Generated via Fallback)

## Overview
Based on: {data.get('user_message', 'No requirements provided')}

## Note
This is a fallback response. Full TRD generation will be available when the Technical Writer specialist agent is implemented.

## Next Steps
- Implement Technical Writer specialist agent
- Integrate with this requirements writer workflow
"""