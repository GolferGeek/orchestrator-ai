# MCP Architecture Proposal

## Overview

This document outlines the proposed Model Context Protocol (MCP) architecture for our system, designed to maximize local AI capabilities while maintaining flexibility for external integrations.

## Architecture Principles

1. **MCP Consumer Approach** - Consume existing MCP servers rather than building our own
2. **Local-First Models** - Prioritize local models (Ollama) over external API calls
3. **Resource Efficiency** - Group similar services in shared Docker containers
4. **Transport Agnostic** - Services work with both STDIO and HTTP MCP servers
5. **Unified Interface** - Consistent service layer regardless of MCP transport
6. **Scalable Design** - Easy to add new MCP server integrations

## System Architecture

```
┌─────────────────────────────────────┐
│        Ollama Models Docker         │
│  ┌─────────────────────────────────┐ │
│  │ • Llama 3.2:3b   (Port 11434)  │ │
│  │ • Llama QwQ:32b  (Port 11435)  │ │  
│  │ • DeepSeek R1:7b (Port 11436)  │ │
│  │ (HTTP API endpoints)            │ │
│  └─────────────────────────────────┘ │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│      Local MCP Services Docker      │
│  ┌─────────────────────────────────┐ │
│  │ • Ollama-Postgres MCP (STDIO)   │ │
│  │ • File System MCP (STDIO)       │ │  
│  │ • Git MCP (STDIO)               │ │
│  │ • Custom Local MCPs             │ │
│  └─────────────────────────────────┘ │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│         NestJS API Layer            │
│  ┌─────────────────────────────────┐ │
│  │ • OllamaService                 │ │
│  │ • MCPClientService              │ │
│  │ • PostgresMCPService            │ │
│  │ • FilesystemMCPService          │ │
│  │ • ExternalMCPService            │ │
│  └─────────────────────────────────┘ │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│            Agent Layer              │
│  ┌─────────────────────────────────┐ │
│  │ • Metrics Agent                 │ │
│  │ • Blog Post Agent               │ │
│  │ • Engineering Agents            │ │
│  │ • Marketing Agents              │ │
│  └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 4. Recommended Directory Structure

To ensure clarity and maintainability, the project's infrastructure-as-code (Docker files) should be organized at the root level of the monorepo, separate from the application code.

**Benefits**:
- **Clarity**: The `docker-compose.yml` orchestrates the entire project, so it logically belongs at the root.
- **Maintainability**: Keeps infrastructure code separate from application code.
- **Standard Practice**: Aligns with how most large-scale monorepo projects are structured.

```
/
├── docker-compose.yml          # Root-level orchestrator for all services
├── .env.example
├── apps/
│   ├── api/                    # NestJS application code
│   └── web/                    # Vue frontend code
├── docker/                     # NEW: Root-level directory for all Dockerfiles
│   ├── ollama/
│   │   └── Dockerfile
│   └── mcp-services/
│       └── Dockerfile
└── docs/
    ├── mcp-architecture-proposal.md
    └── ...
```

---

## Component Details

### 1. Ollama Models Docker Container

**Purpose**: Host multiple local LLM models with HTTP API access

**Models**:
- **Llama 3.2:3b** (Port 11434) - Fast queries, general purpose
- **Llama QwQ:32b** (Port 11435) - Complex reasoning, analysis
- **DeepSeek R1:7b** (Port 11436) - Code generation, technical tasks

**Docker Configuration**:
```yaml
ollama-multi:
  build: ./ollama-multi
  container_name: ollama-models
  ports:
    - "11434:11434"  # Llama 3.2
    - "11435:11435"  # QwQ  
    - "11436:11436"  # DeepSeek R1
  volumes:
    - ollama_data:/root/.ollama
  restart: unless-stopped
  deploy:
    resources:
      limits:
        memory: 32G
