# LangGraph NestJS Application - Implementation Plan

## Problem Statement

Create a NestJS application under `apps/langgraph/` that serves as a dedicated TypeScript-based LangGraph workflow execution engine, mirroring the same pattern used by the n8n application. Each LangGraph workflow will be exposed as an HTTP endpoint that:

- Receives standardized task parameters (taskId, conversationId, userId, provider, model, prompt, statusWebhook)
- Calls the centralized LLM service (`apps/api/src/llms`) for all AI interactions
- Streams progress updates via webhook callbacks
- Returns responses compatible with API agent expectations
- Supports future human-in-the-loop workflows

## Objectives

1. **Create standalone NestJS application** at `apps/langgraph/` for LangGraph workflow execution
2. **Standardize workflow endpoints** that accept the same parameters as n8n workflows
3. **Integrate with centralized LLM service** via HTTP calls to agent2agent LLM endpoints
4. **Implement webhook-based streaming** for real-time progress updates
5. **Return API-agent-compatible responses** following the same format as n8n workflows
6. **Prepare for human-in-the-loop** with webhook response patterns

---

## Technical Approach

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    apps/langgraph/                          │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │         LangGraph Workflow Endpoints               │   │
│  │  POST /workflows/marketing-swarm                   │   │
│  │  POST /workflows/requirements-writer               │   │
│  │  POST /workflows/custom-workflow                   │   │
│  └────────────────┬───────────────────────────────────┘   │
│                   │                                         │
│  ┌────────────────▼───────────────────────────────────┐   │
│  │      LangGraph Workflow Service                    │   │
│  │  - Execute LangGraph workflows                     │   │
│  │  - Manage state graphs                             │   │
│  │  - Coordinate multi-step flows                     │   │
│  └────────┬──────────────────────┬────────────────────┘   │
│           │                      │                         │
│  ┌────────▼──────────┐  ┌────────▼──────────────────┐    │
│  │  LLM HTTP Client  │  │  Webhook Status Service   │    │
│  │  Service          │  │  - Send progress updates  │    │
│  └────────┬──────────┘  └───────────────────────────┘    │
└───────────┼─────────────────────────────────────────────┘
            │
            │ HTTP Calls
            ▼
┌─────────────────────────────────────────────────────────────┐
│              apps/api/src/llms/                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  LLM Service Endpoints                               │  │
│  │  POST /llms/stream    - Streaming LLM calls          │  │
│  │  POST /llms/complete  - Non-streaming LLM calls      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Standalone NestJS Application**: `apps/langgraph/` runs independently on its own port (similar to n8n setup)
2. **HTTP-based LLM Integration**: Calls `apps/api/src/llms` endpoints via HTTP (not direct service injection)
3. **Webhook-based Streaming**: Posts progress updates to the statusWebhook URL provided in requests
4. **LangGraph State Management**: Use LangGraph's built-in StateGraph for workflow orchestration
5. **TypeScript-Native**: All workflows written in TypeScript (no Python dependencies)

---

## Implementation Steps

### Phase 1: Project Setup & Infrastructure

#### 1.1 Create NestJS Application Structure

**Directory Structure:**
```
apps/langgraph/
├── src/
│   ├── main.ts                          # Application entry point
│   ├── app.module.ts                    # Root module
│   ├── config/
│   │   ├── langgraph.config.ts          # App configuration
│   │   └── environment.validation.ts    # Env validation schema
│   ├── common/
│   │   ├── dto/
│   │   │   ├── workflow-request.dto.ts  # Standard request DTO
│   │   │   └── workflow-response.dto.ts # Standard response DTO
│   │   ├── interfaces/
│   │   │   └── workflow.interface.ts    # Workflow contracts
│   │   └── guards/
│   │       └── auth.guard.ts            # Optional auth
│   ├── services/
│   │   ├── llm-http-client.service.ts   # HTTP client for LLM calls
│   │   ├── webhook-status.service.ts    # Webhook status updates
│   │   └── state-persistence.service.ts # Workflow state storage
│   ├── workflows/
│   │   ├── workflows.module.ts
│   │   ├── workflows.controller.ts      # HTTP endpoints
│   │   ├── workflows.service.ts         # Workflow orchestration
│   │   ├── graphs/
│   │   │   ├── marketing-swarm.graph.ts
│   │   │   └── requirements-writer.graph.ts
│   │   └── nodes/
│   │       ├── llm-node.ts              # Generic LLM call node
│   │       ├── webhook-node.ts          # Webhook notification node
│   │       └── merge-node.ts            # Data merging node
│   └── health/
│       ├── health.module.ts
│       └── health.controller.ts         # Health checks
├── test/
│   ├── app.e2e-spec.ts
│   └── workflows/
│       └── marketing-swarm.e2e-spec.ts
├── package.json
├── tsconfig.json
├── nest-cli.json
└── .env.example
```

