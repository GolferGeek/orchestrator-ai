import { Injectable, Logger } from '@nestjs/common';
import { ContextAgentBaseService } from '@agents/base/implementations/base-services/context/context-agent-base.service';
import { AgentServicesContext } from '@agents/base/services/agent-services-context';

@Injectable()
export class AgentCreatorService extends ContextAgentBaseService {
  protected readonly logger = new Logger(AgentCreatorService.name);

  constructor(services: AgentServicesContext) {
    super(services);
  }

  /**
   * Override processTask to add file generation capability
   */
  async processTask(taskRequest: any): Promise<any> {
    try {

      // First, let the AI handle the conversation normally
      const response = await super.processTask(taskRequest);

      // Check if AI has output agent file contents
      const shouldCreateAgent = this.shouldTriggerAgentCreation(response);
      
      if (shouldCreateAgent) {

        const fileContents = this.extractFileContents(response);
        if (fileContents) {

          return await this.createAgentFilesFromContent(fileContents, taskRequest);
        } else {

          // Return the original response instead of an error - let the AI handle clarification
          return response;
        }
      }

      return response;
    } catch (error) {

      return {
        message: "I apologize, but I encountered an error. Let me help you create your agent. What kind of agent would you like to build?",
        metadata: {
          agentName: 'Agent Creator',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Check if the AI response contains agent file contents
   */
  private shouldTriggerAgentCreation(response: any): boolean {
    const message = response.message || '';
    
    // Check for all three required file blocks
    const hasYaml = message.includes('```yaml') && message.includes('# ') && message.includes('metadata:');
    const hasMarkdown = message.includes('```markdown') && message.includes('# System Prompt');
    const hasTypescript = message.includes('```typescript') && message.includes('extends ContextAgentBaseService');
    
    return hasYaml && hasMarkdown && hasTypescript;
  }

  /**
   * Extract file contents from AI response
   */
  private extractFileContents(response: any): { yamlContent: string; mdContent: string; tsContent: string; agentInfo: any } | null {
    const message = response.message || '';
    
    try {
      // Extract YAML content
      const yamlMatch = message.match(/```yaml\n([\s\S]*?)\n```/);
      if (!yamlMatch) {

        return null;
      }
      const yamlContent = yamlMatch[1].trim();

      // Extract Markdown content
      const mdMatch = message.match(/```markdown\n([\s\S]*?)\n```/);
      if (!mdMatch) {

        return null;
      }
      const mdContent = mdMatch[1].trim();

      // Extract TypeScript content
      const tsMatch = message.match(/```typescript\n([\s\S]*?)\n```/);
      if (!tsMatch) {

        return null;
      }
      const tsContent = tsMatch[1].trim();

      // Extract basic agent info from YAML content for metadata
      const agentInfo = this.parseAgentInfoFromYaml(yamlContent);

      return { yamlContent, mdContent, tsContent, agentInfo };
      
    } catch (error) {

      return null;
    }
  }

  /**
   * Parse basic agent info from YAML content
   */
  private parseAgentInfoFromYaml(yamlContent: string): any {
    try {
      const nameMatch = yamlContent.match(/name:\s*"([^"]+)"/);
      const deptMatch = yamlContent.match(/department:\s*([^\n]+)/);
      const descMatch = yamlContent.match(/description:\s*"([^"]+)"/);
      
      return {
        agent_name: nameMatch?.[1] ? nameMatch[1].toLowerCase().replace(/[^a-z0-9]/g, '_') : 'new_agent',
        display_name: nameMatch?.[1] ? nameMatch[1] : 'New Agent',
        department: deptMatch?.[1] ? deptMatch[1].trim() : 'specialists',
        description: descMatch?.[1] ? descMatch[1] : 'Generated agent'
      };
    } catch (error) {

      return {
        agent_name: 'new_agent',
        display_name: 'New Agent',
        department: 'specialists',
        description: 'Generated agent'
      };
    }
  }

  /**
   * Create agent files directly from extracted content
   */
  private async createAgentFilesFromContent(fileContents: { yamlContent: string; mdContent: string; tsContent: string; agentInfo: any }, taskRequest: any): Promise<any> {
    try {
      const { yamlContent, mdContent, tsContent, agentInfo } = fileContents;

      // Import fs and path for direct file operations
      const fs = await import('fs/promises');
      const path = await import('path');

      // Use fixed base directory path
      const AGENTS_BASE_DIR = '/Users/Justin/projects/GolferGeek/orchestrator-ai/apps/api/src/agents/actual';
      const agentDir = path.join(AGENTS_BASE_DIR, agentInfo.department, agentInfo.agent_name);

      // Check if agent already exists
      try {
        await fs.access(agentDir);
        throw new Error(`Agent '${agentInfo.agent_name}' already exists in ${agentInfo.department} department`);
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
        // Directory doesn't exist - this is what we want
      }

      // Create agent directory
      await fs.mkdir(agentDir, { recursive: true });

      // Write the three files directly
      const yamlPath = path.join(agentDir, 'agent.yaml');
      const mdPath = path.join(agentDir, 'context.md');
      const tsPath = path.join(agentDir, 'agent-service.ts');

      await fs.writeFile(yamlPath, yamlContent);
      await fs.writeFile(mdPath, mdContent);
      await fs.writeFile(tsPath, tsContent);

      // Trigger agent discovery refresh so new agent appears immediately
      try {
        const baseUrl = process.env.API_BASE_URL || 'http://localhost:4000';
        const authToken = taskRequest.authToken;
        const headers: any = { 'Content-Type': 'application/json' };
        
        if (authToken) {
          headers.Authorization = `Bearer ${authToken}`;
        }

        await this.httpService.axiosRef.get(
          `${baseUrl}/agents/.well-known/hierarchy`,
          { headers }
        );

      } catch (refreshError) {

      }

      return {
        message: `🎉 **Agent Created Successfully!**

I've generated your **${agentInfo.display_name}** agent and added it to your codebase!

**✅ Files Created:**
- \`agent.yaml\` - Agent configuration and metadata
- \`context.md\` - AI behavior and expertise
- \`agent-service.ts\` - Service implementation

**📍 Location:** \`${agentInfo.department}/${agentInfo.agent_name}/\`

**🚀 Ready to Use!** Your agent is now:
- ✓ Added to the codebase
- ✓ Discovered by the system
- ✓ Available for conversations

You can start using it immediately!

No coding required - your agent is live and ready!`,
        metadata: {
          agentName: 'Agent Creator',
          created_agent: {
            name: agentInfo.agent_name,
            display_name: agentInfo.display_name,
            department: agentInfo.department,
            file_paths: {
              yaml: yamlPath,
              markdown: mdPath,
              typescript: tsPath
            }
          }
        }
      };

    } catch (error) {

      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        errorMessage = JSON.stringify(error);
      }
      
      // Check if it's an HTTP error with response details
      if ((error as any).response) {
        const httpError = error as any;

        errorMessage = `API Error (${httpError.response.status}): ${httpError.response.data?.message || httpError.response.statusText}`;
      }
      
      return {
        message: `I encountered an error while creating your agent: ${errorMessage}

This might be due to:
- Authentication issues
- Service unavailability  
- Invalid agent configuration

Let's try again. Can you tell me again about the agent you'd like to create? I'll make sure to gather all the necessary information this time.`,
        metadata: {
          agentName: 'Agent Creator',
          error: errorMessage,
          httpStatus: (error as any).response?.status
        }
      };
    }
  }

  /**
   * Override the default name generation to return the correct agent name
   */
  getAgentName(): string {
    return 'Agent Creator';
  }
}