import pytest
from httpx import AsyncClient # Should be imported by conftest's client_and_app
from fastapi import FastAPI # Should be imported by conftest's client_and_app

# The client_and_app fixture will be picked up from tests/integration/conftest.py

@pytest.mark.asyncio
async def test_read_root(client_and_app: tuple[AsyncClient, FastAPI]):
    client, _ = client_and_app
    response = await client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Welcome to Orchestrator AI API"}

@pytest.mark.asyncio
async def test_health_check(client_and_app: tuple[AsyncClient, FastAPI]):
    client, _ = client_and_app
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"} 