**Environment Variables:**
```env
# LangGraph Application
LANGGRAPH_PORT=7200
LANGGRAPH_HOST=0.0.0.0

# LLM Service Integration
LLM_SERVICE_URL=http://localhost:7100
LLM_STREAM_ENDPOINT=/llms/stream
LLM_COMPLETE_ENDPOINT=/llms/complete

# Webhook Configuration
DEFAULT_STATUS_WEBHOOK_URL=http://localhost:7100/webhooks/status

# Optional
NODE_ENV=development
LOG_LEVEL=debug
```

#### 1.2 Define Standard DTOs

**`workflow-request.dto.ts`:**
```typescript
import { IsString, IsUUID, IsOptional, IsUrl, IsObject } from 'class-validator';

export class WorkflowRequestDto {
  @IsUUID()
  taskId: string;

  @IsUUID()
  conversationId: string;

  @IsUUID()
  userId: string;

  @IsString()
  provider: string; // e.g., 'openai', 'anthropic'

  @IsString()
  model: string; // e.g., 'gpt-4', 'claude-3-opus'

  @IsString()
  prompt: string; // Main user prompt/announcement

  @IsUrl()
  @IsOptional()
  statusWebhook?: string; // Webhook URL for progress updates

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>; // Additional workflow-specific data
}
```

**`workflow-response.dto.ts`:**
```typescript
export class WorkflowResponseDto {
  success: boolean;
  taskId: string;
  conversationId: string;
  data: Record<string, unknown>; // Workflow-specific output
  metadata?: {
    executionTime?: number;
    stepsCompleted?: number;
    provider?: string;
    model?: string;
  };
}
```

---

### Phase 2: Core Services Implementation

#### 2.1 LLM HTTP Client Service

**Purpose:** Call the centralized LLM service via HTTP

