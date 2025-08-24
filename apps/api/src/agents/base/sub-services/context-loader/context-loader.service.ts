import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  AgentContextContent,
  AgentBaseType,
} from '../../implementations/base-services/context/interfaces';

/**
 * Service for loading and parsing context.md files for context-based agents
 */
@Injectable()
export class ContextLoaderService {
  private readonly logger = new Logger(ContextLoaderService.name);

  /**
   * Load context.md file for a context-based agent
   */
  async loadContextFile(
    agentDirectory: string,
  ): Promise<AgentContextContent | null> {
    try {
      const contextPath = path.join(agentDirectory, 'context.md');

      if (!fs.existsSync(contextPath)) {

        return null;
      }

      const rawContent = fs.readFileSync(contextPath, 'utf8');

      return this.parseContextContent(rawContent);
    } catch (error) {

      return null;
    }
  }

  /**
   * Parse markdown content into structured context
   */
  private parseContextContent(rawContent: string): AgentContextContent {
    const lines = rawContent.split('\n');
    let systemPrompt = '';
    const instructions = '';
    const knowledgeBase = '';
    const examples: Array<{ query: string; response: string }> = [];

    let currentSection = '';
    let currentContent = '';

    for (const line of lines) {
      // Detect section headers
      if (line.startsWith('# ') || line.startsWith('## ')) {
        // Save previous section
        this.saveSection(currentSection, currentContent, {
          systemPrompt,
          instructions,
          knowledgeBase,
          examples,
        });

        // Start new section
        currentSection = line
          .replace(/^#+\s*/, '')
          .toLowerCase()
          .trim();
        currentContent = '';
      } else {
        currentContent += line + '\n';
      }
    }

    // Save final section
    this.saveSection(currentSection, currentContent, {
      systemPrompt,
      instructions,
      knowledgeBase,
      examples,
    });

    // If no explicit sections found, treat entire content as system prompt
    if (!systemPrompt && !instructions && !knowledgeBase) {
      systemPrompt = rawContent;
    }

    return {
      systemPrompt: systemPrompt.trim(),
      instructions: instructions.trim() || undefined,
      knowledgeBase: knowledgeBase.trim() || undefined,
      examples,
      rawContent,
    };
  }

  /**
   * Save content to appropriate section based on header type
   */
  private saveSection(
    sectionName: string,
    content: string,
    context: {
      systemPrompt: string;
      instructions: string;
      knowledgeBase: string;
      examples: Array<{ query: string; response: string }>;
    },
  ): void {
    const trimmedContent = content.trim();
    if (!trimmedContent) return;

    switch (sectionName) {
      case 'system prompt':
      case 'system':
      case 'prompt':
        context.systemPrompt = trimmedContent;
        break;

      case 'instructions':
      case 'directions':
      case 'guidelines':
        context.instructions = trimmedContent;
        break;

      case 'knowledge base':
      case 'knowledge':
      case 'data':
      case 'information':
        context.knowledgeBase = trimmedContent;
        break;

      case 'examples':
      case 'example interactions':
        this.parseExamples(trimmedContent, context.examples);
        break;
    }
  }

  /**
   * Parse examples from markdown content
   */
  private parseExamples(
    content: string,
    examples: Array<{ query: string; response: string }>,
  ): void {
    const lines = content.split('\n');
    let currentQuery = '';
    let currentResponse = '';
    let inQuery = false;
    let inResponse = false;

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (
        trimmedLine.startsWith('**Query:**') ||
        trimmedLine.startsWith('Query:')
      ) {
        // Save previous example if exists
        if (currentQuery && currentResponse) {
          examples.push({
            query: currentQuery.trim(),
            response: currentResponse.trim(),
          });
        }

        currentQuery = trimmedLine
          .replace(/^\*\*Query:\*\*|^Query:/, '')
          .trim();
        currentResponse = '';
        inQuery = true;
        inResponse = false;
      } else if (
        trimmedLine.startsWith('**Response:**') ||
        trimmedLine.startsWith('Response:')
      ) {
        currentResponse = trimmedLine
          .replace(/^\*\*Response:\*\*|^Response:/, '')
          .trim();
        inQuery = false;
        inResponse = true;
      } else if (inQuery) {
        currentQuery += ' ' + trimmedLine;
      } else if (inResponse) {
        currentResponse += ' ' + trimmedLine;
      }
    }

    // Save final example
    if (currentQuery && currentResponse) {
      examples.push({
        query: currentQuery.trim(),
        response: currentResponse.trim(),
      });
    }
  }

  /**
   * Determine if an agent type requires context.md
   */
  static requiresContextFile(agentType: AgentBaseType): boolean {
    return agentType === 'context';
  }

  /**
   * Build system prompt from context content
   */
  buildSystemPrompt(
    context: AgentContextContent,
    _agentName: string,
    _agentType: string,
  ): string {
    let prompt = context.systemPrompt;

    if (context.instructions) {
      prompt += '\n\n## Instructions\n' + context.instructions;
    }

    if (context.knowledgeBase) {
      prompt += '\n\n## Knowledge Base\n' + context.knowledgeBase;
    }

    if (context.examples && context.examples.length > 0) {
      prompt += '\n\n## Examples\n';
      context.examples.forEach((example, index) => {
        prompt += `\n**Example ${index + 1}:**\n`;
        prompt += `Query: ${example.query}\n`;
        prompt += `Response: ${example.response}\n`;
      });
    }

    return prompt;
  }
}
