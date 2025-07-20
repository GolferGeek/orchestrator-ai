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
            "userMessage": task_data.get("userMessage", task_data.get("user_message", "")),
            "sessionId": task_data.get("sessionId", task_data.get("session_id")),
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
        "userMessage": user_message,
        "sessionId": session_id,
        "metadata": additional_context or {}
    }
    
    if additional_context:
        task_data.update(additional_context)
    
    return task_data


# Specialist agent call functions
# These are designed to work both now (with fallbacks) and later (with real specialists)

async def call_writer_specialist(
    writer_type: str,
    task_data: Dict[str, Any]
) -> str:
    """Call a writer specialist agent"""
    result = await call_specialist_agent(
        agent_type="specialist",
        agent_category="writers", 
        agent_name=writer_type,
        task_data=task_data
    )
    
    if result.get("error"):
        return f"Error calling {writer_type} specialist: {result.get('response', 'Unknown error')}"
    
    return result.get("response", "")


async def call_analyst_specialist(
    analyst_type: str,
    task_data: Dict[str, Any]
) -> Dict[str, Any]:
    """Call an analyst specialist agent"""
    result = await call_specialist_agent(
        agent_type="specialist",
        agent_category="analysts", 
        agent_name=analyst_type,
        task_data=task_data
    )
    
    if result.get("error"):
        return {"analysis": f"Error calling {analyst_type} analyst: {result.get('response', 'Unknown error')}"}
    
    return result


async def call_validator_specialist(
    validator_type: str,
    task_data: Dict[str, Any]
) -> Dict[str, Any]:
    """Call a validator specialist agent"""
    result = await call_specialist_agent(
        agent_type="specialist",
        agent_category="validators", 
        agent_name=validator_type,
        task_data=task_data
    )
    
    if result.get("error"):
        return {"validation": f"Error calling {validator_type} validator: {result.get('response', 'Unknown error')}"}
    
    return result


# Convenience functions for common specialist calls
# These will be updated when actual specialists are implemented

async def call_prd_writer(requirements_data: Dict[str, Any]) -> str:
    """Call PRD Writer specialist agent"""
    return await call_writer_specialist("prd_writer", requirements_data)


async def call_technical_writer(requirements_data: Dict[str, Any]) -> str:
    """Call Technical Requirements Writer specialist agent"""
    return await call_writer_specialist("technical_writer", requirements_data)


async def call_api_designer(requirements_data: Dict[str, Any]) -> str:
    """Call API Designer specialist agent"""
    return await call_writer_specialist("api_designer", requirements_data)


async def call_requirements_analyst(analysis_data: Dict[str, Any]) -> Dict[str, Any]:
    """Call Requirements Analyst specialist agent"""
    return await call_analyst_specialist("requirements_analyst", analysis_data)


async def call_complexity_assessor(assessment_data: Dict[str, Any]) -> Dict[str, Any]:
    """Call Complexity Assessor specialist agent"""
    return await call_analyst_specialist("complexity_assessor", assessment_data)


async def call_requirements_validator(validation_data: Dict[str, Any]) -> Dict[str, Any]:
    """Call Requirements Validator specialist agent"""
    return await call_validator_specialist("requirements_validator", validation_data)