**`llm-http-client.service.ts`:**
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface LLMCallRequest {
  provider: string;
  model: string;
  systemMessage?: string;
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface LLMCallResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

@Injectable()
export class LLMHttpClientService {
  private readonly logger = new Logger(LLMHttpClientService.name);
  private readonly llmServiceUrl: string;
  private readonly streamEndpoint: string;
  private readonly completeEndpoint: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.llmServiceUrl = this.configService.get<string>('LLM_SERVICE_URL');
    this.streamEndpoint = this.configService.get<string>('LLM_STREAM_ENDPOINT');
    this.completeEndpoint = this.configService.get<string>('LLM_COMPLETE_ENDPOINT');
  }

  /**
   * Make a non-streaming LLM call
   */
  async callLLM(request: LLMCallRequest): Promise<LLMCallResponse> {
    const url = `${this.llmServiceUrl}${this.completeEndpoint}`;

    this.logger.debug(`Calling LLM service: ${url}`, {
      provider: request.provider,
      model: request.model,
    });

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, {
          provider: request.provider,
          model: request.model,
          messages: [
            ...(request.systemMessage
              ? [{ role: 'system', content: request.systemMessage }]
              : []),
            { role: 'user', content: request.userMessage },
          ],
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 2000,
        }),
      );

      return {
        text: response.data.content || response.data.text,
        usage: response.data.usage,
      };
    } catch (error) {
      this.logger.error('LLM call failed', error);
      throw new Error(`LLM call failed: ${error.message}`);
    }
  }

  /**
   * Make a streaming LLM call
   * Returns an async generator for streaming responses
   */
  async *callLLMStream(request: LLMCallRequest): AsyncGenerator<string> {
    const url = `${this.llmServiceUrl}${this.streamEndpoint}`;

    this.logger.debug(`Calling LLM service (streaming): ${url}`);

    // Implementation would use SSE or streaming HTTP response
    // Placeholder for now - actual implementation depends on LLM service API
    const response = await this.callLLM({ ...request, stream: false });
    yield response.text;
  }
}
```

#### 2.2 Webhook Status Service

**Purpose:** Send progress updates to the statusWebhook URL

**`webhook-status.service.ts`:**
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface StatusUpdate {
  taskId: string;
  conversationId: string;
  userId: string;
  status: 'started' | 'progress' | 'completed' | 'failed';
  timestamp: string;
  step?: string;
  message?: string;
  sequence?: number;
  totalSteps?: number;
  data?: Record<string, unknown>;
  error?: string;
}

@Injectable()
export class WebhookStatusService {
  private readonly logger = new Logger(WebhookStatusService.name);

  constructor(private readonly httpService: HttpService) {}

  /**
   * Send status update to webhook URL
   */
  async sendStatus(webhookUrl: string, update: StatusUpdate): Promise<void> {
    if (!webhookUrl) {
      this.logger.warn('No webhook URL provided, skipping status update');
      return;
    }

    this.logger.debug(`Sending status update to ${webhookUrl}`, {
      taskId: update.taskId,
      status: update.status,
      step: update.step,
    });

    try {
      await firstValueFrom(
        this.httpService.post(webhookUrl, update, {
          timeout: 5000, // 5 second timeout
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );

      this.logger.log(`Status update sent successfully: ${update.status}`);
    } catch (error) {
      this.logger.error(`Failed to send status update to ${webhookUrl}`, error);
      // Don't throw - webhook failures shouldn't break the workflow
    }
  }

  /**
   * Send started status
   */
  async sendStarted(
    webhookUrl: string,
    taskId: string,
    conversationId: string,
    userId: string,
    totalSteps?: number,
  ): Promise<void> {
    await this.sendStatus(webhookUrl, {
      taskId,
      conversationId,
      userId,
      status: 'started',
      timestamp: new Date().toISOString(),
      message: 'Workflow execution started',
      totalSteps,
    });
  }

  /**
   * Send progress status
   */
  async sendProgress(
    webhookUrl: string,
    taskId: string,
    conversationId: string,
    userId: string,
    step: string,
    sequence: number,
    totalSteps: number,
    message?: string,
  ): Promise<void> {
    await this.sendStatus(webhookUrl, {
      taskId,
      conversationId,
      userId,
      status: 'progress',
      timestamp: new Date().toISOString(),
      step,
      sequence,
      totalSteps,
      message: message || `Executing step ${sequence}/${totalSteps}: ${step}`,
    });
  }

  /**
   * Send completed status
   */
  async sendCompleted(
    webhookUrl: string,
    taskId: string,
    conversationId: string,
    userId: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    await this.sendStatus(webhookUrl, {
      taskId,
      conversationId,
      userId,
      status: 'completed',
      timestamp: new Date().toISOString(),
      message: 'Workflow execution completed',
      data,
    });
  }

  /**
   * Send failed status
   */
  async sendFailed(
    webhookUrl: string,
    taskId: string,
    conversationId: string,
    userId: string,
    error: string,
  ): Promise<void> {
    await this.sendStatus(webhookUrl, {
      taskId,
      conversationId,
      userId,
      status: 'failed',
      timestamp: new Date().toISOString(),
      message: 'Workflow execution failed',
      error,
    });
  }
}
```

---

### Phase 3: LangGraph Workflow Implementation

#### 3.1 LangGraph State Graph Setup

