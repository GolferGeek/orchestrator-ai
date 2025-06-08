import { Injectable } from '@nestjs/common';
import { A2AAgentBaseService } from '../a2a-base/a2a-agent-base.service';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class MCPContextAgentBaseService extends A2AAgentBaseService {
  
  private markdownContext: string = '';
  
  async onModuleInit() {
    // Load markdown context during initialization
    await this.loadMarkdownContext();
  }

  protected async executeTask(method: string, params: any): Promise<any> {
    // Enhanced task execution with context awareness
    const contextualParams = {
      ...params,
      context: this.markdownContext,
      agentCapabilities: this.getCapabilities()
    };

    return this.processWithContext(method, contextualParams);
  }

  // Abstract method for context-aware processing
  protected async processWithContext(method: string, params: any): Promise<any> {
    throw new Error('processWithContext must be implemented by derived service');
  }

  // Abstract method to get markdown context file path
  protected getMarkdownContextPath(): string {
    throw new Error('getMarkdownContextPath must be implemented by derived service');
  }

  private async loadMarkdownContext(): Promise<void> {
    try {
      const contextPath = this.getMarkdownContextPath();
      const fullPath = path.resolve(process.cwd(), contextPath);
      this.markdownContext = await fs.readFile(fullPath, 'utf-8');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`Failed to load markdown context: ${errorMessage}`);
      this.markdownContext = '# Context unavailable\nMarkdown context could not be loaded.';
    }
  }

  // Utility method to get loaded context
  protected getContext(): string {
    return this.markdownContext;
  }

  // Enhanced agent card with context information
  async getAgentCard(): Promise<any> {
    const baseCard = await super.getAgentCard();
    return {
      ...baseCard,
      contextType: 'markdown',
      contextLoaded: this.markdownContext.length > 0,
      lastContextUpdate: new Date().toISOString()
    };
  }
} 