import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MCPToolDefinition,
  MCPToolRequest,
  MCPToolResponse,
  IMCPToolHandler,
} from '../interfaces/mcp.interface';

/**
 * Slack MCP Tools Handler
 *
 * Implements productivity namespace tools for Slack workspace operations
 * Provides: messaging, channel management, user information, and search capabilities
 */
@Injectable()
export class SlackMCPTools implements IMCPToolHandler {
  private readonly logger = new Logger(SlackMCPTools.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Get all Slack tools available
   */
  async getTools(): Promise<MCPToolDefinition[]> {
    return [
      {
        name: 'send-message',
        description: 'Send a message to a Slack channel or user',
        inputSchema: {
          type: 'object',
          properties: {
            channel: {
              type: 'string',
              description:
                'Channel ID or name (e.g., #general, @username, or C1234567890)',
            },
            text: {
              type: 'string',
              description: 'Message text content',
            },
            thread_ts: {
              type: 'string',
              description: 'Timestamp of parent message to reply in thread',
            },
            blocks: {
              type: 'array',
              description: 'Rich message blocks (Slack Block Kit format)',
              items: { type: 'object' },
            },
          },
          required: ['channel', 'text'],
          additionalProperties: false,
        },
      },
      {
        name: 'get-channels',
        description: 'List channels in the Slack workspace',
        inputSchema: {
          type: 'object',
          properties: {
            types: {
              type: 'string',
              description:
                'Channel types to include (public_channel, private_channel, mpim, im)',
              default: 'public_channel',
            },
            exclude_archived: {
              type: 'boolean',
              description: 'Exclude archived channels',
              default: true,
            },
            limit: {
              type: 'number',
              description: 'Maximum number of channels to return',
              default: 100,
            },
          },
          required: [],
          additionalProperties: false,
        },
      },
      {
        name: 'get-users',
        description: 'Get information about workspace users',
        inputSchema: {
          type: 'object',
          properties: {
            user_id: {
              type: 'string',
              description: 'Specific user ID to get info for',
            },
            include_deleted: {
              type: 'boolean',
              description: 'Include deleted/deactivated users',
              default: false,
            },
            limit: {
              type: 'number',
              description: 'Maximum number of users to return',
              default: 100,
            },
          },
          required: [],
          additionalProperties: false,
        },
      },
      {
        name: 'search-messages',
        description: 'Search for messages in Slack workspace',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query string',
            },
            channel: {
              type: 'string',
              description: 'Limit search to specific channel',
            },
            user: {
              type: 'string',
              description: 'Limit search to messages from specific user',
            },
            count: {
              type: 'number',
              description: 'Number of results to return',
              default: 20,
            },
            sort: {
              type: 'string',
              enum: ['score', 'timestamp'],
              description: 'Sort results by relevance or time',
              default: 'score',
            },
          },
          required: ['query'],
          additionalProperties: false,
        },
      },
      {
        name: 'get-channel-history',
        description: 'Get recent messages from a channel',
        inputSchema: {
          type: 'object',
          properties: {
            channel: {
              type: 'string',
              description: 'Channel ID or name',
            },
            count: {
              type: 'number',
              description: 'Number of messages to retrieve',
              default: 100,
            },
            oldest: {
              type: 'string',
              description: 'Start of time range (Unix timestamp)',
            },
            latest: {
              type: 'string',
              description: 'End of time range (Unix timestamp)',
            },
            inclusive: {
              type: 'boolean',
              description: 'Include messages with oldest and latest timestamps',
              default: true,
            },
          },
          required: ['channel'],
          additionalProperties: false,
        },
      },
      {
        name: 'create-channel',
        description: 'Create a new Slack channel',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Channel name (lowercase, no spaces)',
            },
            is_private: {
              type: 'boolean',
              description: 'Create as private channel',
              default: false,
            },
            purpose: {
              type: 'string',
              description: 'Channel purpose/description',
            },
            topic: {
              type: 'string',
              description: 'Channel topic',
            },
          },
          required: ['name'],
          additionalProperties: false,
        },
      },
    ];
  }

  /**
   * Execute a Slack tool
   */
  async executeTool(request: MCPToolRequest): Promise<MCPToolResponse> {
    const { name, arguments: args = {} } = request;

    try {
      switch (name) {
        case 'send-message':
          return await this.sendMessage(args);
        case 'get-channels':
          return await this.getChannels(args);
        case 'get-users':
          return await this.getUsers(args);
        case 'search-messages':
          return await this.searchMessages(args);
        case 'get-channel-history':
          return await this.getChannelHistory(args);
        case 'create-channel':
          return await this.createChannel(args);
        default:
          return this.createErrorResponse(`Unknown Slack tool: ${name}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Slack tool ${name} failed: ${errorMessage}`);
      return this.createErrorResponse(`Tool execution failed: ${errorMessage}`);
    }
  }

  /**
   * Health check for Slack API connection
   */
  async ping(): Promise<boolean> {
    try {
      // Check if basic configuration is available
      const slackToken = this.configService.get('SLACK_BOT_TOKEN');

      if (!slackToken) {
        this.logger.debug(
          'Slack configuration not available - tools will be available but may fail at execution',
        );
        return false;
      }

      // Try a lightweight connection test
      const response = await this.makeSlackRequest('api.test', 'GET');
      const _data = await response.json();
      return data.ok === true;
    } catch (error) {
      this.logger.debug(
        `Slack ping failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Send a message to Slack
   */
  private async sendMessage(args: any): Promise<MCPToolResponse> {
    const { channel, text, thread_ts, blocks } = args;

    try {
      const payload: any = { channel, text };

      if (thread_ts) {
        payload.thread_ts = thread_ts;
      }

      if (blocks) {
        payload.blocks = blocks;
      }

      const response = await this.makeSlackRequest(
        'chat.postMessage',
        'POST',
        payload,
      );
      const _data = await response.json();

      if (!data.ok) {
        throw new Error(`Slack API error: ${data.error}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                channel: data.channel,
                timestamp: data.ts,
                message: data.message,
                sent_at: new Date().toISOString(),
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      return this.createErrorResponse(
        `Send message failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get channels list
   */
  private async getChannels(args: any): Promise<MCPToolResponse> {
    const {
      types = 'public_channel',
      exclude_archived = true,
      limit = 100,
    } = args;

    try {
      const params = new URLSearchParams({
        types,
        exclude_archived: exclude_archived.toString(),
        limit: limit.toString(),
      });

      const response = await this.makeSlackRequest(
        `conversations.list?${params}`,
        'GET',
      );
      const _data = await response.json();

      if (!data.ok) {
        throw new Error(`Slack API error: ${data.error}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                channels: data.channels,
                total_count: data.channels?.length || 0,
                retrieved_at: new Date().toISOString(),
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      return this.createErrorResponse(
        `Get channels failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get users information
   */
  private async getUsers(args: any): Promise<MCPToolResponse> {
    const { user_id, include_deleted = false, limit = 100 } = args;

    try {
      if (user_id) {
        // Get specific user info
        const response = await this.makeSlackRequest(
          `users.info?user=${user_id}`,
          'GET',
        );
        const _data = await response.json();

        if (!data.ok) {
          throw new Error(`Slack API error: ${data.error}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  user: data.user,
                  retrieved_at: new Date().toISOString(),
                },
                null,
                2,
              ),
            },
          ],
        };
      } else {
        // Get users list
        const params = new URLSearchParams({
          include_locale: 'false',
          limit: limit.toString(),
        });

        const response = await this.makeSlackRequest(
          `users.list?${params}`,
          'GET',
        );
        const _data = await response.json();

        if (!data.ok) {
          throw new Error(`Slack API error: ${data.error}`);
        }

        let users = data.members || [];

        if (!include_deleted) {
          users = users.filter((user: any) => !user.deleted);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  users,
                  total_count: users.length,
                  retrieved_at: new Date().toISOString(),
                },
                null,
                2,
              ),
            },
          ],
        };
      }
    } catch (error) {
      return this.createErrorResponse(
        `Get users failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Search messages
   */
  private async searchMessages(args: any): Promise<MCPToolResponse> {
    const { query, channel, user, count = 20, sort = 'score' } = args;

    try {
      let searchQuery = query;

      if (channel) {
        searchQuery += ` in:${channel}`;
      }

      if (user) {
        searchQuery += ` from:${user}`;
      }

      const params = new URLSearchParams({
        query: searchQuery,
        count: count.toString(),
        sort,
      });

      const response = await this.makeSlackRequest(
        `search.messages?${params}`,
        'GET',
      );
      const _data = await response.json();

      if (!data.ok) {
        throw new Error(`Slack API error: ${data.error}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                matches: data.messages?.matches || [],
                total: data.messages?.total || 0,
                query: searchQuery,
                searched_at: new Date().toISOString(),
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      return this.createErrorResponse(
        `Search messages failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get channel history
   */
  private async getChannelHistory(args: any): Promise<MCPToolResponse> {
    const { channel, count = 100, oldest, latest, inclusive = true } = args;

    try {
      const params = new URLSearchParams({
        channel,
        limit: count.toString(),
        inclusive: inclusive.toString(),
      });

      if (oldest) {
        params.append('oldest', oldest);
      }

      if (latest) {
        params.append('latest', latest);
      }

      const response = await this.makeSlackRequest(
        `conversations.history?${params}`,
        'GET',
      );
      const _data = await response.json();

      if (!data.ok) {
        throw new Error(`Slack API error: ${data.error}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                messages: data.messages || [],
                has_more: data.has_more || false,
                channel,
                retrieved_at: new Date().toISOString(),
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      return this.createErrorResponse(
        `Get channel history failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Create a new channel
   */
  private async createChannel(args: any): Promise<MCPToolResponse> {
    const { name, is_private = false, purpose, topic } = args;

    try {
      const payload: any = { name, is_private };

      const response = await this.makeSlackRequest(
        'conversations.create',
        'POST',
        payload,
      );
      const _data = await response.json();

      if (!data.ok) {
        throw new Error(`Slack API error: ${data.error}`);
      }

      // Set purpose and topic if provided
      const channelId = data.channel.id;

      if (purpose) {
        await this.makeSlackRequest('conversations.setPurpose', 'POST', {
          channel: channelId,
          purpose,
        });
      }

      if (topic) {
        await this.makeSlackRequest('conversations.setTopic', 'POST', {
          channel: channelId,
          topic,
        });
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                channel: data.channel,
                created_at: new Date().toISOString(),
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      return this.createErrorResponse(
        `Create channel failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Make authenticated request to Slack API
   */
  private async makeSlackRequest(
    endpoint: string,
    method: string,
    body?: any,
  ): Promise<Response> {
    const slackToken =
      this.configService.get('SLACK_BOT_TOKEN') ||
      this.configService.get('SLACK_API_TOKEN');

    if (!slackToken) {
      throw new Error('Slack token not configured');
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${slackToken}`,
      'Content-Type': 'application/json',
    };

    const url = `https://slack.com/api/${endpoint}`;

    return fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Create error response
   */
  private createErrorResponse(message: string): MCPToolResponse {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: message,
            timestamp: new Date().toISOString(),
          }),
        },
      ],
      isError: true,
    };
  }
}