**Install LangGraph:**
```bash
npm install @langchain/langgraph @langchain/core
```

**Define State Schema:**
```typescript
// workflows/graphs/marketing-swarm.graph.ts
import { StateGraph, END } from '@langchain/langgraph';

export interface MarketingSwarmState {
  // Input
  announcement: string;
  provider: string;
  model: string;
  taskId: string;
  conversationId: string;
  userId: string;
  statusWebhook?: string;

  // Intermediate results
  webPost?: string;
  seoContent?: string;
  socialMedia?: string;

  // Final output
  result?: {
    webPost: string;
    seoContent: string;
    socialMedia: string;
  };

  // Metadata
  errors?: string[];
}
```

#### 3.2 Define Workflow Nodes

**Generic LLM Node:**
```typescript
// workflows/nodes/llm-node.ts
import { Injectable } from '@nestjs/common';
import { LLMHttpClientService } from '../../services/llm-http-client.service';
import { WebhookStatusService } from '../../services/webhook-status.service';

@Injectable()
export class LLMNodeExecutor {
  constructor(
    private readonly llmClient: LLMHttpClientService,
    private readonly webhookService: WebhookStatusService,
  ) {}

  async execute(
    state: Record<string, unknown>,
    config: {
      systemMessage: string;
      userMessageField: string;
      outputField: string;
      stepName: string;
      sequence: number;
      totalSteps: number;
    },
  ): Promise<Partial<Record<string, unknown>>> {
    const {
      provider,
      model,
      taskId,
      conversationId,
      userId,
      statusWebhook,
    } = state as {
      provider: string;
      model: string;
      taskId: string;
      conversationId: string;
      userId: string;
      statusWebhook?: string;
    };

    // Send progress update
    if (statusWebhook) {
      await this.webhookService.sendProgress(
        statusWebhook,
        taskId,
        conversationId,
        userId,
        config.stepName,
        config.sequence,
        config.totalSteps,
      );
    }

    // Make LLM call
    const userMessage = state[config.userMessageField] as string;
    const result = await this.llmClient.callLLM({
      provider,
      model,
      systemMessage: config.systemMessage,
      userMessage,
    });

    // Return updated state
    return {
      [config.outputField]: result.text,
    };
  }
}
```

#### 3.3 Build Marketing Swarm Graph

