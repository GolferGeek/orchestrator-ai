# apps/api/agents/development/requirements_writer/main.py
from fastapi import APIRouter, Body
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from enum import Enum

router = APIRouter()

class RequirementType(str, Enum):
    FUNCTIONAL = "functional"
    NON_FUNCTIONAL = "non-functional"
    TECHNICAL = "technical"
    USER_STORY = "user_story"
    EPIC = "epic"

class RequirementsRequest(BaseModel):
    project_name: str
    project_description: str
    stakeholders: List[str]
    format: Optional[RequirementType] = RequirementType.FUNCTIONAL
    include_acceptance_criteria: Optional[bool] = True
    include_priority: Optional[bool] = True
    tech_stack: Optional[List[str]] = None

@router.get("/")
async def requirements_writer_root():
    return {"agent": "requirements_writer", "message": "Requirements Writer agent is active"}

@router.get("/.well-known/agent.json")
async def get_requirements_writer_agent_discovery():
    return {
        "name": "Requirements Writer Agent",
        "description": "Generates software requirements specifications based on project descriptions.",
        "a2a_protocol_version": "0.1.0",
        "endpoints": [
            {
                "path": "/",
                "methods": ["GET"],
                "description": "Get Requirements Writer agent status."
            },
            {
                "path": "/generate",
                "methods": ["POST"],
                "description": "Generate software requirements based on project details."
            },
            {
                "path": "/refine",
                "methods": ["POST"],
                "description": "Refine existing requirements with additional context."
            }
        ]
    }

@router.post("/generate")
async def generate_requirements(request: RequirementsRequest):
    """
    Generate comprehensive software requirements based on project description.
    """
    return {
        "status": "success",
        "message": "Requirements generation initiated",
        "requirements": {
            "project": request.project_name,
            "format": request.format,
            "requirements": [
                # This will be populated with AI-generated content
                "REQ-001: The system shall [requirement placeholder]",
                "REQ-002: The system shall [requirement placeholder]"
            ],
            "metadata": {
                "stakeholders": request.stakeholders,
                "tech_stack": request.tech_stack or []
            }
        }
    }

@router.post("/refine")
async def refine_requirements(
    existing_requirements: List[str],
    additional_context: str,
    stakeholder_feedback: Optional[Dict[str, Any]] = None
):
    """
    Refine existing requirements based on new information or feedback.
    """
    return {
        "status": "success",
        "message": "Requirements refinement completed",
        "refined_requirements": [
            # This will be populated with AI-refined content
            "REQ-001-REFINED: The system shall [refined requirement]",
        ],
        "change_log": [
            {
                "original": "Original requirement text",
                "refined": "Refined requirement text",
                "reason": "Explanation for the change based on feedback"
            }
        ]
    } 