```

### 2. Local MCP Services Docker Container

**Purpose**: Host STDIO-based MCP servers for local integrations

**Consumed MCP Servers**:
- **Ollama-Postgres MCP** - Existing server for natural language to SQL conversion
- **Filesystem MCP** - Existing server for file operations and management
- **Git MCP** - Existing server for version control operations
- **Other Community MCPs** - Additional servers from the MCP ecosystem

**Communication**: STDIO (stdin/stdout) protocol

**Docker Configuration**:
```yaml
mcp-services:
  build: ./mcp-services
  container_name: mcp-services
  volumes:
    - ./workspace:/workspace
  depends_on:
    - postgres
    - ollama-multi
  restart: unless-stopped
```

### 3. NestJS Service Layer

**Purpose**: Unified interface for all MCP and LLM interactions

**Key Services**:

#### OllamaService
```typescript
@Injectable()
export class OllamaService {
  private readonly models = {
    'llama3.2': 'http://localhost:11434',
    'qwq': 'http://localhost:11435', 
    'deepseek-r1': 'http://localhost:11436'
  };

  async fastQuery(prompt: string) { /* Llama 3.2 */ }
  async complexReasoning(prompt: string) { /* QwQ */ }
  async codeGeneration(prompt: string) { /* DeepSeek R1 */ }
}
```

#### MCP Directory Structure

**Transport-Agnostic Services** - Each service provides consistent interface regardless of underlying MCP transport:

```
apps/api/src/mcp/
├── services/
│   ├── data/                          # Data-focused MCP services
│   │   ├── postgres-mcp.service.ts    # Database operations (uses local STDIO MCP)
│   │   └── postgres-metrics-mcp.service.ts # Specialized metrics queries
│   ├── productivity/                  # Productivity & content MCP services
│   │   ├── notion-mcp.service.ts      # Notion operations (uses Zapier internally)
│   │   ├── slack-mcp.service.ts       # Slack operations (uses Zapier internally)
│   │   ├── filesystem-mcp.service.ts  # File operations (uses local STDIO MCP)
│   │   └── git-mcp.service.ts         # Version control (uses local STDIO MCP)
│   └── core/                          # MCP client infrastructure
│       ├── stdio-mcp-client.service.ts # STDIO transport for local MCPs
│       └── http-mcp-client.service.ts  # HTTP transport for Zapier
```

#### Service Implementation Pattern
```typescript
@Injectable()
export class NotionMCPService {
  constructor(
    private httpClient: HttpMCPClientService  // Uses Zapier internally
  ) {}

  // Service-specific methods that internally use Zapier
  async createPage(databaseId: string, properties: any) {
    return this.httpClient.callTool('zapier', 'notion_create_page', {
      database_id: databaseId,
      properties
    });
  }

  async searchPages(query: string) {
    return this.httpClient.callTool('zapier', 'notion_search', { query });
  }

  async updatePage(pageId: string, properties: any) {
    return this.httpClient.callTool('zapier', 'notion_update_page', {
      page_id: pageId,
      properties
    });
  }
}

@Injectable()
export class SlackMCPService {
  constructor(
    private httpClient: HttpMCPClientService  // Uses Zapier internally
  ) {}

  async sendMessage(channel: string, text: string) {
    return this.httpClient.callTool('zapier', 'slack_send_message', {
      channel, text
    });
  }