**`workflows/graphs/marketing-swarm.graph.ts`:**
```typescript
import { StateGraph, END } from '@langchain/langgraph';
import { Injectable } from '@nestjs/common';
import { LLMNodeExecutor } from '../nodes/llm-node';
import { WebhookStatusService } from '../../services/webhook-status.service';

export interface MarketingSwarmState {
  announcement: string;
  provider: string;
  model: string;
  taskId: string;
  conversationId: string;
  userId: string;
  statusWebhook?: string;
  webPost?: string;
  seoContent?: string;
  socialMedia?: string;
  result?: Record<string, string>;
  errors?: string[];
}

@Injectable()
export class MarketingSwarmGraph {
  constructor(
    private readonly llmNode: LLMNodeExecutor,
    private readonly webhookService: WebhookStatusService,
  ) {}

  buildGraph(): StateGraph<MarketingSwarmState> {
    const graph = new StateGraph<MarketingSwarmState>({
      channels: {
        announcement: null,
        provider: null,
        model: null,
        taskId: null,
        conversationId: null,
        userId: null,
        statusWebhook: null,
        webPost: null,
        seoContent: null,
        socialMedia: null,
        result: null,
        errors: null,
      },
    });

    // Define nodes
    graph.addNode('webPost', async (state) => {
      return this.llmNode.execute(state, {
        systemMessage:
          'You are a brilliant blog post writer who specializes in being both entertaining and informative, and you\'re best known for being able to write posts for all audiences.',
        userMessageField: 'announcement',
        outputField: 'webPost',
        stepName: 'Write Blog Post',
        sequence: 1,
        totalSteps: 3,
      });
    });

    graph.addNode('seoContent', async (state) => {
      return this.llmNode.execute(state, {
        systemMessage:
          'You are an expert SEO specialist. Generate comprehensive SEO-optimized content including: meta title (60 chars max), meta description (155 chars max), 5-10 relevant keywords, H1 heading, and JSON-LD structured data for the given topic.',
        userMessageField: 'announcement',
        outputField: 'seoContent',
        stepName: 'Create SEO',
        sequence: 2,
        totalSteps: 3,
      });
    });

    graph.addNode('socialMedia', async (state) => {
      return this.llmNode.execute(state, {
        systemMessage:
          'You are a social media content strategist. Create engaging social media posts (NOT blog posts) for multiple platforms: Twitter/X (280 chars with hashtags), LinkedIn (professional tone, 1300 chars max), and Facebook (conversational, 500 chars).',
        userMessageField: 'announcement',
        outputField: 'socialMedia',
        stepName: 'Create Social Media',
        sequence: 3,
        totalSteps: 3,
      });
    });

    graph.addNode('merge', async (state) => {
      return {
        result: {
          webPost: state.webPost!,
          seoContent: state.seoContent!,
          socialMedia: state.socialMedia!,
        },
      };
    });

    // Define edges (parallel execution for the 3 tasks)
    graph.setEntryPoint('webPost');
    graph.addEdge('webPost', 'seoContent');
    graph.addEdge('seoContent', 'socialMedia');
    graph.addEdge('socialMedia', 'merge');
    graph.addEdge('merge', END);

    return graph;
  }

  async execute(input: MarketingSwarmState): Promise<MarketingSwarmState> {
    const graph = this.buildGraph();
    const compiled = graph.compile();

    // Send start webhook
    if (input.statusWebhook) {
      await this.webhookService.sendStarted(
        input.statusWebhook,
        input.taskId,
        input.conversationId,
        input.userId,
        3, // totalSteps
      );
    }

    try {
      const result = await compiled.invoke(input);

      // Send completion webhook
      if (input.statusWebhook) {
        await this.webhookService.sendCompleted(
          input.statusWebhook,
          input.taskId,
          input.conversationId,
          input.userId,
          result.result,
        );
      }

      return result;
    } catch (error) {
      // Send failure webhook
      if (input.statusWebhook) {
        await this.webhookService.sendFailed(
          input.statusWebhook,
          input.taskId,
          input.conversationId,
          input.userId,
          error.message,
        );
      }
      throw error;
    }
  }
}
```

---

### Phase 4: HTTP Endpoints & Controller

#### 4.1 Workflows Controller

**`workflows/workflows.controller.ts`:**
```typescript
import { Controller, Post, Body, Logger } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { WorkflowRequestDto } from '../common/dto/workflow-request.dto';
import { WorkflowResponseDto } from '../common/dto/workflow-response.dto';

@Controller('workflows')
export class WorkflowsController {
  private readonly logger = new Logger(WorkflowsController.name);

  constructor(private readonly workflowsService: WorkflowsService) {}

  @Post('marketing-swarm')
  async executeMarketingSwarm(
    @Body() request: WorkflowRequestDto,
  ): Promise<WorkflowResponseDto> {
    this.logger.log(
      `Executing marketing-swarm workflow for task ${request.taskId}`,
    );

    const startTime = Date.now();
    const result = await this.workflowsService.executeMarketingSwarm(request);
    const executionTime = Date.now() - startTime;

    return {
      success: true,
      taskId: request.taskId,
      conversationId: request.conversationId,
      data: result.result!,
      metadata: {
        executionTime,
        stepsCompleted: 3,
        provider: request.provider,
        model: request.model,
      },
    };
  }

  @Post('requirements-writer')
  async executeRequirementsWriter(
    @Body() request: WorkflowRequestDto,
  ): Promise<WorkflowResponseDto> {
    this.logger.log(
      `Executing requirements-writer workflow for task ${request.taskId}`,
    );

    // Placeholder - implement similar to marketing-swarm
    throw new Error('Not yet implemented');
  }
}
```

#### 4.2 Workflows Service

