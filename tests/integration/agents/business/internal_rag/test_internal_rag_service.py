@pytest.mark.asyncio
async def test_internal_rag_process_message_success(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    """Test successful message processing for InternalRagAgentService."""
    client, _ = client_and_app
    mocked_mcp_response = "We have completed the document synthesis."
    
    try:
        INTERNAL_RAG_CONTEXT_FILE_PATH.read_text(encoding="utf-8")
    except FileNotFoundError:
        pytest.fail(f"Test setup error: Internal RAG context file not found at {INTERNAL_RAG_CONTEXT_FILE_PATH}")

    mock_query_aggregate = mocker.patch(
        "apps.api.agents.business.internal_rag.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        return_value=mocked_mcp_response
    )

    user_query = "Can you find information about company holidays?"
    request_payload = TaskSendParams(
        id="test-task-123",
        message=Message(role="user", parts=[TextPart(text=user_query)])
    ).model_dump(mode='json')

    response = await client.post("/agents/business/internal_rag/tasks", json=request_payload)
    assert response.status_code == 200
    response_data_full = response.json()
    
    assert response_data_full["id"] == "test-task-123"
    assert response_data_full["status"]["state"] == TaskState.COMPLETED.value
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    assert actual_response_text == mocked_mcp_response

    mock_query_aggregate.assert_called_once_with(
        agent_id=INTERNAL_RAG_MCP_TARGET_ID,
        user_query=user_query,
        session_id="test-task-123"
    ) 