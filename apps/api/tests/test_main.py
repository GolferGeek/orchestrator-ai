import pytest
from httpx import AsyncClient
from fastapi import FastAPI

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