**`workflows/workflows.service.ts`:**
```typescript
import { Injectable } from '@nestjs/common';
import { MarketingSwarmGraph, MarketingSwarmState } from './graphs/marketing-swarm.graph';
import { WorkflowRequestDto } from '../common/dto/workflow-request.dto';

@Injectable()
export class WorkflowsService {
  constructor(private readonly marketingSwarmGraph: MarketingSwarmGraph) {}

  async executeMarketingSwarm(
    request: WorkflowRequestDto,
  ): Promise<MarketingSwarmState> {
    const input: MarketingSwarmState = {
      announcement: request.prompt,
      provider: request.provider,
      model: request.model,
      taskId: request.taskId,
      conversationId: request.conversationId,
      userId: request.userId,
      statusWebhook: request.statusWebhook,
    };

    return this.marketingSwarmGraph.execute(input);
  }
}
```

---

### Phase 5: Application Bootstrap

#### 5.1 Main Module

**`app.module.ts`:**
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { WorkflowsModule } from './workflows/workflows.module';
import { HealthModule } from './health/health.module';
import { LLMHttpClientService } from './services/llm-http-client.service';
import { WebhookStatusService } from './services/webhook-status.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    WorkflowsModule,
    HealthModule,
  ],
  providers: [LLMHttpClientService, WebhookStatusService],
  exports: [LLMHttpClientService, WebhookStatusService],
})
export class AppModule {}
```

**`main.ts`:**
```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Enable CORS
  app.enableCors();

  // Get port from config
  const port = configService.get<number>('LANGGRAPH_PORT') || 7200;
  const host = configService.get<string>('LANGGRAPH_HOST') || '0.0.0.0';

  await app.listen(port, host);
  logger.log(`🚀 LangGraph application is running on: http://${host}:${port}`);
}

