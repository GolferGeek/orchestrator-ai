/**
 * Simple Context Service - loads toolname.context.md files
 */

import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class ContextLearningService {
  private toolsDirectory: string;
  private contextCache: Map<string, { content: string; lastModified: Date }> = new Map();

  constructor() {
    // Handle both development (src) and production (dist) environments
    const currentDir = __dirname;
    
    // If we're in dist directory, go back to find tools directory  
    if (currentDir.includes('/dist/')) {
      // In production: /path/to/dist/mcp/servers/supabase/services -> /path/to/src/mcp/servers/supabase/tools
      const projectRoot = currentDir.split('/dist/')[0];
      if (!projectRoot) {
        throw new Error('Could not determine project root from dist directory');
      }
      this.toolsDirectory = path.join(projectRoot, 'src', 'mcp', 'servers', 'supabase', 'tools');
    } else {
      // In development: /path/to/src/mcp/servers/supabase/services -> /path/to/src/mcp/servers/supabase/tools
      this.toolsDirectory = path.join(__dirname, '..', 'tools');
    }
    
    console.log(`📚 Context Learning Service tools directory: ${this.toolsDirectory}`);
  }

  /**
   * Get context for a tool - just reads toolname.context.md
   */
  async getContext(toolName: string): Promise<string> {
    const contextFilePath = path.join(this.toolsDirectory, `${toolName}.context.md`);
    
    try {
      // Check cache first
      const stat = await fs.stat(contextFilePath);
      const cached = this.contextCache.get(toolName);
      
      if (cached && cached.lastModified >= stat.mtime) {
        return cached.content;
      }

      // Read the file
      const content = await fs.readFile(contextFilePath, 'utf-8');
      
      // Cache it
      this.contextCache.set(toolName, {
        content,
        lastModified: stat.mtime
      });
      
      console.log(`📚 Loaded context for tool '${toolName}' (${content.length} chars)`);
      console.log(`📚 Context preview: ${content.substring(0, 200)}...`);
      return content;
      
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.log(`📚 No context file found for tool '${toolName}'`);
      } else {
        console.warn(`⚠️ Failed to load context for tool '${toolName}':`, error);
      }
      return '';
    }
  }

  /**
   * Add context to a prompt
   */
  async enhancePrompt(originalPrompt: string, toolName: string): Promise<string> {
    const context = await this.getContext(toolName);
    
    if (!context) {
      console.log(`📚 No context found for tool '${toolName}', using original prompt`);
      return originalPrompt;
    }

    const enhancedPrompt = `${context}

${originalPrompt}`;
    
    console.log(`📚 Enhanced prompt for '${toolName}' (${enhancedPrompt.length} chars total)`);
    console.log(`📚 Enhanced prompt preview: ${enhancedPrompt.substring(0, 300)}...`);
    
    return enhancedPrompt;
  }

  /**
   * Clear cache for a tool
   */
  clearCache(toolName?: string): void {
    if (toolName) {
      this.contextCache.delete(toolName);
    } else {
      this.contextCache.clear();
    }
  }

  // Compatibility methods for existing server code
  async onModuleInit(): Promise<void> {
    console.log('📚 Simple Context Learning Service initialized');
  }

  async onModuleDestroy(): Promise<void> {
    this.contextCache.clear();
  }

  async forceReload(): Promise<void> {
    this.contextCache.clear();
  }

  getContextStats() {
    return {
      totalPatterns: this.contextCache.size,
      lastReload: new Date()
    };
  }
}