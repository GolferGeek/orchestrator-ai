# ExternalA2AAgentBaseService

A lightweight proxy service for connecting to external A2A (Agent-to-Agent) protocol compliant agents.

## Overview

The `ExternalA2AAgentBaseService` acts as a local representative for remote A2A-compliant agents. Unlike other agent base services, it does **NOT** extend `A2AAgentBaseService` because external agents already implement the full A2A protocol.

## Architecture

```
┌─────────────────────────────────────────┐
│ Local Orchestrator                      │
│ ┌─────────────────────────────────────┐ │
│ │ ExternalA2AAgentBaseService         │ │
│ │ (Lightweight Proxy)                 │ │
│ │                                     │ │
│ │ • Reads agent.yaml config           │ │
│ │ • Discovers remote capabilities     │ │
│ │ • Registers with local agent pool   │ │
│ │ • Forwards requests                 │ │
│ │ • Handles local logging/evaluation  │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
                    │
                    │ HTTP/HTTPS
                    │ JSON-RPC 2.0
                    ▼
┌─────────────────────────────────────────┐
│ Remote A2A Agent                        │
│ (e.g., Google's Hello World Agent)     │
│                                         │
│ • /.well-known/agent.json              │
│ • Full A2A protocol implementation     │
│ • Task execution endpoints             │
│ • Own lifecycle management             │
└─────────────────────────────────────────┘
```

## Features

- **Configuration-driven**: Uses `agent.yaml` files for local configuration
- **Auto-discovery**: Fetches remote agent capabilities from `/.well-known/agent.json`
- **Local registration**: Registers remote agents with local agent pool
- **Request forwarding**: Proxies requests to external agents with retry logic
- **Authentication**: Supports multiple auth types (API key, Bearer, Basic, OAuth)
- **Error handling**: Comprehensive error tracking and retry mechanisms
- **Evaluation integration**: Metrics, logging, and performance monitoring
- **Type safety**: Full TypeScript support with proper interfaces

## Configuration

### agent.yaml Structure

```yaml
name: "External Agent Name"
description: "Description of the external agent"
version: "1.0.0"
type: "external"

external_a2a_configuration:
  endpoint: "${EXTERNAL_AGENT_ENDPOINT}"
  protocol: "A2A"
  timeout: 30000
  
  authentication:
    type: "api_key"  # none, api_key, bearer, basic, oauth
    header: "X-API-Key"
    value: "${EXTERNAL_AGENT_API_KEY}"
  
  retry:
    attempts: 3
    delay: 1000
    backoff: "exponential"  # linear or exponential
  
  required_env_vars:
    - "EXTERNAL_AGENT_ENDPOINT"
    - "EXTERNAL_AGENT_API_KEY"

metadata:
  category: "external"
  provider: "vendor_name"
  tags: ["external", "category"]
```

### Environment Variables

Set these in your `.env` file:

```bash
# Example for Google Hello World agent
GOOGLE_HELLO_WORLD_ENDPOINT=https://hello-world-agent.googleapis.com
GOOGLE_HELLO_WORLD_API_KEY=your_api_key_here
```

## Usage

### Basic Setup

1. **Create agent directory**:
   ```
   src/agents/demo/external/my-external-agent/
   ├── agent.yaml
   └── agent-service.ts (optional)
   ```

2. **Configure agent.yaml** with external agent details

3. **Set environment variables** for authentication

4. **The service will automatically**:
   - Load local configuration
   - Discover remote agent capabilities
   - Register with local agent pool
   - Handle request forwarding

### Programmatic Usage

```typescript
import { ExternalA2AAgentBaseService } from '@agents/base/implementations/base-services';

// Service is automatically instantiated by NestJS DI
// and initialized via agent discovery process

// Execute tasks through the proxy
const result = await externalAgentService.executeTask('greet', {
  name: 'Alice',
  language: 'en'
});
```

## Authentication Types

### API Key
```yaml
authentication:
  type: "api_key"
  header: "X-API-Key"
  value: "${API_KEY}"
```

### Bearer Token
```yaml
authentication:
  type: "bearer"
  value: "${BEARER_TOKEN}"
```

### Basic Auth
```yaml
authentication:
  type: "basic"
  key: "${USERNAME}"
  value: "${PASSWORD}"
```

### No Authentication
```yaml
authentication:
  type: "none"
```

## Error Handling

The service includes comprehensive error handling:

- **Connection errors**: Automatic retry with configurable backoff
- **Authentication errors**: Clear error messages and logging
- **Timeout handling**: Configurable timeouts for different operations
- **Validation errors**: Input/output validation with detailed feedback
- **Circuit breaker**: Prevents cascading failures

## Monitoring & Evaluation

The service integrates with our evaluation system:

- **Request/response logging**: All interactions are logged
- **Performance metrics**: Response times, success rates, error counts
- **Error tracking**: Detailed error categorization and tracking
- **Health monitoring**: Optional health check endpoints

## Discovery Process

1. **Load Configuration**: Reads `agent.yaml` from agent directory
2. **Validate Config**: Ensures required fields and environment variables
3. **Discover Remote Agent**: Fetches `/.well-known/agent.json` from remote endpoint
4. **Register Locally**: Adds remote agent to local agent pool with discovered capabilities
5. **Ready for Requests**: Service is now ready to proxy requests

## Request Flow

1. **Receive Request**: Local orchestrator sends task to proxy
2. **Prepare Request**: Format as JSON-RPC 2.0 with proper authentication
3. **Forward Request**: Send to remote agent with retry logic
4. **Process Response**: Validate and transform response
5. **Return Result**: Send back to local orchestrator with metadata

## Testing

Example test agent configuration (Google Hello World):

```yaml
# apps/api/src/agents/demo/external/google-hello-world/agent.yaml
external_a2a_configuration:
  endpoint: "https://hello-world-agent.googleapis.com"
  authentication:
    type: "api_key"
    header: "X-API-Key"
    value: "${GOOGLE_HELLO_WORLD_API_KEY}"
```

## Troubleshooting

### Common Issues

1. **"Agent path not set"**: Ensure the service is properly initialized through agent discovery
2. **"No external A2A configuration found"**: Check `agent.yaml` has `external_a2a_configuration` section
3. **"Remote agent discovery failed"**: Verify endpoint URL and authentication credentials
4. **"Registration failed"**: Check local agent pool service is running

### Debug Logging

Enable debug logging to see detailed request/response flow:

```bash
LOG_LEVEL=debug npm run start:dev
```

## Security Considerations

- **Environment Variables**: Never commit API keys or sensitive data
- **HTTPS Only**: Always use HTTPS endpoints for external agents
- **Credential Rotation**: Implement regular credential rotation
- **Network Security**: Consider VPN or private networking for sensitive agents
- **Input Validation**: All inputs are validated before forwarding

## Performance

- **Connection Pooling**: HTTP connections are reused for efficiency
- **Retry Logic**: Exponential backoff prevents overwhelming external services
- **Caching**: Agent capabilities are cached after discovery
- **Timeout Management**: Configurable timeouts prevent hanging requests

## Contributing

When adding new external agents:

1. Create agent directory under `src/agents/demo/external/`
2. Add proper `agent.yaml` configuration
3. Document required environment variables
4. Test with actual external agent endpoint
5. Add to agent discovery process 