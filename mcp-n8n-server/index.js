#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { N8nAPI } from './n8n-api.js';

// Load environment variables
dotenv.config({ path: '../.env' });

class N8nMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'n8n-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize N8n API
    const n8nUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678';
    const apiKey = process.env.N8N_API_KEY;
    
    if (!apiKey) {
      throw new Error('N8N_API_KEY environment variable is required');
    }

    this.n8nAPI = new N8nAPI(n8nUrl, apiKey);
    this.setupToolHandlers();
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'list_workflows',
            description: 'List all N8n workflows',
            inputSchema: {
              type: 'object',
              properties: {},
              required: [],
            },
          },
          {
            name: 'get_workflow',
            description: 'Get a specific N8n workflow by ID',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'Workflow ID',
                },
              },
              required: ['id'],
            },
          },
          {
            name: 'create_workflow',
            description: 'Create a new N8n workflow',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Workflow name',
                },
                nodes: {
                  type: 'array',
                  description: 'Workflow nodes',
                },
                connections: {
                  type: 'object',
                  description: 'Node connections',
                },
                active: {
                  type: 'boolean',
                  description: 'Whether workflow should be active',
                  default: false,
                },
              },
              required: ['name', 'nodes', 'connections'],
            },
          },
          {
            name: 'update_workflow',
            description: 'Update an existing N8n workflow',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'Workflow ID',
                },
                name: {
                  type: 'string',
                  description: 'Workflow name',
                },
                nodes: {
                  type: 'array',
                  description: 'Workflow nodes',
                },
                connections: {
                  type: 'object',
                  description: 'Node connections',
                },
                active: {
                  type: 'boolean',
                  description: 'Whether workflow should be active',
                },
              },
              required: ['id'],
            },
          },
          {
            name: 'delete_workflow',
            description: 'Delete an N8n workflow',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'Workflow ID',
                },
              },
              required: ['id'],
            },
          },
          {
            name: 'execute_workflow',
            description: 'Execute an N8n workflow',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'Workflow ID',
                },
                data: {
                  type: 'object',
                  description: 'Input data for workflow execution',
                  default: {},
                },
              },
              required: ['id'],
            },
          },
          {
            name: 'set_workflow_active',
            description: 'Activate or deactivate an N8n workflow',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'Workflow ID',
                },
                active: {
                  type: 'boolean',
                  description: 'Whether to activate (true) or deactivate (false)',
                },
              },
              required: ['id', 'active'],
            },
          },
          {
            name: 'get_executions',
            description: 'Get execution history for a workflow',
            inputSchema: {
              type: 'object',
              properties: {
                workflowId: {
                  type: 'string',
                  description: 'Workflow ID',
                },
                limit: {
                  type: 'number',
                  description: 'Number of executions to retrieve',
                  default: 10,
                },
              },
              required: ['workflowId'],
            },
          },
          {
            name: 'get_execution',
            description: 'Get details of a specific execution',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'Execution ID',
                },
              },
              required: ['id'],
            },
          },
          {
            name: 'test_n8n_connection',
            description: 'Test connection to N8n instance',
            inputSchema: {
              type: 'object',
              properties: {},
              required: [],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        let result;

        switch (name) {
          case 'list_workflows':
            result = await this.n8nAPI.listWorkflows();
            break;

          case 'get_workflow':
            result = await this.n8nAPI.getWorkflow(args.id);
            break;

          case 'create_workflow':
            result = await this.n8nAPI.createWorkflow({
              name: args.name,
              nodes: args.nodes,
              connections: args.connections,
              active: args.active || false,
            });
            break;

          case 'update_workflow':
            const updateData = { ...args };
            delete updateData.id;
            result = await this.n8nAPI.updateWorkflow(args.id, updateData);
            break;

          case 'delete_workflow':
            result = await this.n8nAPI.deleteWorkflow(args.id);
            break;

          case 'execute_workflow':
            result = await this.n8nAPI.executeWorkflow(args.id, args.data || {});
            break;

          case 'set_workflow_active':
            result = await this.n8nAPI.setWorkflowActive(args.id, args.active);
            break;

          case 'get_executions':
            result = await this.n8nAPI.getExecutions(args.workflowId, args.limit || 10);
            break;

          case 'get_execution':
            result = await this.n8nAPI.getExecution(args.id);
            break;

          case 'test_n8n_connection':
            result = await this.n8nAPI.testConnection();
            break;

          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error.message,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('N8n MCP server running on stdio');
  }
}

// Start the server
const server = new N8nMCPServer();
server.run().catch(console.error);