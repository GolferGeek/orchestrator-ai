import httpx
import asyncio
import json
import pytest

# AGENT_ID can remain the same if it's a common test agent ID
AGENT_ID = "test_mcp_agent" 

@pytest.mark.asyncio
async def test_mcp_stream_receives_content_and_eos(api_base_url: str):
    """
    Tests the /mcp/stream/{AGENT_ID} endpoint.
    Ensures that content chunks are received and an end-of-stream event occurs.
    """
    endpoint_url = f"{api_base_url}/mcp/stream/{AGENT_ID}"
    request_payload = {
        "user_query": "What is the primary color and the secret passphrase?",
    }
    
    print(f"\nTesting SSE endpoint: {endpoint_url}")
    print(f"Request payload: {json.dumps(request_payload, indent=2)}")

    received_content_chunk = False
    received_eos = False
    all_chunks = []

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            async with client.stream("POST", endpoint_url, json=request_payload) as response:
                assert response.status_code == 200, f"Expected status 200, got {response.status_code}. Response: {''.join([line async for line in response.aiter_lines()])}"
                
                print("\n--- SSE Stream Events ---")
                async for line in response.aiter_lines():
                    print(line)
                    if line.startswith("data:"):
                        try:
                            data_json_str = line[len("data: "):]
                            if not data_json_str.strip():
                                continue
                            data_json = json.loads(data_json_str)
                            
                            if data_json.get("type") == "content" and "chunk" in data_json:
                                received_content_chunk = True
                                all_chunks.append(data_json.get("chunk"))
                                print(f"  └─ Chunk: {data_json.get('chunk')}", end="", flush=True)
                            elif data_json.get("type") == "eos":
                                print(f"\n  └─ End of Stream: {data_json.get('message')}")
                                received_eos = True
                                break 
                        except json.JSONDecodeError:
                            pytest.fail(f"Failed to parse JSON data: '{data_json_str}' from line: '{line}'")
                print("\n--- End of SSE Stream ---")

    except httpx.ConnectError as e:
        pytest.fail(f"Connection Error: Could not connect to {endpoint_url}. Ensure the API server is running. Details: {e}")
    except Exception as e:
        pytest.fail(f"An unexpected error occurred: {e}")
    
    assert received_content_chunk, "Did not receive any 'content' type chunk with data."
    assert received_eos, "Did not receive 'eos' (end-of-stream) event."
    print(f"Full reconstructed content: {''.join(all_chunks)}") 