#!/usr/bin/env python3
"""
Test script for the SSE MCP streaming endpoint.
"""
import httpx
import asyncio
import json

API_BASE_URL = "http://localhost:8000"  # Adjust if your API runs on a different port/host
AGENT_ID = "test_mcp_agent" # The agent_id for which we created a context file

async def test_mcp_stream():
    endpoint_url = f"{API_BASE_URL}/mcp/stream/{AGENT_ID}"
    request_payload = {
        "user_query": "What is the primary color and the secret passphrase?",
        # "llm_settings": {
        #     "model_name": "gpt-3.5-turbo",
        #     "temperature": 0.5
        # },
        # "conversation_history": [
        #     {"role": "user", "content": "Hello there!"},
        #     {"role": "assistant", "content": "Hi! I am the test agent."}
        # ]
    }

    print(f"Connecting to SSE endpoint: {endpoint_url}")
    print(f"Request payload: {json.dumps(request_payload, indent=2)}\n")

    try:
        async with httpx.AsyncClient(timeout=None) as client: # Disable timeout for long streams
            async with client.stream("POST", endpoint_url, json=request_payload) as response:
                print(f"Response status code: {response.status_code}\n")
                if response.status_code != 200:
                    print("Error connecting to stream:")
                    async for line in response.aiter_lines():
                        print(line)
                    return

                print("--- SSE Stream Events ---")
                async for line in response.aiter_lines():
                    if line.startswith("event:"):
                        print(f"\n{line}") # Print event type line
                    elif line.startswith("data:"):
                        print(line) # Print data line
                        # Optionally, parse and pretty-print JSON data
                        try:
                            data_json = json.loads(line[len("data: "):])
                            # print(f"Parsed data: {json.dumps(data_json, indent=2)}")
                            if data_json.get("type") == "content":
                                print(f"  └─ Chunk: {data_json.get('chunk')}", end="", flush=True)
                            elif data_json.get("type") == "eos":
                                print(f"\n  └─ End of Stream: {data_json.get('message')}")
                                break # Exit after eos
                            else:
                                print(f"  └─ Data: {json.dumps(data_json)}")
                        except json.JSONDecodeError:
                            print(f"  └─ Could not parse data: {line[len('data: '):]}")
                    elif line:
                        print(line) # Print any other non-empty lines
                print("\n--- End of SSE Stream ---")

    except httpx.ConnectError as e:
        print(f"Connection Error: Could not connect to {endpoint_url}. Ensure the API server is running.")
        print(f"Details: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    print("Ensure your FastAPI server is running (e.g., uvicorn apps.api.main:app --reload)")
    print("Ensure OPENAI_API_KEY is set in your environment.\n")
    asyncio.run(test_mcp_stream()) 