  async getChannels() {
    return this.httpClient.callTool('zapier', 'slack_list_channels', {});
  }
}
```

### 4. Agent Integration

**Usage Pattern**:
```typescript
export async function execute(params: AgentFunctionParams): Promise<AgentFunctionResponse> {
  const { userMessage, services } = params;
  
  // Route to appropriate service based on request type
  if (userMessage.includes('database')) {
    return await services.postgresMCP.queryDatabase(userMessage);
  }
  
  if (userMessage.includes('complex analysis')) {
    return await services.ollama.complexReasoning(userMessage);
  }
  
  // Default to fast local model
  return await services.ollama.fastQuery(userMessage);
}
```

## Model Selection Strategy

| Use Case | Model | Port | Rationale |
|----------|-------|------|-----------|
| Quick queries, chat | Llama 3.2:3b | 11434 | Fast, efficient for simple tasks |
| Complex reasoning, analysis | QwQ:32b | 11435 | Specialized for complex thinking |
| Code generation, technical | DeepSeek R1:7b | 11436 | Optimized for programming tasks |
| SQL generation | Llama 3.2 via MCP | STDIO | Integrated with database schema |

## Benefits

1. **Performance** - Local models eliminate API latency and costs
2. **Privacy** - Sensitive data never leaves your infrastructure
3. **Reliability** - No dependency on external service availability
4. **Cost Efficiency** - No per-token charges for local inference
5. **Customization** - Full control over model selection and parameters
6. **Scalability** - Easy to add new models and MCP services

## Resource Requirements

- **RAM**: 32GB+ recommended for running multiple models
- **Storage**: 50GB+ for model files and data
- **CPU**: Multi-core processor for concurrent model serving
- **Docker**: Latest version with adequate resource allocation

## Development Workflow

1. **Start Services**: `docker-compose up -d`
2. **Verify Models**: Check each Ollama endpoint for availability
3. **Test MCP Services**: Validate STDIO communication
4. **Agent Development**: Use unified service interfaces
5. **Monitor Resources**: Track memory and CPU usage

---

## External MCP Services Integration

### Zapier MCP Integration (Primary External Provider)

**Zapier MCP Server** provides access to **8,000+ apps and 30,000+ actions** through a single HTTP endpoint.

#### Setup Process
1. **Generate MCP URL** - Get unique endpoint from Zapier dashboard
2. **Configure Actions** - Select specific actions for each service
3. **Environment Configuration** - Set API keys and endpoints

#### Zapier MCP Service Categories

```typescript
// apps/api/src/mcp/services/external/zapier-mcp.service.ts
@Injectable()
export class ZapierMCPService {
  private readonly zapierMcpUrl = process.env.ZAPIER_MCP_URL;
  
  // Notion Operations (8 actions available)
  async createNotionPage(params: any): Promise<any> {
    return this.callZapier('notion_create_page', params);
  }
  
  async addNotionComment(params: any): Promise<any> {
    return this.callZapier('notion_add_comment', params);
  }
  
  // Gmail Operations
  async sendEmail(params: any): Promise<any> {
    return this.callZapier('gmail_send_email', params);
  }
  
  // Slack Operations  
  async sendSlackMessage(params: any): Promise<any> {
    return this.callZapier('slack_send_message', params);
  }
  
  // Google Sheets Operations
  async updateSheet(params: any): Promise<any> {
    return this.callZapier('sheets_update_row', params);
  }
  
  private async callZapier(action: string, params: any): Promise<any> {
    const response = await fetch(`${this.zapierMcpUrl}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ZAPIER_API_KEY}`
      },
      body: JSON.stringify({ action, params })
    });
    
    if (!response.ok) {
      throw new Error(`Zapier MCP error: ${response.statusText}`);
    }
    
    return response.json();
  }
}
```

#### Service Configuration Pattern

Each service can be configured to use either local STDIO or external Zapier MCP:

```typescript
// Environment-based service selection
export class NotionMCPService {
  constructor(
    private stdioClient: StdioMCPClientService,
    private zapierService: ZapierMCPService
  ) {}

  private get client() {
    switch (process.env.NOTION_MCP_PROVIDER) {
      case 'zapier':
        return this.zapierService;
      case 'local':
      default:
        return this.stdioClient;
    }
  }
  
