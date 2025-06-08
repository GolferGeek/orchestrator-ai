# Python - FastAPI Implementation

This directory contains the source code for the **Orchestrator AI API**, implemented using Python and FastAPI.

## Key Characteristics

- **Production Ready:** Stable, battle-tested API implementation serving as the primary interface
- **Self-Contained:** Complete implementation with its own dependencies and configurations
- **Agent-Based Architecture:** Comprehensive agent ecosystem for various business functions

## Current Status: ✅ **STABLE & WORKING**

The API provides a robust, production-ready implementation:
- **Proven Architecture**: Battle-tested agent implementation patterns
- **Frontend Compatibility**: Full compatibility with the Vue.js frontend
- **Customer Ready**: Professional implementation suitable for customer deployment
- **Comprehensive Features**: Complete agent ecosystem with orchestration capabilities

## Structure

Current structure includes:
- `agents/`: Business logic for different agents organized by category
- `core/`: Core application settings and configurations
- `a2a_protocol/`: Agent-to-agent communication protocols
- `auth/`: Authentication and authorization systems
- `sessions/`: Session management functionality
- `main.py`: FastAPI application entry point
- `pyproject.toml`: Python dependencies managed with PDM

## Ports & Deployment

- **Port**: 8000 (configurable via environment)
- **Environment**: Supports dev, test, and prod configurations  
- **Container**: Docker setup with PDM package management
- **Scaling**: Ready for production deployment with Docker Compose

## Agent Categories

The API includes comprehensive agent coverage:
- **Business**: Internal RAG, invoicing, metrics, SOPs
- **Customer Service**: Chat support, email triage, voice receptionist
- **Marketing**: Blog posts, content creation, lead management
- **HR**: Onboarding, policy management, HR assistance
- **Development**: Requirements writing, project management
- **External**: Market research, competitor analysis 