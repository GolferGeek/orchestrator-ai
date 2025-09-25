# External A2A Agent Rules

This document defines the standards, patterns, and implementation guidelines for creating external A2A agents in the OrchestratorAI system. External A2A agents are lightweight proxy services that connect to remote A2A-compliant agents, enabling integration with external agent ecosystems while maintaining local control and monitoring.

## Table of Contents

1. [Agent Definition & Types](#agent-definition--types)
2. [File Structure](#file-structure)
3. [Agent Configuration Schema](#agent-configuration-schema)
4. [External A2A Patterns](#external-a2a-patterns)
5. [Implementation Examples](#implementation-examples)
6. [Authentication & Security](#authentication--security)
7. [Testing Requirements](#testing-requirements)

---

## Agent Definition & Types

### What is an External A2A Agent?

An external A2A agent is a lightweight proxy service that acts as a local representative for remote A2A-compliant agents. Unlike other agent types that implement functionality locally, external A2A agents forward requests to external systems while providing local integration, monitoring, and control capabilities.

### Key Characteristics:
- **Proxy Architecture**: Acts as a lightweight proxy to remote A2A agents
- **Protocol Compliance**: Maintains full A2A protocol compatibility
- **Local Integration**: Provides local logging, evaluation, and monitoring
- **Authentication Management**: Handles complex authentication flows with external systems
- **Fault Tolerance**: Implements retry logic and error handling for external dependencies
- **Discovery & Registration**: Discovers remote capabilities and registers locally

### External A2A Agent Architecture

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
│ (e.g., Hiverarchy AI Orchestrator)      │
│                                         │
│ • /.well-known/agent.json              │
│ • Full A2A protocol implementation     │
│ • Task execution endpoints             │
│ • Own lifecycle management             │
└─────────────────────────────────────────┘
```

### Example: Hiverarchy AI Orchestrator (External A2A Agent)

The Hiverarchy AI Orchestrator is an external A2A agent that connects to a remote Hiverarchy AI system for advanced content creation and orchestration. It demonstrates complex authentication, parameter transformation, and intelligent delegation to external specialist agents.

**Agent Path**: `apps/api/src/agents/hidden/hiverarchy`
**Configuration File**: `agent.yaml`

```yaml
# Hiverarchy AI Orchestrator External A2A Agent Configuration
name: "Hiverarchy AI Orchestrator"
description: "Advanced content creation specialist powered by Hiverarchy AI. Expert in blog posts, articles, and structured content development with intelligent multi-agent collaboration. Perfect for high-quality, comprehensive content writing projects."
version: "1.0.0"
type: "external"

# External A2A configuration
external_a2a_configuration:
  # Remote agent endpoint (hiverarchy orchestrator like front-end calls us)
  endpoint: "${HIVERARCHY_EXTERNAL_ENDPOINT:-http://localhost:4100/agents/orchestrator/orchestrator/tasks}"
  protocol: "A2A"
  
  # Connection settings
  timeout: 60000  # 60 seconds
  
  # Authentication configuration for external systems
  authentication:
    type: "login"
    login_endpoint: "http://localhost:4100/auth/login"
    username: "${HIVERARCHY_API_USER}"
    password: "${HIVERARCHY_API_PASSWORD}"
  
  # Retry configuration
  retry:
    attempts: 3
    delay: 1000      # 1 second base delay
    backoff: "exponential"  # exponential or linear
  
  # Expected capabilities (content writing and orchestration)
  expected_capabilities:
    - "blog_writing"
    - "article_creation"
    - "content_writing"
    - "intelligent_delegation"
    - "hierarchical_content_development"
    - "content_orchestration"
  
  # Health check configuration
  health_check:
    enabled: true
    interval: 300000  # 5 minutes
    endpoint: "/.well-known/agent.json"

# Hierarchy Configuration
hierarchy:
  level: specialist
  reportsTo: marketing_manager_orchestrator
  department: marketing

# Metadata for local registration
metadata:
  category: "external"
  provider: "Hiverarchy"
  agent_type: "orchestrator"
  tags: ["content", "writing", "orchestrator", "blog", "articles", "delegation"]
  
  # Local override settings
  local_settings:
    log_level: "info"
    enable_metrics: true
    enable_evaluation: true

  # Primary function details
  primary_function: "Routes content writing requests to specialist agents with intelligent delegation using LLM decision-making"
  
  # Best use cases
  best_use_cases:
    - "Write a blog post about..."
    - "Help me create content about..."
    - "Can I work with the blog writing specialist?"
  
  # Documentation
  documentation:
    description: "This is a proxy to the Hiverarchy AI orchestrator that specializes in content writing delegation. It intelligently routes content creation requests to specialist agents within the Hiverarchy system."
    usage: "Use this agent for content writing requests, blog post creation, article development, and hierarchical content structuring"
    examples:
      - method: "write_blog_post"
        params: { "topic": "AI in Healthcare", "audience": "technical" }
        description: "Request a blog post on a specific topic"
      - method: "create_content"
        params: { "type": "article", "subject": "Machine Learning", "length": "medium" }
        description: "General content creation request"
      - method: "delegate_to_specialist"
        params: { "request": "Can I work with the blog writing specialist?", "context": "user inquiry" }
        description: "Direct delegation to specialist agents"

# Health check configuration
health_check:
  enabled: true
  interval: 300000  # 5 minutes
  endpoint: "/.well-known/health"
  timeout: 5000     # 5 seconds
```

---

## File Structure

### Standard Directory Layout

```
apps/api/src/agents/demo/{department}/{agent_name}/
├── agent.yaml                  # Agent configuration (generates .well-known/agent.json)
├── agent-service.ts            # External A2A proxy service implementation
├── agent.module.ts             # NestJS module with external A2A dependencies
├── context.md                  # Optional knowledge base
└── README.md                   # Agent documentation
```

### Required Files

- **`agent.yaml`** - Agent configuration with external A2A settings (automatically generates `.well-known/agent.json` via A2A protocol)
- **`agent-service.ts`** - External A2A proxy service implementation
- **`agent.module.ts`** - NestJS module with external A2A dependencies

### Optional Files

- **`context.md`** - Knowledge base content for local context and documentation

---

## Agent Configuration Schema

### Complete Configuration Schema

```yaml
# External A2A Agent Configuration
name: agent_name
type: external
displayName: "Human Readable Name"
description: "External A2A agent description with remote system integration capabilities."

# External A2A configuration
external_a2a_configuration:
  # Remote agent endpoint
  endpoint: "${EXTERNAL_ENDPOINT:-http://localhost:4100/agents/remote/tasks}"
  protocol: "A2A"
  
  # Connection settings
  timeout: 60000  # Request timeout in milliseconds
  
  # Authentication configuration
  authentication:
    type: "none|api_key|bearer|basic|oauth|login"
    key: "Authorization"  # Header name for API key
    value: "${API_KEY}"   # API key value
    header: "X-API-Key"   # Custom header name
    login_endpoint: "http://localhost:4100/auth/login"  # For login type
    username: "${API_USERNAME}"
    password: "${API_PASSWORD}"
  
  # Retry configuration
  retry:
    attempts: 3
    delay: 1000      # Base delay in milliseconds
    backoff: "exponential|linear"
  
  # Expected capabilities from remote agent
  expected_capabilities:
    - "capability_1"
    - "capability_2"
    - "capability_3"
  
  # Health check configuration
  health_check:
    enabled: true
    interval: 300000  # Health check interval in milliseconds
    endpoint: "/.well-known/agent.json"
    timeout: 5000     # Health check timeout in milliseconds

# Hierarchy Configuration
hierarchy:
  level: specialist|manager|executive
  reportsTo: parent_orchestrator
  department: marketing|engineering|hr|etc

# Metadata for local registration
metadata:
  category: "external"
  provider: "ExternalProvider"
  agent_type: "specialist|orchestrator|function"
  tags: ["tag1", "tag2", "tag3"]
  
  # Local override settings
  local_settings:
    log_level: "info|debug|warn|error"
    enable_metrics: true|false
    enable_evaluation: true|false

  # Primary function details
  primary_function: "Description of what the external agent does"
  
  # Best use cases
  best_use_cases:
    - "Use case 1"
    - "Use case 2"
    - "Use case 3"
  
  # Documentation
  documentation:
    description: "Detailed description of the external agent"
    usage: "How to use this external agent"
    examples:
      - method: "method_name"
        params: { "param1": "value1" }
        description: "Example usage description"

# Health check configuration
health_check:
  enabled: true|false
  interval: 300000  # Health check interval in milliseconds
  endpoint: "/.well-known/health"
  timeout: 5000     # Health check timeout in milliseconds
```

---

## External A2A Patterns

### 1. Proxy Service Pattern

External A2A agents act as lightweight proxies that forward requests to remote systems:

```typescript
// External A2A Agent Service Implementation
@Injectable()
export class ExternalA2AAgentService extends ExternalA2AAgentBaseService {
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null;
  private readonly customHttpService: HttpService;

  constructor(services: ExternalAgentServicesContext) {
    super(services);
    this.customHttpService = services.httpService;
  }

  /**
   * Override getAgentName to provide a specific name for this agent
   */
  public getAgentName(): string {
    return 'external_agent_name';
  }

  /**
   * Execute task with authentication and parameter transformation
   */
  private async executeTaskWithAuth(method: string, params: any): Promise<any> {
    if (!this.accessToken) {
      throw new Error('No authentication token available');
    }

    try {
      const config = this.getExternalConfig();
      const endpoint = config?.endpoint;
      if (!endpoint) {
        throw new Error('External endpoint not configured in YAML');
      }

      // Transform parameters for external system
      const requestBody = this.transformRequestParams(params);

      const response = await firstValueFrom(
        this.customHttpService.post(endpoint, requestBody, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.accessToken}`,
          },
          timeout: config?.timeout || 60000,
        }),
      );

      if (response.status >= 200 && response.status < 300) {
        return this.transformResponseData(response.data);
      } else {
        throw new Error(`External API returned status ${response.status}`);
      }
    } catch (error) {
      this.logger.error(`External API call failed: ${error.message}`);
      throw error;
    }
  }
}
```

### 2. Authentication Management Pattern

```typescript
// Authentication management for external systems
private async authenticateWithExternalSystem(): Promise<void> {
  const config = this.getExternalConfig();
  const authConfig = config?.authentication;

  if (!authConfig || authConfig.type === 'none') {
    return; // No authentication required
  }

  try {
    switch (authConfig.type) {
      case 'login':
        await this.handleLoginAuthentication(authConfig);
        break;
      case 'api_key':
        await this.handleApiKeyAuthentication(authConfig);
        break;
      case 'bearer':
        await this.handleBearerAuthentication(authConfig);
        break;
      case 'basic':
        await this.handleBasicAuthentication(authConfig);
        break;
      default:
        throw new Error(`Unsupported authentication type: ${authConfig.type}`);
    }
  } catch (error) {
    this.logger.error(`Authentication failed: ${error.message}`);
    throw error;
  }
}

private async handleLoginAuthentication(authConfig: any): Promise<void> {
  const loginEndpoint = authConfig.login_endpoint;
  const username = authConfig.username;
  const password = authConfig.password;

  if (!loginEndpoint || !username || !password) {
    throw new Error('Login authentication requires endpoint, username, and password');
  }

  const response = await firstValueFrom(
    this.customHttpService.post(loginEndpoint, {
      username,
      password,
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    }),
  );

  if (response.data.access_token) {
    this.accessToken = response.data.access_token;
    this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
  } else {
    throw new Error('No access token received from login endpoint');
  }
}
```

### 3. Parameter Transformation Pattern

```typescript
// Transform local parameters to external system format
private transformRequestParams(taskRequest: any): any {
  const config = this.getExternalConfig();
  
  // Use the exact format expected by the external agent
  const requestBody = {
    jsonrpc: '2.0',
    method: 'processTask',
    params: {
      message: taskRequest.userMessage || taskRequest.message || 'No message provided',
      userMessage: taskRequest.userMessage || taskRequest.message || 'No message provided',
      sessionId: `external-session-${Date.now()}`,
      authToken: this.accessToken,
      conversation_history: taskRequest.conversation_history || [],
    },
    id: `external-${this.getAgentName()}-${Date.now()}`,
  };

  return requestBody;
}

// Transform external response to local format
private transformResponseData(responseData: any): any {
  // Handle JSON-RPC response format
  if (responseData.result) {
    return {
      success: true,
      response: responseData.result.content || responseData.result,
      metadata: {
        ...responseData.result.metadata,
        externalAgent: this.getAgentName(),
        timestamp: new Date().toISOString(),
      },
    };
  } else if (responseData.error) {
    return {
      success: false,
      response: `External agent error: ${responseData.error.message}`,
      metadata: {
        error: responseData.error,
        externalAgent: this.getAgentName(),
        timestamp: new Date().toISOString(),
      },
    };
  } else {
    return {
      success: true,
      response: responseData,
      metadata: {
        externalAgent: this.getAgentName(),
        timestamp: new Date().toISOString(),
      },
    };
  }
}
```

### 4. Health Check and Monitoring Pattern

```typescript
// Health check implementation for external agents
private async performHealthCheck(): Promise<boolean> {
  const config = this.getExternalConfig();
  const healthConfig = config?.health_check;

  if (!healthConfig?.enabled) {
    return true; // Health check disabled
  }

  try {
    const healthEndpoint = `${config.endpoint.replace('/tasks', '')}${healthConfig.endpoint}`;
    
    const response = await firstValueFrom(
      this.customHttpService.get(healthEndpoint, {
        timeout: healthConfig.timeout || 5000,
        headers: this.getAuthHeaders(),
      }),
    );

    return response.status >= 200 && response.status < 300;
  } catch (error) {
    this.logger.warn(`Health check failed for ${this.getAgentName()}: ${error.message}`);
    return false;
  }
}

// Periodic health monitoring
private startHealthMonitoring(): void {
  const config = this.getExternalConfig();
  const healthConfig = config?.health_check;

  if (!healthConfig?.enabled) {
    return;
  }

  setInterval(async () => {
    const isHealthy = await this.performHealthCheck();
    if (!isHealthy) {
      this.logger.warn(`External agent ${this.getAgentName()} is unhealthy`);
      // Implement recovery logic or alerting
    }
  }, healthConfig.interval || 300000);
}
```

---

## Implementation Examples

### Example 1: Hiverarchy AI Orchestrator

**File: `apps/api/src/agents/hidden/hiverarchy/agent-service.ts`**
```typescript
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ExternalA2AAgentBaseService } from '@agents/base/implementations/base-services';
import { ExternalAgentServicesContext } from '@agents/base/services/external-agent-services-context';

/**
 * Hiverarchy AI Orchestrator External A2A Agent Service
 *
 * This service acts as a local proxy for the Hiverarchy AI orchestrator.
 * It routes content writing requests to specialist agents with intelligent delegation
 * using LLM decision-making. Specializes in blog writing, article creation, and
 * hierarchical content development.
 *
 * Features:
 * - Dynamic JWT authentication with Hiverarchy service
 * - Automatic token refresh handling
 * - Parameter transformation for Hiverarchy's expected format
 */
@Injectable()
export class HiverarchyAgentService extends ExternalA2AAgentBaseService {
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null;
  private readonly customHttpService: HttpService;

  constructor(services: ExternalAgentServicesContext) {
    super(services);
    this.customHttpService = services.httpService;
  }

  /**
   * Override getAgentName to provide a specific name for this agent
   */
  public getAgentName(): string {
    return 'hiverarchy';
  }

  /**
   * Initialize authentication with Hiverarchy service
   */
  async onModuleInit() {
    await super.onModuleInit();
    await this.authenticateWithHiverarchy();
  }

  /**
   * Authenticate with Hiverarchy service using login endpoint
   */
  private async authenticateWithHiverarchy(): Promise<void> {
    const config = this.getExternalConfig();
    const authConfig = config?.authentication;

    if (!authConfig || authConfig.type !== 'login') {
      throw new Error('Hiverarchy authentication requires login configuration');
    }

    const loginEndpoint = authConfig.login_endpoint;
    const username = authConfig.username;
    const password = authConfig.password;

    if (!loginEndpoint || !username || !password) {
      throw new Error('Hiverarchy authentication requires endpoint, username, and password');
    }

    try {
      const response = await firstValueFrom(
        this.customHttpService.post(loginEndpoint, {
          username,
          password,
        }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        }),
      );

      if (response.data.access_token) {
        this.accessToken = response.data.access_token;
        this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
        this.logger.log('Successfully authenticated with Hiverarchy service');
      } else {
        throw new Error('No access token received from Hiverarchy login endpoint');
      }
    } catch (error) {
      this.logger.error(`Hiverarchy authentication failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Transform request parameters for Hiverarchy's expected format
   */
  private transformRequestParams(taskRequest: any): any {
    // Use the exact format expected by the external hierarchy agent
    const requestBody = {
      jsonrpc: '2.0',
      method: 'processTask',
      params: {
        message: taskRequest.userMessage || taskRequest.message || 'No message provided',
        userMessage: taskRequest.userMessage || taskRequest.message || 'No message provided',
        sessionId: `external-session-${Date.now()}`,
        authToken: this.accessToken,
        conversation_history: [],
      },
      id: `external-hiverarchy-${Date.now()}`,
    };

    return requestBody;
  }

  /**
   * Execute task with authentication headers
   */
  private async executeTaskWithAuth(method: string, params: any): Promise<any> {
    if (!this.accessToken) {
      throw new Error('No authentication token available');
    }

    try {
      const config = this.getExternalConfig();
      const endpoint = config?.endpoint;
      if (!endpoint) {
        throw new Error('External endpoint not configured in YAML');
      }

      const requestBody = this.transformRequestParams(params);

      const response = await firstValueFrom(
        this.customHttpService.post(endpoint, requestBody, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.accessToken}`,
          },
          timeout: 60000,
        }),
      );

      if (response.status >= 200 && response.status < 300) {
        return this.transformResponseData(response.data);
      } else {
        throw new Error(`Hiverarchy API returned status ${response.status}`);
      }
    } catch (error) {
      this.logger.error(`Hiverarchy API call failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Transform Hiverarchy response to local format
   */
  private transformResponseData(responseData: any): any {
    if (responseData.result) {
      return {
        success: true,
        response: responseData.result.content || responseData.result,
        metadata: {
          ...responseData.result.metadata,
          externalAgent: 'hiverarchy',
          timestamp: new Date().toISOString(),
        },
      };
    } else if (responseData.error) {
      return {
        success: false,
        response: `Hiverarchy error: ${responseData.error.message}`,
        metadata: {
          error: responseData.error,
          externalAgent: 'hiverarchy',
          timestamp: new Date().toISOString(),
        },
      };
    } else {
      return {
        success: true,
        response: responseData,
        metadata: {
          externalAgent: 'hiverarchy',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}
```

**File: `apps/api/src/agents/hidden/hiverarchy/agent.module.ts`**
```typescript
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ExternalAgentServicesContextModule } from '@agents/base/services/external-agent-services-context.module';
import { HiverarchyAgentService } from './agent-service';

/**
 * Hiverarchy External A2A Agent Module
 *
 * Provides the Hiverarchy AI Orchestrator external A2A agent with access to
 * the external agent infrastructure for remote content creation delegation.
 */
@Module({
  imports: [
    HttpModule, // Required for HTTP service
    ExternalAgentServicesContextModule, // Service container for external A2A agents
  ],
  providers: [HiverarchyAgentService],
  exports: [HiverarchyAgentService],
})
export class HiverarchyAgentModule {}
```

### Example 2: Google Hello World External Agent

**File: `apps/api/src/agents/demo/external/google_hello_world/agent.yaml`**
```yaml
name: google_hello_world
type: external
displayName: "Google Hello World Agent"
description: "External A2A agent that connects to Google's Hello World agent for demonstration purposes."

# External A2A configuration
external_a2a_configuration:
  endpoint: "https://google-hello-world-agent.example.com/tasks"
  protocol: "A2A"
  timeout: 30000
  
  # Simple API key authentication
  authentication:
    type: "api_key"
    header: "X-API-Key"
    value: "${GOOGLE_API_KEY}"
  
  # Retry configuration
  retry:
    attempts: 2
    delay: 1000
    backoff: "linear"
  
  # Expected capabilities
  expected_capabilities:
    - "hello_world"
    - "greeting"
    - "demonstration"
  
  # Health check configuration
  health_check:
    enabled: true
    interval: 600000  # 10 minutes
    endpoint: "/.well-known/agent.json"
    timeout: 5000

# Hierarchy Configuration
hierarchy:
  level: specialist
  reportsTo: demo_manager_orchestrator
  department: demo

# Metadata for local registration
metadata:
  category: "external"
  provider: "Google"
  agent_type: "specialist"
  tags: ["demo", "hello-world", "greeting"]
  
  # Local override settings
  local_settings:
    log_level: "info"
    enable_metrics: true
    enable_evaluation: true

  # Primary function details
  primary_function: "Provides hello world greetings and demonstrations"
  
  # Best use cases
  best_use_cases:
    - "Say hello"
    - "Demonstrate external A2A integration"
    - "Test external agent connectivity"
  
  # Documentation
  documentation:
    description: "This is a proxy to Google's Hello World agent for demonstration purposes"
    usage: "Use this agent for simple greetings and external A2A testing"
    examples:
      - method: "greet"
        params: { "name": "World" }
        description: "Get a greeting message"

# Health check configuration
health_check:
  enabled: true
  interval: 600000  # 10 minutes
  endpoint: "/.well-known/health"
  timeout: 5000
```

---

## Authentication & Security

### 1. Authentication Types

External A2A agents support multiple authentication methods:

```typescript
// Authentication type definitions
interface AuthenticationConfig {
  type: 'none' | 'api_key' | 'bearer' | 'basic' | 'oauth' | 'login';
  key?: string;           // Header name for API key
  value?: string;         // API key value
  header?: string;        // Custom header name
  login_endpoint?: string; // For login type
  username?: string;      // For login/basic auth
  password?: string;      // For login/basic auth
}
```

### 2. Token Management

```typescript
// Token management for external systems
private async refreshTokenIfNeeded(): Promise<void> {
  if (!this.tokenExpiry || Date.now() < this.tokenExpiry - 60000) {
    return; // Token is still valid (with 1-minute buffer)
  }

  this.logger.log('Refreshing authentication token');
  await this.authenticateWithExternalSystem();
}

// Secure token storage
private getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (this.accessToken) {
    headers['Authorization'] = `Bearer ${this.accessToken}`;
  }

  return headers;
}
```

### 3. Security Best Practices

- **Environment Variables**: Store sensitive credentials in environment variables
- **Token Expiry**: Implement automatic token refresh
- **HTTPS Only**: Always use HTTPS for external communications
- **Input Validation**: Validate all inputs before forwarding to external systems
- **Error Handling**: Don't expose sensitive information in error messages
- **Rate Limiting**: Implement rate limiting for external API calls
- **Audit Logging**: Log all external communications for security auditing

---

## Testing Requirements

### 1. Unit Tests

```typescript
// external-a2a-agent.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HiverarchyAgentService } from './agent-service';
import { ExternalAgentServicesContext } from './external-agent-services-context';

describe('Hiverarchy External A2A Agent', () => {
  let service: HiverarchyAgentService;
  let mockServices: ExternalAgentServicesContext;

  beforeEach(() => {
    mockServices = {
      httpService: {
        post: vi.fn(),
        get: vi.fn(),
      },
    } as any;

    service = new HiverarchyAgentService(mockServices);
  });

  it('should authenticate with Hiverarchy service correctly', async () => {
    const mockAuthResponse = {
      data: {
        access_token: 'test-token',
        expires_in: 3600,
      },
    };

    mockServices.httpService.post.mockResolvedValue(mockAuthResponse);

    await service.authenticateWithHiverarchy();

    expect(mockServices.httpService.post).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login'),
      expect.objectContaining({
        username: expect.any(String),
        password: expect.any(String),
      }),
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      })
    );
  });

  it('should transform request parameters correctly', () => {
    const taskRequest = {
      userMessage: 'Write a blog post about AI',
      sessionId: 'test-session',
    };

    const transformed = service.transformRequestParams(taskRequest);

    expect(transformed).toEqual({
      jsonrpc: '2.0',
      method: 'processTask',
      params: {
        message: 'Write a blog post about AI',
        userMessage: 'Write a blog post about AI',
        sessionId: expect.stringContaining('external-session-'),
        authToken: null,
        conversation_history: [],
      },
      id: expect.stringContaining('external-hiverarchy-'),
    });
  });

  it('should handle external API errors gracefully', async () => {
    const mockError = new Error('External API error');
    mockServices.httpService.post.mockRejectedValue(mockError);

    await expect(service.executeTaskWithAuth('converse', {
      userMessage: 'Test message',
    })).rejects.toThrow('External API error');
  });
});
```

### 2. Integration Tests

```typescript
// external-a2a-agent.integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';

describe('Hiverarchy External A2A Agent (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/agents/external/execute (POST)', () => {
    return request(app.getHttpServer())
      .post('/agents/external/execute')
      .send({
        userMessage: 'Write a blog post about AI in healthcare',
        sessionId: 'test-session',
        agentName: 'hiverarchy',
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.response).toBeDefined();
        expect(res.body.metadata.externalAgent).toBe('hiverarchy');
      });
  });

  it('should handle authentication failures gracefully', () => {
    return request(app.getHttpServer())
      .post('/agents/external/execute')
      .send({
        userMessage: 'Test message',
        sessionId: 'test-session',
        agentName: 'hiverarchy',
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(false);
        expect(res.body.response).toContain('authentication');
      });
  });
});
```

### 3. Performance Tests

```typescript
// external-a2a-agent.performance.spec.ts
import { performance } from 'perf_hooks';

describe('External A2A Agent Performance', () => {
  it('should respond within acceptable time limits', async () => {
    const startTime = performance.now();
    
    const result = await executeExternalA2AAgent({
      userMessage: 'Write a blog post about AI',
      sessionId: 'test-session',
      agentName: 'hiverarchy',
    });
    
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    expect(responseTime).toBeLessThan(30000); // 30 seconds max for external calls
    expect(result.success).toBe(true);
  });

  it('should handle concurrent external requests efficiently', async () => {
    const concurrentRequests = 3;
    const startTime = performance.now();
    
    const promises = Array(concurrentRequests).fill(null).map(() =>
      executeExternalA2AAgent({
        userMessage: 'Test message',
        sessionId: 'test-session',
        agentName: 'hiverarchy',
      })
    );
    
    const results = await Promise.all(promises);
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    expect(results).toHaveLength(concurrentRequests);
    expect(results.every(r => r.success)).toBe(true);
    expect(totalTime).toBeLessThan(60000); // 60 seconds max for all requests
  });
});
```

---

## Best Practices

### 1. External Integration Design

- **Lightweight Proxy**: Keep the local service minimal and focused on proxying
- **Authentication Management**: Implement robust authentication with token refresh
- **Parameter Transformation**: Handle format differences between local and external systems
- **Error Handling**: Provide meaningful error messages while protecting sensitive information
- **Health Monitoring**: Implement health checks and monitoring for external dependencies

### 2. Security Considerations

- **Credential Management**: Store all credentials in environment variables
- **Token Security**: Implement secure token storage and refresh mechanisms
- **Input Validation**: Validate all inputs before forwarding to external systems
- **HTTPS Enforcement**: Always use HTTPS for external communications
- **Audit Logging**: Log all external communications for security auditing

### 3. Performance Optimization

- **Connection Pooling**: Reuse HTTP connections for external calls
- **Timeout Management**: Set appropriate timeouts for external requests
- **Retry Logic**: Implement exponential backoff for failed requests
- **Caching**: Cache external responses when appropriate
- **Monitoring**: Track external API performance and availability

### 4. Fault Tolerance

- **Circuit Breaker**: Implement circuit breaker pattern for external services
- **Fallback Mechanisms**: Provide fallback responses when external services are unavailable
- **Health Checks**: Regular health monitoring of external dependencies
- **Graceful Degradation**: Handle external service failures gracefully
- **Recovery Procedures**: Implement automatic recovery from external service failures

### 5. Monitoring and Observability

- **Request Logging**: Log all external requests and responses
- **Performance Metrics**: Track response times and success rates
- **Error Tracking**: Monitor and alert on external service errors
- **Health Dashboards**: Provide visibility into external service health
- **Alerting**: Set up alerts for external service failures

---

This comprehensive guide provides the foundation for creating, implementing, and maintaining external A2A agents in the OrchestratorAI system. Follow these patterns and examples to ensure effective integration with external agent ecosystems while maintaining local control, monitoring, and security.