  async createPage(title: string, content: any): Promise<any> {
    if (process.env.NOTION_MCP_PROVIDER === 'zapier') {
      return this.zapierService.createNotionPage({ title, content });
    }
    return this.stdioClient.callTool('notion', 'create_page', { title, content });
  }
}
```

### Architecture Benefits

#### Transport Abstraction
- **Consistent Interface** - Agents use same service methods regardless of transport
- **Easy Switching** - Change providers via environment variables
- **Fallback Support** - Automatic failover between local and external services

#### Scalability Pattern
```typescript
// Agent doesn't know or care about transport
export async function execute(params: AgentFunctionParams): Promise<AgentFunctionResponse> {
  const { userMessage, services } = params;
  
  // Same interface, different implementations
  if (userMessage.includes('create notion page')) {
    return await services.notionMCP.createPage(title, content);
  }
  
  if (userMessage.includes('send email')) {
    return await services.zapierMCP.sendEmail(emailParams);
  }
}
```

### Future External Integrations

- **Microsoft Power Platform** - Office 365, SharePoint, Teams integrations
- **Salesforce MCP** - Native Salesforce operations
- **AWS Services MCP** - S3, Lambda, RDS integrations  
- **Google Cloud MCP** - BigQuery, Cloud Storage, AI services
- **Custom Enterprise MCPs** - Client-specific integrations

### Configuration Management

```yaml
# docker-compose.yml - External services configuration
services:
  nestjs-api:
    environment:
      # MCP Provider Selection
      NOTION_MCP_PROVIDER: zapier  # or 'local'
      POSTGRES_MCP_PROVIDER: local
      FILESYSTEM_MCP_PROVIDER: local
      
      # External Service Credentials
      ZAPIER_MCP_URL: ${ZAPIER_MCP_URL}
      ZAPIER_API_KEY: ${ZAPIER_API_KEY}
      
      # Rate Limiting
      EXTERNAL_MCP_RATE_LIMIT: 300  # per month for free tier
      EXTERNAL_MCP_TIMEOUT: 30000   # 30 seconds
```

### Monitoring & Observability

- **Usage Tracking** - Monitor external service consumption
- **Cost Management** - Track API usage against limits
- **Performance Metrics** - Compare local vs external response times
- **Fallback Monitoring** - Alert when switching between providers
- **Error Handling** - Graceful degradation when external services fail

---

## Implementation Roadmap

### Phase 1: MCP Consumer Foundation
- [ ] Remove existing custom MCP server implementations
- [ ] Set up Ollama multi-model Docker container
- [ ] Set up local MCP services container (consuming existing servers)
- [ ] Create unified NestJS service layer for MCP consumption
- [ ] Integrate with existing agents

### Phase 2: External MCP Integration
- [ ] Implement Zapier MCP integration
- [ ] Create transport-agnostic service interfaces
- [ ] Add environment-based provider selection
- [ ] Implement fallback and error handling

### Phase 3: Ecosystem Expansion
- [ ] Add additional external MCP providers
- [ ] Performance tuning and monitoring
- [ ] Usage tracking and cost optimization
- [ ] Documentation and best practices

## Configuration Files

### Docker Compose
```yaml
version: '3.8'
services:
  ollama-multi:
    # [Configuration as shown above]
    
  postgres:
    image: postgres:13
    container_name: postgres-metrics
    environment:
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: metrics
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    
  mcp-services:
    # [Configuration as shown above]

volumes:
  ollama_data:
  postgres_data:
```

### Environment Variables
```env
# Ollama Configuration
OLLAMA_MODELS_PATH=/data/ollama
OLLAMA_MAX_MEMORY=32G

# Database Configuration
DATABASE_URL=postgresql://postgres:dev@localhost:7012/metrics
SUPABASE_URL=postgresql://postgres:password@localhost:7012/postgres

# MCP Configuration
MCP_SERVICES_PATH=/app/mcp-services
MCP_WORKSPACE_PATH=/workspace

# External Services (Phase 2)
ZAPIER_API_KEY=your_zapier_key
EXTERNAL_MCP_TIMEOUT=30000
```

## Monitoring and Observability

- **Docker Stats** - Container resource usage
- **Ollama Metrics** - Model performance and usage
- **MCP Health Checks** - Service availability monitoring
- **Agent Performance** - Response times and success rates
- **Cost Tracking** - Local vs external service usage

---

*Last Updated: [Current Date]*
*Version: 1.0*
*Status: Proposal - Pending Implementation*