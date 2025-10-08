import { Injectable, Optional } from '@nestjs/common';
import { FunctionAgentBaseService } from '@agents/base/implementations/base-services/function';
import { FunctionAgentServicesContext } from '@agents/base/services/function-agent-services-context';
import { LangChainNotionService } from '@/langchain/services/notion-tools.service';
import {
  AgentFunctionParams,
  AgentFunctionResponse,
} from '@agents/base/implementations/base-services/a2a-base/interfaces';

/**
 * Notion Agent Service
 *
 * Handles Notion workspace operations using LangChain.js tools.
 * Supports creating pages, updating content, querying databases, and organizing information.
 */
@Injectable()
export class NotionAgentService extends FunctionAgentBaseService {
  constructor(
    // Pure service container pattern - only accepts FunctionAgentServicesContext
    services: FunctionAgentServicesContext,
    @Optional()
    private readonly langchainNotion?: LangChainNotionService,
  ) {
    super(services);

    // Set total steps for Notion Agent workflow
    this.setTotalSteps(4);
  }

  getAgentName(): string {
    return 'Notion Agent';
  }

  getAgentType(): 'operations' {
    return 'operations';
  }

  /**
   * Execute Notion operations based on user request
   */
  async execute(params: AgentFunctionParams): Promise<AgentFunctionResponse> {
    try {
      await this.updateProgress(1, 'Analyzing Notion request...');

      const userMessage = params.userMessage || '';

      if (!this.langchainNotion) {
        throw new Error('LangChain Notion service not available');
      }

      // Check if LangChain Notion service is configured
      if (!this.langchainNotion.isConfigured()) {
        throw new Error('LangChain Notion service not properly configured');
      }

      return await this.handleNotionRequest(userMessage, params);
    } catch (error) {

      await this.updateProgress(4, 'Processing failed', 'error');

      return {
        success: false,
        response: `I encountered an error while processing your Notion request: ${
          error instanceof Error ? error.message : 'Unknown error'
        }. Please ensure the Notion integration is properly configured or try a different request.`,
        metadata: {
          agentName: this.getAgentName(),
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Handle Notion operations using LangChain.js tools
   */
  private async handleNotionRequest(
    userMessage: string,
    params: AgentFunctionParams,
  ): Promise<AgentFunctionResponse> {
    try {
      await this.updateProgress(2, 'Understanding your Notion request...');

      // Parse the user intent using LangChain
      const intentAnalysis = await this.langchainNotion!.processNotionRequest(
        userMessage,
        {
          provider: 'openai',
          model: 'gpt-4',
        },
      );

      await this.updateProgress(3, `Executing ${intentAnalysis.action}...`);

      // Execute the appropriate Notion action
      let actionResult: any;
      const tools = this.langchainNotion!.getAllNotionTools();

      switch (intentAnalysis.action) {
        case 'create-page':
          const createTool = tools.find((t) => t.name === 'notion-create-page');
          if (createTool) {
            const createParams = {
              title:
                intentAnalysis.parameters.title ||
                this.extractTitleFromMessage(userMessage),
              content: intentAnalysis.parameters.content || userMessage,
              databaseId: intentAnalysis.parameters.databaseId,
            };
            actionResult = await createTool.func(JSON.stringify(createParams));
          }
          break;

        case 'query-database':
          const queryTool = tools.find(
            (t) => t.name === 'notion-query-database',
          );
          if (queryTool) {
            const queryParams = {
              databaseId: intentAnalysis.parameters.databaseId || 'default-db',
              filter: intentAnalysis.parameters.filter,
              sorts: intentAnalysis.parameters.sorts,
            };
            actionResult = await queryTool.func(JSON.stringify(queryParams));
          }
          break;

        case 'update-page':
          const updateTool = tools.find((t) => t.name === 'notion-update-page');
          if (updateTool) {
            const updateParams = {
              pageId: intentAnalysis.parameters.pageId,
              updates: intentAnalysis.parameters.updates || {
                content: userMessage,
              },
            };
            actionResult = await updateTool.func(JSON.stringify(updateParams));
          }
          break;

        default:
          throw new Error(`Unknown Notion action: ${intentAnalysis.action}`);
      }

      await this.updateProgress(4, 'Notion operation complete');

      // Format the response
      const formattedResponse = await this.formatNotionResponse(
        userMessage,
        intentAnalysis,
        actionResult,
      );

      return {
        success: true,
        response: formattedResponse,
        metadata: {
          agentName: this.getAgentName(),
          action: intentAnalysis.action,
          intent: intentAnalysis.intent,
          parameters: intentAnalysis.parameters,
          timestamp: new Date().toISOString(),
          toolsUsed: ['LangChain.js', 'Notion API (Mock)'],
          responseType: 'notion-operation',
          note: 'Currently using mock Notion API - integrate with real API for production',
        },
      };
    } catch (error) {

      throw error;
    }
  }

  /**
   * Format the Notion operation response for the user
   */
  private async formatNotionResponse(
    originalRequest: string,
    intentAnalysis: any,
    actionResult: any,
  ): Promise<string> {
    let response = `## Notion Operation Complete\n\n`;
    response += `**Your Request**: ${originalRequest}\n\n`;
    response += `**Action Taken**: ${intentAnalysis.action}\n\n`;

    try {
      const parsedResult = JSON.parse(actionResult);

      if (parsedResult.success) {
        switch (intentAnalysis.action) {
          case 'create-page':
            response += `✅ **Page Created Successfully**\n`;
            response += `- **Title**: ${parsedResult.title}\n`;
            response += `- **Page ID**: ${parsedResult.pageId}\n`;
            response += `- **URL**: [Open in Notion](${parsedResult.url})\n`;
            response += `- **Created**: ${new Date(parsedResult.createdAt).toLocaleString()}\n`;
            break;

          case 'query-database':
            response += `📊 **Database Query Results**\n`;
            response += `- **Found**: ${parsedResult.results.length} pages\n`;
            if (parsedResult.results.length > 0) {
              response += `\n**Pages Found**:\n`;
              parsedResult.results.forEach((page: any, index: number) => {
                response += `${index + 1}. [${page.title}](${page.url}) (${new Date(page.createdAt).toLocaleDateString()})\n`;
              });
            }
            break;

          case 'update-page':
            response += `📝 **Page Updated Successfully**\n`;
            response += `- **Page ID**: ${parsedResult.pageId}\n`;
            response += `- **Updated**: ${new Date(parsedResult.updatedAt).toLocaleString()}\n`;
            break;
        }
      } else {
        response += `❌ **Operation Failed**: ${parsedResult.error}\n`;
      }
    } catch {
      response += `**Raw Result**: ${actionResult}\n`;
    }

    response += `\n**Technical Details**:\n`;
    response += `- **Intent**: ${intentAnalysis.intent}\n`;
    response += `- **Action**: ${intentAnalysis.action}\n`;
    response += `- **Parameters**: ${JSON.stringify(intentAnalysis.parameters, null, 2)}\n`;

    return response;
  }

  /**
   * Extract a page title from the user message
   */
  private extractTitleFromMessage(message: string): string {
    // Look for quoted strings as potential titles
    const quotedMatch = message.match(/"([^"]+)"/);
    if (quotedMatch && quotedMatch[1]) {
      return quotedMatch[1];
    }

    // Look for "create page" patterns
    const createPageMatch = message.match(
      /create (?:a )?page (?:called|named|titled) "?([^"]+)"?/i,
    );
    if (createPageMatch && createPageMatch[1]) {
      return createPageMatch[1];
    }

    // Fallback: use first few words
    const words = message.split(' ').slice(0, 5);
    return (
      words
        .join(' ')
        .replace(/[^\w\s]/g, '')
        .trim() || 'New Page'
    );
  }

  /**
   * Update task progress
   */
  private async updateProgress(
    step: number,
    message: string,
    status: 'in_progress' | 'completed' | 'error' = 'in_progress',
  ): Promise<void> {
    // TaskProgressGateway.emitProgress method not available - progress updates disabled

  }
}
