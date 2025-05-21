from apps.api.a2a_protocol.unified_agent_service import A2AUnifiedAgentService
from apps.api.a2a_protocol.types import AgentCard, AgentCapability, Message, TextPart, TaskState # Added TaskState
from apps.api.a2a_protocol.task_store import TaskStoreService # For type hinting
from apps.api.shared.mcp.mcp_client import MCPClient, MCPError, MCPConnectionError, MCPTimeoutError
from typing import Optional, List, Dict, Any
import httpx # For http_client type hint
import os # For loading context path or other configs
from pathlib import Path # For context file path
import logging # Ensure logging is available
from fastapi import HTTPException

class MetricsAgentService(A2AUnifiedAgentService):
    """
    The Metrics Agent, responsible for providing business metrics and data analysis.
    It typically interacts with a backend (e.g., MCP) to fetch and process data.
    """

    # --- A2AUnifiedAgentService Class Attributes ---
    agent_id: str = "metrics-agent-v1"  # Stable ID for the metrics agent
    agent_name: str = "metrics"  # Path-friendly name
    display_name: str = "Metrics Agent" # UI-friendly name
    agent_description: str = "Provides access to business metrics and analytics data"
    agent_version: str = "1.0.0" 
    department_name: str = "business"
    
    primary_capability_name: str = "metrics_analysis"
    primary_capability_description: str = (
        "Analyzes data and provides reports on various business metrics such as sales, "
        "user activity, and financial performance."
    )
    
    is_sticky: bool = False # Typically, a metrics query is transactional
    sticky_duration: int = 30

    # --- Metrics-Specific Attributes ---
    # These would be equivalent to what McpContextAgentBase used to manage
    CONTEXT_FILE_NAME: Optional[str] = "metrics_agent_context.md"
    MCP_TARGET_AGENT_ID: Optional[str] = "metrics_agent" # Changed from "metrics-backend"
    # ^ This ID is what the MCP service (e.g., llm_mcp) uses to find the context for the *backend* it calls.

    def __init__(self, 
                 task_store: TaskStoreService, 
                 http_client: httpx.AsyncClient, 
                 mcp_client: MCPClient,
                 **kwargs: Any):
        
        super().__init__(
            task_store=task_store, 
            http_client=http_client,
            agent_name=kwargs.pop('agent_name', self.agent_name),
            department_name=kwargs.pop('department_name', self.department_name),
            **kwargs
        )
        
        self.mcp_client = mcp_client # Store the mcp_client
        self.agent_context_content: Optional[str] = None # Initialize attribute
        if self.CONTEXT_FILE_NAME:
            try:
                # Path construction needs to be robust. Assuming a location.
                # Example: project_root/markdown_context/metrics_agent_context.md
                # Adjust depth: service.py (metrics) -> business -> agents -> api -> apps -> root
                self.project_root = Path(__file__).resolve().parents[4] 
                self.context_file_full_path = self.project_root / "markdown_context" / self.CONTEXT_FILE_NAME
                if self.context_file_full_path.exists():
                    self.agent_context_content = self.context_file_full_path.read_text(encoding="utf-8")
                    self.logger.info(f"Successfully loaded context from {self.context_file_full_path}")
                else:
                    self.logger.warning(f"Context file not found at expected path: {self.context_file_full_path}")
            except Exception as e:
                self.logger.error(f"Error loading context file {self.CONTEXT_FILE_NAME}: {e}", exc_info=True)
        else:
            self.logger.warning("CONTEXT_FILE_NAME not set for MetricsAgentService. Agent will operate without pre-loaded context.")

        self.logger.info(f"MetricsAgentService ({self.agent_name}) initialized.")

    async def get_agent_card(self) -> AgentCard:
        """Return the agent card with capabilities."""
        base_agent_path = f"/agents/{self.department_name}/{self.agent_name}"
        return AgentCard(
            id=self.agent_id,
            name=self.display_name,
            description=self.agent_description,
            version=self.agent_version,
            type="unified",
            endpoints=[f"{base_agent_path}/tasks"],
            capabilities=self.get_capabilities()
        )

    async def execute_agent_task(
        self, 
        message: Message, 
        task_id: str, 
        session_id: Optional[str] = None
    ) -> str:
        """
        Core logic for the Metrics agent.
        Uses injected MCPClient to query backend, passing agent_id for context loading by MCP service.
        """
        self.logger.info(f"MetricsAgent ({self.agent_name}) executing task '{task_id}' for session '{session_id}'.")
        
        user_query = ""
        if message.parts:
            first_part_model = message.parts[0]
            if isinstance(first_part_model.root, TextPart):
                user_query = first_part_model.root.text

        if not user_query.strip():
            self.logger.warning(f"Task {task_id}: Empty user query received.")
            await self.task_store.update_task_status(task_id, TaskState.FAILED)
            return "Please provide a query for metrics analysis."

        try:
            response = await self.mcp_client.query_agent_aggregate(
                agent_id=self.MCP_TARGET_AGENT_ID,
                user_query=user_query,
                session_id=session_id
            )
            await self.task_store.update_task_status(task_id, TaskState.COMPLETED)
            return response
        except MCPConnectionError as e:
            self.logger.error(f"Connection error with MCP service: {str(e)}")
            await self.task_store.update_task_status(task_id, TaskState.FAILED)
            return f"Unable to connect to metrics service. Please try again later. Error: {str(e)}"
        except MCPTimeoutError as e:
            self.logger.error(f"Timeout error with MCP service: {str(e)}")
            await self.task_store.update_task_status(task_id, TaskState.FAILED)
            return f"Request to metrics service timed out. Please try again. Error: {str(e)}"
        except MCPError as e:
            self.logger.error(f"Error from MCP service: {str(e)}")
            await self.task_store.update_task_status(task_id, TaskState.FAILED)
            return f"Error processing metrics request: {str(e)}"
        except Exception as e:
            self.logger.error(f"Unexpected error: {str(e)}", exc_info=True)
            await self.task_store.update_task_status(task_id, TaskState.FAILED)
            return f"An unexpected error occurred while processing your request: {str(e)}"

    async def get_a2a_agent_card_discovery_format(self) -> Dict[str, Any]:
        """Get the agent card in A2A discovery format."""
        agent_card = await self.get_agent_card()
        capabilities = [cap.name for cap in agent_card.capabilities] if isinstance(agent_card.capabilities[0], AgentCapability) else [cap["name"] for cap in agent_card.capabilities]
        
        return {
            "name": self.display_name,  # Use the UI-friendly name for discovery
            "display_name": self.display_name,  # Use the UI-friendly name
            "description": agent_card.description,
            "version": agent_card.version,
            "api_version": "1.0.0",
            "schema_version": "a2a-v1",
            "endpoints": agent_card.endpoints,
            "capabilities": capabilities,
            "limitations": [],
            "routing": {},
            "auth_requirements": None,
            "is_sticky": self.is_sticky,
            "sticky_duration": self.sticky_duration if self.is_sticky else None,
            "department": self.department_name,
            "agent_id_stable": self.agent_id
        }

    def get_capabilities(self) -> List[AgentCapability]:
        """Return the capabilities of the Metrics agent."""
        return [
            AgentCapability(
                name="metrics_analysis",
                description="Analyze and report on business metrics and KPIs"
            ),
            AgentCapability(
                name="data_visualization_preparation",
                description="Prepare data for visualization and charting to represent insights"
            ),
            AgentCapability(
                name="trend_reporting",
                description="Identify and analyze trends in business metrics over time"
            ),
            AgentCapability(
                name="custom_query_execution",
                description="Execute custom metrics queries based on user requirements"
            )
        ]

    # Other methods specific to MetricsAgentService if needed. 