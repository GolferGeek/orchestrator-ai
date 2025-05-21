import pytest
import httpx
from datetime import datetime, timezone

# Import helpers from the new test_utils.py
from apps.api.v1.tests.e2e.test_utils import (
    call_orchestrator_task_endpoint,
    assert_non_trivial_answer,
    ORCHESTRATOR_TASKS_PATH
)

# AGENT_ENDPOINT_PREFIX needs to be defined or imported as well if used directly
# From conftest.py, it was: AGENT_ENDPOINT_PREFIX = "/api/v1/agents"
# Let's define it here for clarity, or it could also go into test_utils.py
AGENT_ENDPOINT_PREFIX = "/agents" 

# Add imports for types used in direct agent call
from apps.api.v1.a2a_protocol.types import TaskSendParams, Message, TextPart, Part

@pytest.mark.e2e
@pytest.mark.asyncio
async def test_agent_workflow_via_orchestrator_and_direct(
    api_key_auth_client: httpx.AsyncClient, # Changed from authenticated_client
    e2e_session: str, 
    discovered_agents 
):
    """
    Tests a full workflow for each discovered agent:
    1. Call the agent via the Orchestrator.
    2. Call the agent via its direct endpoint.
    Verifies non-trivial answers for both.
    Session is managed by the e2e_session fixture.
    Client uses real API Key Auth.
    """
    if not discovered_agents:
        pytest.skip("No agents discovered, skipping E2E workflow test.")
    
    session_id = e2e_session 
    
    for agent_info in discovered_agents:
        agent_id = agent_info["id"]
        category = agent_info["category"]
        test_query = agent_info["test_query"]
    
        print(f"\n--- Testing Agent: {category}/{agent_id} ---")
        print(f"Test Query: '{test_query}'")
    
        # 1. Test via Orchestrator
        print(f"[Orchestrator Path] for {category}/{agent_id}")
        try:
            orchestrator_response_data = await call_orchestrator_task_endpoint(
                api_key_auth_client, # Changed client instance
                session_id,
                test_query
            )
            # orchestrator_answer = orchestrator_response_data.get("response", "") # Old way based on simple dict
            orchestrator_answer = get_answer_from_task_response(orchestrator_response_data)
            assert_non_trivial_answer(orchestrator_response_data, test_query, agent_id, "Orchestrator") # Pass full data
            print(f"[Orchestrator Path] SUCCESS for {category}/{agent_id}")
        except Exception as e:
            pytest.fail(f"[Orchestrator Path] FAILED for {category}/{agent_id}. Query: '{test_query}'. Error: {e}")

        # 2. Test via Direct Agent Call (if not orchestrator itself)
        if agent_id != "orchestrator": # Avoid orchestrator calling itself directly in this part of test
            print(f"[Direct Path] for {category}/{agent_id}")
            try:
                direct_response_data = await call_direct_agent_task_endpoint(
                    api_key_auth_client, # Changed client instance
                    session_id, 
                    test_query, 
                    category, 
                    agent_id
                )
                # direct_answer = direct_response_data.get("response", "") # Old way
                direct_answer = get_answer_from_task_response(direct_response_data)
                assert_non_trivial_answer(direct_response_data, test_query, agent_id, "Direct") # Pass full data
                print(f"[Direct Path] SUCCESS for {category}/{agent_id}")
            except Exception as e:
                pytest.fail(f"[Direct Path] FAILED for {category}/{agent_id}. Query: '{test_query}'. Error: {e}")
        else:
            print(f"[Direct Path] SKIPPED for {category}/{agent_id} (is orchestrator)")

    print("\n--- All discovered agent workflows tested successfully. ---") 