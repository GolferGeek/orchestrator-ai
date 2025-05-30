import pytest
import httpx
import os
from pathlib import Path
import json

# Assumptions for endpoint paths:
SESSION_CREATE_PATH = "/sessions"
# ORCHESTRATOR_CHAT_PATH = "/api/v1/orchestrator/chat" # Moved to test_utils.py
AGENT_ENDPOINT_PREFIX = "/agents"

@pytest.fixture(scope="session")
def discovered_agents():
    """Discovers agents, their E2E test queries, and their markdown context."""
    agents = []
    # Path to the v1 directory, which is 2 levels up from e2e/ (e2e -> tests -> v1)
    v1_dir = Path(__file__).resolve().parents[2]
    markdown_context_dir = v1_dir / "markdown_context"
    agents_base_dir = v1_dir / "agents"
    
    print(f"\n[Discovered Agents Fixture] Scanning for agents in: {agents_base_dir}")
    print(f"[Discovered Agents Fixture] Looking for markdown context in: {markdown_context_dir}")

    if not agents_base_dir.is_dir():
        print(f"[Discovered Agents Fixture] WARNING: Agents base directory not found: {agents_base_dir}")
        return agents

    for category_dir in agents_base_dir.iterdir():
        if category_dir.is_dir() and not category_dir.name.startswith(('.', '_')):
            for agent_dir in category_dir.iterdir():
                if agent_dir.is_dir() and not agent_dir.name.startswith(('.', '_')):
                    agent_id = agent_dir.name
                    category = category_dir.name
                    print(f"  [Discovery] Found agent: {category}/{agent_id}")

                    # Try to load e2e_test_query.txt
                    query_file = agent_dir / "e2e_test_query.txt"
                    test_query = f"Tell me about {agent_id.replace('_', ' ')}." # Default query
                    if query_file.exists():
                        test_query = query_file.read_text().strip()
                        print(f"    [Discovery] Loaded E2E query for {agent_id}: '{test_query[:50]}...'")
                    else:
                        print(f"    [Discovery] No e2e_test_query.txt for {agent_id}, using default.")

                    # Try to load markdown context
                    md_file_path = markdown_context_dir / f"{agent_id}.md"
                    md_context = None
                    if md_file_path.exists():
                        md_context = md_file_path.read_text()
                        print(f"    [Discovery] Loaded markdown context for {agent_id} ({len(md_context)} bytes).")
                    else:
                        print(f"    [Discovery] WARNING: No markdown_context file for {agent_id} at {md_file_path}")

                    agents.append({
                        "id": agent_id, 
                        "category": category,
                        "test_query": test_query,
                        "markdown_context": md_context
                    })
    if not agents:
        print("[Discovered Agents Fixture] WARNING: No agents were discovered!")
    return agents

@pytest.fixture(scope="function")
async def e2e_session(api_key_auth_client: httpx.AsyncClient):
    """Creates a new session for E2E testing and yields the session_id.
    Uses api_key_auth_client to ensure real Test API Key authentication is active for session creation if needed,
    and for subsequent calls made using this client instance via the test.
    """
    print("\n[Session Fixture] Creating new E2E session using api_key_auth_client...")
    # The /sessions endpoint itself might be protected by get_current_authenticated_user, 
    # or it might use the authenticated user to associate the session.
    # Using api_key_auth_client ensures that if it is protected, the Test API Key auth path is taken.
    response = await api_key_auth_client.post(SESSION_CREATE_PATH, json={})
    response.raise_for_status()
    session_data = response.json()
    session_id = session_data.get("id")
    assert session_id, "session_id (now 'id') not found in new session response"
    print(f"[Session Fixture] Created session_id: {session_id} using api_key_auth_client")
    yield session_id
    # Teardown: Potentially delete session if API supports it and it's desired
    # print(f"[Session Fixture] Teardown for session_id: {session_id} (if implemented)")

# Helper function async def call_chat_endpoint(...) MOVED to test_utils.py
# Helper function def assert_non_trivial_answer(...) MOVED to test_utils.py 