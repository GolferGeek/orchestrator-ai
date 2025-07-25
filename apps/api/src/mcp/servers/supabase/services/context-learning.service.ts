/**
 * Context Learning Service
 * 
 * Manages context learning from markdown files with hot-reload capability.
 * Enhances MCP tool prompts with learned patterns and error avoidance.
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { watch, FSWatcher } from 'chokidar';

export interface ContextPattern {
  type: 'success' | 'error' | 'optimization';
  category: string;
  pattern: string;
  description: string;
  example?: string;
  conditions?: string[];
}

export interface ContextEnhancedPrompt {
  originalPrompt: string;
  enhancedPrompt: string;
  appliedPatterns: ContextPattern[];
  warnings: string[];
}

@Injectable()
export class ContextLearningService implements OnModuleInit, OnModuleDestroy {
  private contextData: Map<string, ContextPattern[]> = new Map();
  private fileWatcher: FSWatcher | null = null;
  private contextFilePath: string;
  private lastModified: Date | null = null;

  constructor() {
    this.contextFilePath = path.join(
      __dirname,
      '..',
      'test',
      'context',
      'supabase-sql-context.md'
    );
  }

  async onModuleInit() {
    await this.loadContextFile();
    this.startFileWatcher();
  }

  onModuleDestroy() {
    if (this.fileWatcher) {
      this.fileWatcher.close();
    }
  }

  /**
   * Load and parse context file
   */
  private async loadContextFile(): Promise<void> {
    try {
      const content = await fs.readFile(this.contextFilePath, 'utf-8');
      const stat = await fs.stat(this.contextFilePath);
      
      // Only reload if file has been modified
      if (this.lastModified && stat.mtime <= this.lastModified) {
        return;
      }

      this.lastModified = stat.mtime;
      this.parseContextContent(content);
      
      console.log(`📚 Context learning data loaded from ${this.contextFilePath}`);
      console.log(`📊 Loaded ${Array.from(this.contextData.values()).flat().length} patterns`);
      
    } catch (error) {
      console.warn(`⚠️  Failed to load context file: ${error.message}`);
      // Initialize with empty context if file doesn't exist
      this.contextData.clear();
    }
  }

  /**
   * Parse markdown content into structured patterns
   */
  private parseContextContent(content: string): void {
    this.contextData.clear();
    
    const lines = content.split('\n');
    let currentSection = '';
    let currentCategory = '';
    let currentPattern: Partial<ContextPattern> = {};
    let inCodeBlock = false;
    let codeContent = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Track code blocks
      if (line.startsWith('```')) {
        if (inCodeBlock && currentPattern.pattern) {
          currentPattern.example = codeContent.trim();
          codeContent = '';
        }
        inCodeBlock = !inCodeBlock;
        continue;
      }

      if (inCodeBlock) {
        codeContent += line + '\n';
        continue;
      }

      // Parse headers
      if (line.startsWith('## ')) {
        this.finalizeCurrentPattern(currentSection, currentCategory, currentPattern);
        currentSection = line.substring(3).trim();
        currentCategory = '';
        currentPattern = {};
      } else if (line.startsWith('### ')) {
        this.finalizeCurrentPattern(currentSection, currentCategory, currentPattern);
        currentCategory = line.substring(4).trim();
        currentPattern = {};
      }

      // Parse success patterns
      if (currentSection.includes('Successful') || currentSection.includes('Success')) {
        this.parseSuccessPattern(line, currentSection, currentCategory, currentPattern);
      }

      // Parse error patterns
      if (currentSection.includes('Error') || currentSection.includes('Common')) {
        this.parseErrorPattern(line, currentSection, currentCategory, currentPattern);
      }

      // Parse advanced patterns
      if (currentSection.includes('Advanced') || currentSection.includes('Patterns')) {
        this.parseAdvancedPattern(line, currentSection, currentCategory, currentPattern);
      }
    }

    // Finalize last pattern
    this.finalizeCurrentPattern(currentSection, currentCategory, currentPattern);
  }

  private parseSuccessPattern(
    line: string, 
    section: string, 
    category: string, 
    pattern: Partial<ContextPattern>
  ): void {
    if (line.startsWith('- For ') && line.includes(':')) {
      const [condition, solution] = line.substring(2).split(':', 2);
      pattern.type = 'success';
      pattern.category = category || 'general';
      pattern.description = condition.trim();
      pattern.pattern = solution.trim();
      pattern.conditions = [condition.trim()];
    }
  }

  private parseErrorPattern(
    line: string, 
    section: string, 
    category: string, 
    pattern: Partial<ContextPattern>
  ): void {
    if (line.startsWith('**Error**:')) {
      pattern.type = 'error';
      pattern.category = category || 'error';
      pattern.description = line.substring(10).trim();
    } else if (line.startsWith('**Fix**:')) {
      pattern.pattern = line.substring(8).trim();
    }
  }

  private parseAdvancedPattern(
    line: string, 
    section: string, 
    category: string, 
    pattern: Partial<ContextPattern>
  ): void {
    if (line.startsWith('- For ') || line.startsWith('- Use ')) {
      pattern.type = 'optimization';
      pattern.category = category || 'advanced';
      pattern.description = line.substring(2).trim();
      
      // Extract pattern from the line
      const colonIndex = line.indexOf(':');
      if (colonIndex > -1) {
        pattern.pattern = line.substring(colonIndex + 1).trim();
      }
    }
  }

  private finalizeCurrentPattern(
    section: string, 
    category: string, 
    pattern: Partial<ContextPattern>
  ): void {
    if (pattern.type && pattern.pattern && pattern.description) {
      const key = `${section}:${category}`;
      if (!this.contextData.has(key)) {
        this.contextData.set(key, []);
      }
      this.contextData.get(key)!.push(pattern as ContextPattern);
    }
  }

  /**
   * Start file watcher for hot-reload
   */
  private startFileWatcher(): void {
    try {
      this.fileWatcher = watch(this.contextFilePath, {
        persistent: true,
        ignoreInitial: true
      });

      this.fileWatcher.on('change', async () => {
        console.log('🔄 Context file changed, reloading...');
        await this.loadContextFile();
      });

      this.fileWatcher.on('error', (error) => {
        console.warn('⚠️  File watcher error:', error);
      });

    } catch (error) {
      console.warn('⚠️  Failed to start file watcher:', error);
    }
  }

  /**
   * Enhance a prompt with context learning
   */
  async enhancePrompt(
    originalPrompt: string,
    toolName: string,
    category?: string
  ): Promise<ContextEnhancedPrompt> {
    const appliedPatterns: ContextPattern[] = [];
    const warnings: string[] = [];
    let enhancedPrompt = originalPrompt;

    // Get relevant patterns
    const relevantPatterns = this.getRelevantPatterns(originalPrompt, toolName, category);

    // Apply success patterns
    const successPatterns = relevantPatterns.filter(p => p.type === 'success');
    for (const pattern of successPatterns) {
      if (this.shouldApplyPattern(originalPrompt, pattern)) {
        enhancedPrompt = this.applySuccessPattern(enhancedPrompt, pattern);
        appliedPatterns.push(pattern);
      }
    }

    // Check for error patterns and add warnings
    const errorPatterns = relevantPatterns.filter(p => p.type === 'error');
    for (const pattern of errorPatterns) {
      if (this.shouldAvoidPattern(originalPrompt, pattern)) {
        warnings.push(`Avoid: ${pattern.description}. ${pattern.pattern}`);
        enhancedPrompt = this.addErrorAvoidance(enhancedPrompt, pattern);
        appliedPatterns.push(pattern);
      }
    }

    // Apply optimization patterns
    const optimizationPatterns = relevantPatterns.filter(p => p.type === 'optimization');
    for (const pattern of optimizationPatterns) {
      if (this.shouldApplyPattern(originalPrompt, pattern)) {
        enhancedPrompt = this.applyOptimizationPattern(enhancedPrompt, pattern);
        appliedPatterns.push(pattern);
      }
    }

    return {
      originalPrompt,
      enhancedPrompt,
      appliedPatterns,
      warnings
    };
  }

  /**
   * Get patterns relevant to the current request
   */
  private getRelevantPatterns(prompt: string, toolName: string, category?: string): ContextPattern[] {
    const allPatterns: ContextPattern[] = [];
    
    for (const patterns of this.contextData.values()) {
      allPatterns.push(...patterns);
    }

    return allPatterns.filter(pattern => {
      // Category match
      if (category && pattern.category.toLowerCase().includes(category.toLowerCase())) {
        return true;
      }

      // Tool-specific patterns
      if (toolName === 'generate-sql' && this.isRelevantForSQL(prompt, pattern)) {
        return true;
      }

      // General patterns that might apply
      return this.isGenerallyRelevant(prompt, pattern);
    });
  }

  private isRelevantForSQL(prompt: string, pattern: ContextPattern): boolean {
    const promptLower = prompt.toLowerCase();
    const descLower = pattern.description.toLowerCase();

    // Check for SQL-related keywords
    const sqlKeywords = [
      'user', 'conversation', 'agent', 'mcp', 'execution', 'task', 'session',
      'created', 'active', 'count', 'get', 'find', 'show', 'recent', 'today',
      'week', 'month', 'join', 'group', 'order', 'where'
    ];

    return sqlKeywords.some(keyword => 
      (promptLower.includes(keyword) && descLower.includes(keyword)) ||
      (promptLower.includes(keyword) && pattern.pattern.toLowerCase().includes(keyword))
    );
  }

  private isGenerallyRelevant(prompt: string, pattern: ContextPattern): boolean {
    // Always include error patterns for warning
    if (pattern.type === 'error') return true;

    // Check if pattern description or conditions match prompt content
    if (pattern.conditions) {
      return pattern.conditions.some(condition =>
        prompt.toLowerCase().includes(condition.toLowerCase())
      );
    }

    return false;
  }

  private shouldApplyPattern(prompt: string, pattern: ContextPattern): boolean {
    if (pattern.conditions) {
      return pattern.conditions.some(condition =>
        prompt.toLowerCase().includes(condition.toLowerCase())
      );
    }

    // Simple keyword matching
    const patternKeywords = pattern.description.toLowerCase().split(' ');
    const promptLower = prompt.toLowerCase();
    
    return patternKeywords.some(keyword => promptLower.includes(keyword));
  }

  private shouldAvoidPattern(prompt: string, pattern: ContextPattern): boolean {
    // Check if the prompt might trigger the error pattern
    const errorKeywords = pattern.description.toLowerCase().split(' ');
    const promptLower = prompt.toLowerCase();
    
    return errorKeywords.some(keyword => promptLower.includes(keyword));
  }

  private applySuccessPattern(prompt: string, pattern: ContextPattern): string {
    return `${prompt}

Context Note: ${pattern.description} - ${pattern.pattern}`;
  }

  private addErrorAvoidance(prompt: string, pattern: ContextPattern): string {
    return `${prompt}

Important: ${pattern.description} - ${pattern.pattern}`;
  }

  private applyOptimizationPattern(prompt: string, pattern: ContextPattern): string {
    return `${prompt}

Optimization: ${pattern.description} - ${pattern.pattern}`;
  }

  /**
   * Learn from execution results
   */
  async learnFromExecution(
    prompt: string,
    sql: string,
    success: boolean,
    error?: string,
    feedback?: { rating: 'up' | 'down'; comment?: string }
  ): Promise<void> {
    // This method would typically append learning to a separate file
    // or update the context based on successful patterns
    
    console.log(`📚 Learning from execution:`, {
      prompt: prompt.substring(0, 50) + '...',
      success,
      hasError: !!error,
      hasFeedback: !!feedback
    });

    // In a production system, you might:
    // 1. Automatically append successful patterns to the context file
    // 2. Flag common error patterns for developer review
    // 3. Update pattern confidence scores based on feedback
  }

  /**
   * Get context statistics
   */
  getContextStats(): {
    totalPatterns: number;
    patternsByType: Record<string, number>;
    patternsByCategory: Record<string, number>;
    lastReload: Date | null;
  } {
    const allPatterns = Array.from(this.contextData.values()).flat();
    
    const patternsByType = allPatterns.reduce((acc, pattern) => {
      acc[pattern.type] = (acc[pattern.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const patternsByCategory = allPatterns.reduce((acc, pattern) => {
      acc[pattern.category] = (acc[pattern.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalPatterns: allPatterns.length,
      patternsByType,
      patternsByCategory,
      lastReload: this.lastModified
    };
  }

  /**
   * Force reload of context file
   */
  async forceReload(): Promise<void> {
    this.lastModified = null;
    await this.loadContextFile();
  }
}