bootstrap();
```

---

### Phase 6: Testing Strategy

#### 6.1 Unit Tests

**Test Services:**
- `LLMHttpClientService` - Mock HTTP calls to LLM service
- `WebhookStatusService` - Mock HTTP calls to webhook endpoints
- `LLMNodeExecutor` - Test node execution logic
- `MarketingSwarmGraph` - Test graph construction and execution

#### 6.2 Integration Tests

**Test Workflows End-to-End:**
```typescript
// test/workflows/marketing-swarm.e2e-spec.ts
describe('Marketing Swarm Workflow (e2e)', () => {
  it('should execute workflow with valid inputs', async () => {
    const response = await request(app.getHttpServer())
      .post('/workflows/marketing-swarm')
      .send({
        taskId: '123e4567-e89b-12d3-a456-426614174000',
        conversationId: '123e4567-e89b-12d3-a456-426614174001',
        userId: '123e4567-e89b-12d3-a456-426614174002',
        provider: 'openai',
        model: 'gpt-4',
        prompt: 'Launch of our new AI product',
        statusWebhook: 'http://localhost:7100/webhooks/status',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('webPost');
    expect(response.body.data).toHaveProperty('seoContent');
    expect(response.body.data).toHaveProperty('socialMedia');
  });
});
```

---

### Phase 7: Deployment & DevOps

#### 7.1 Package.json Scripts

```json
{
  "scripts": {
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "build": "nest build",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:e2e": "jest --config ./test/jest-e2e.json"
  }
}
```

#### 7.2 Docker Support (Optional)

**`Dockerfile`:**
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

EXPOSE 7200

CMD ["node", "dist/main"]
```

---

## Future Enhancements

### Human-in-the-Loop Support

**Webhook Pattern for Human Response:**
```typescript
// Future: Add human checkpoint nodes
graph.addNode('humanCheckpoint', async (state) => {
  // Send webhook requesting human input
  await webhookService.sendStatus(state.statusWebhook, {
    taskId: state.taskId,
    status: 'awaiting_human',
    message: 'Please review and approve the content',
    data: { webPost: state.webPost },
  });

  // Wait for human response via callback endpoint
  const humanResponse = await waitForHumanResponse(state.taskId);

  return {
    humanApproval: humanResponse.approved,
    humanFeedback: humanResponse.feedback,
  };
});
```

### State Persistence

- Add Redis/PostgreSQL for workflow state storage
- Enable workflow pause/resume
- Support long-running workflows

### Parallel Execution Optimization

- Use LangGraph's parallel execution capabilities
- Optimize node dependencies for concurrent execution

---

## Success Criteria

✅ **Functional Requirements:**
1. LangGraph NestJS app runs independently on port 7200
2. Marketing Swarm workflow executes successfully end-to-end
3. LLM calls are routed through centralized LLM service via HTTP
4. Webhook status updates are sent at each workflow step
5. Response format matches API agent expectations

✅ **Technical Requirements:**
1. TypeScript-based LangGraph workflows (no Python)
2. Proper error handling and logging
3. Input validation using class-validator
4. Health check endpoint for monitoring
5. Unit test coverage > 80%

✅ **Integration Requirements:**
1. Successfully integrates with existing LLM service endpoints
2. Webhook updates are received by API webhooks controller
3. Response format compatible with API agent runner expectations

---

## Testing Plan

### Test Scenarios

1. **Happy Path:**
   - Submit valid marketing swarm request
   - Verify all 3 LLM calls execute
   - Verify 4 webhook updates sent (start + 3 progress)
   - Verify correct response format

2. **Error Handling:**
   - LLM service unavailable
   - Invalid provider/model
   - Webhook endpoint unreachable
   - Malformed input data

3. **Performance:**
   - Measure execution time for 3-node workflow
   - Verify parallel execution efficiency
   - Test with different provider/model combinations

---

## Potential Challenges & Solutions

### Challenge 1: LangGraph TypeScript Maturity
**Risk:** LangGraph is newer in TypeScript, may have limited features
**Solution:** Start with simple linear workflows, add complexity incrementally

### Challenge 2: LLM Service HTTP Integration
**Risk:** Latency from HTTP calls vs direct service injection
**Solution:** Implement connection pooling, consider caching for repeated calls

### Challenge 3: Webhook Reliability
**Risk:** Webhook endpoints may be unreachable or slow
**Solution:** Implement retry logic with exponential backoff, don't block workflow on webhook failures

### Challenge 4: State Management for Complex Workflows
**Risk:** In-memory state won't scale for long-running workflows
**Solution:** Phase 2 - implement Redis-backed state persistence

---

## File Checklist

**Core Application:**
- [ ] `apps/langgraph/src/main.ts`
- [ ] `apps/langgraph/src/app.module.ts`
- [ ] `apps/langgraph/package.json`
- [ ] `apps/langgraph/.env.example`

**Services:**
- [ ] `services/llm-http-client.service.ts`
- [ ] `services/webhook-status.service.ts`

**DTOs:**
- [ ] `common/dto/workflow-request.dto.ts`
- [ ] `common/dto/workflow-response.dto.ts`

**Workflows:**
- [ ] `workflows/workflows.module.ts`
- [ ] `workflows/workflows.controller.ts`
- [ ] `workflows/workflows.service.ts`
- [ ] `workflows/graphs/marketing-swarm.graph.ts`
- [ ] `workflows/nodes/llm-node.ts`

**Tests:**
- [ ] `test/workflows/marketing-swarm.e2e-spec.ts`
- [ ] `workflows/graphs/marketing-swarm.graph.spec.ts`

---

## Implementation Timeline Estimate

**Phase 1 (Setup & Infrastructure):** 1-2 days
**Phase 2 (Core Services):** 1 day
**Phase 3 (LangGraph Workflows):** 2-3 days
**Phase 4 (HTTP Endpoints):** 1 day
**Phase 5 (Testing):** 2 days
**Phase 6 (Documentation & Polish):** 1 day

**Total:** 8-10 days for full implementation

---

## Existing Services Reference

### LLM Service Endpoint

**Location:** `apps/api/src/llms/llm.controller.ts`

**Endpoint:** `POST /llm/generate`

**Request Format:**
```typescript
{
  systemPrompt: string;
  userPrompt: string;
  options?: {
    temperature?: number;
    maxTokens?: number;
    provider?: 'openai' | 'anthropic' | 'ollama' | 'google';
    providerName?: string;  // UI-friendly provider name
    modelName?: string;      // UI-friendly model name
    callerType?: string;     // e.g., 'langgraph'
    callerName?: string;     // e.g., 'marketing-swarm'
    conversationId?: string;
    dataClassification?: string;
  };
}
```

**Response Format:**
```typescript
{
  response: string;      // Main LLM response
  content: string;       // Same as response
  metadata?: Record<string, unknown>;
  sanitizationMetadata?: Record<string, unknown>;
  piiMetadata?: Record<string, unknown>;
}
```

**Usage in LangGraph:**
```typescript
// Update LLMHttpClientService to use this endpoint
const url = `${this.llmServiceUrl}/llm/generate`;
const response = await firstValueFrom(
  this.httpService.post(url, {
    systemPrompt: request.systemMessage,
    userPrompt: request.userMessage,
    options: {
      provider: request.provider,
      temperature: request.temperature ?? 0.7,
      maxTokens: request.maxTokens ?? 2000,
      callerType: 'langgraph',
      callerName: 'workflow-executor',
    },
  }),
);
```

### Webhook Status Endpoint

**Location:** `apps/api/src/webhooks/webhooks.controller.ts`

**Endpoint:** `POST /webhooks/status`

**Request Format:**
```typescript
{
  // Required
  taskId: string;
  status: string;           // 'started' | 'progress' | 'completed' | 'failed'
  timestamp: string;        // ISO 8601 format

  // Optional workflow identification
  executionId?: string;
  workflowId?: string;
  workflowName?: string;

  // Optional context
  conversationId?: string;
  userId?: string;

  // Optional progress tracking
  step?: string;
  percent?: number;
  message?: string;
  node?: string;
  stage?: string;
  results?: Record<string, unknown>;

  // Sequence tracking (for multi-step workflows)
  sequence?: number;
  totalSteps?: number;

  // Additional data
  data?: {
    sequence?: number;
    totalSteps?: number;
    [key: string]: unknown;
  };
}
```

**Response:** HTTP 204 No Content

**Usage in LangGraph:**
```typescript
// The WebhookStatusService already sends to this format
await this.httpService.post('http://localhost:7100/webhooks/status', {
  taskId: state.taskId,
  status: 'progress',
  timestamp: new Date().toISOString(),
  conversationId: state.conversationId,
  userId: state.userId,
  step: 'Write Blog Post',
  sequence: 1,
  totalSteps: 3,
  message: 'Executing step 1/3: Write Blog Post',
});
```

---

## Updated Configuration

### Environment Variables (Corrected)

```env
# LangGraph Application
LANGGRAPH_PORT=7200
LANGGRAPH_HOST=0.0.0.0

# LLM Service Integration (UPDATED)
LLM_SERVICE_URL=http://localhost:7100
LLM_ENDPOINT=/llm/generate              # Actual endpoint

# Webhook Configuration (UPDATED)
WEBHOOK_STATUS_URL=http://localhost:7100/webhooks/status

# Optional
NODE_ENV=development
LOG_LEVEL=debug
```

---

## Next Steps

1. **Validate Approach:** Review this plan with team, confirm architecture decisions
2. **Setup Project:** Create `apps/langgraph/` with NestJS CLI
3. **Implement Phase 1:** Project structure and configuration
4. **Test LLM Integration:** Verify HTTP calls to `/llm/generate` work correctly
5. **Test Webhook Integration:** Verify status updates to `/webhooks/status` are received
6. **Build First Workflow:** Start with a simple single-step workflow (finance/metrics pattern)
7. **Build Marketing Swarm:** Implement multi-step workflow with parallel execution
8. **Integration Testing:** Test end-to-end with actual LLM service and webhooks
9. **Add More Workflows:** Replicate pattern for requirements-writer and others
