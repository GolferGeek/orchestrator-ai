import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ConversationContextService {
  private readonly logger = new Logger(ConversationContextService.name);

  /**
   * Build context for agent continuity based on conversation history
   */
  buildAgentContinuityContext(
    conversationHistory: Array<{ role: string; content: string; metadata?: any }>
  ): string {
    if (!conversationHistory || conversationHistory.length === 0) {
      return '';
    }

    // Look for patterns in conversation history
    const patterns = this.analyzeConversationPatterns(conversationHistory);
    
    let context = '';
    
    if (patterns.userName) {
      context += `\nUser's name: ${patterns.userName}`;
    }
    
    if (patterns.previousAgents.length > 0) {
      context += `\nPrevious agents in conversation: ${patterns.previousAgents.join(', ')}`;
    }
    
    if (patterns.topics.length > 0) {
      context += `\nTopics discussed: ${patterns.topics.join(', ')}`;
    }
    
    if (patterns.lastAgentInteraction) {
      context += `\nLast specialist interaction: ${patterns.lastAgentInteraction}`;
    }

    return context;
  }

  /**
   * Determine if this is a follow-up question that should continue with the same agent
   */
  shouldContinueWithSameAgent(
    userMessage: string,
    conversationHistory: Array<{ role: string; content: string; metadata?: any }>
  ): { shouldContinue: boolean; agentName?: string; reason?: string } {
    if (!conversationHistory || conversationHistory.length === 0) {
      return { shouldContinue: false };
    }

    const lowerMessage = userMessage.toLowerCase();
    
    // Check for follow-up indicators
    const followUpIndicators = [
      'also', 'and', 'what about', 'how about', 'additionally', 
      'furthermore', 'moreover', 'can you also', 'tell me more',
      'expand on', 'explain further', 'continue', 'go on'
    ];

    const hasFollowUpIndicator = followUpIndicators.some(indicator => 
      lowerMessage.includes(indicator)
    );

    // Find the last non-orchestrator agent
    const lastAgentMessage = [...conversationHistory]
      .reverse()
      .find(msg => 
        msg.role === 'assistant' && 
        msg.metadata?.agentName &&
        !msg.metadata.agentName.toLowerCase().includes('orchestrator') &&
        msg.metadata?.agentType !== 'orchestrator'
      );

    if (lastAgentMessage && hasFollowUpIndicator) {
      return {
        shouldContinue: true,
        agentName: lastAgentMessage.metadata?.agentName,
        reason: 'Follow-up question detected with previous agent context'
      };
    }

    // Check for pronoun references that might indicate continuation
    const pronouns = ['it', 'this', 'that', 'them', 'they'];
    const hasPronounReference = pronouns.some(pronoun => 
      lowerMessage.includes(pronoun)
    );

    if (lastAgentMessage && hasPronounReference && conversationHistory.length >= 2) {
      return {
        shouldContinue: true,
        agentName: lastAgentMessage.metadata?.agentName,
        reason: 'Pronoun reference suggests continuation with previous agent'
      };
    }

    return { shouldContinue: false };
  }

  /**
   * Extract user information from conversation history
   */
  extractUserInfo(
    conversationHistory: Array<{ role: string; content: string; metadata?: any }>
  ): { name?: string; preferences?: any; context?: string } {
    const userInfo: { name?: string; preferences?: any; context?: string } = {};

    // Look for name mentions
    for (const message of conversationHistory) {
      if (message.role === 'user') {
        const nameMatch = message.content.match(/my name is (\w+)|i'm (\w+)|call me (\w+)/i);
        if (nameMatch) {
          userInfo.name = nameMatch[1] || nameMatch[2] || nameMatch[3];
        }
      }
    }

    // Extract preferences from metadata
    const preferencesFromHistory = conversationHistory
      .filter(msg => msg.metadata?.llmPreferences)
      .map(msg => msg.metadata.llmPreferences);

    if (preferencesFromHistory.length > 0) {
      userInfo.preferences = preferencesFromHistory[preferencesFromHistory.length - 1];
    }

    return userInfo;
  }

  private analyzeConversationPatterns(
    conversationHistory: Array<{ role: string; content: string; metadata?: any }>
  ): {
    userName?: string;
    previousAgents: string[];
    topics: string[];
    lastAgentInteraction?: string;
  } {
    const patterns = {
      previousAgents: [] as string[],
      topics: [] as string[],
    };

    let userName: string | undefined;
    let lastAgentInteraction: string | undefined;

    for (const message of conversationHistory) {
      // Extract user name
      if (message.role === 'user' && !userName) {
        const nameMatch = message.content.match(/my name is (\w+)|i'm (\w+)|call me (\w+)/i);
        if (nameMatch) {
          userName = nameMatch[1] || nameMatch[2] || nameMatch[3];
        }
      }

      // Track agents used
      if (message.role === 'assistant' && message.metadata?.agentName) {
        const agentName = message.metadata.agentName;
        if (!agentName.toLowerCase().includes('orchestrator') && 
            !patterns.previousAgents.includes(agentName)) {
          patterns.previousAgents.push(agentName);
          lastAgentInteraction = `${agentName} handled: "${message.content.substring(0, 100)}..."`;
        }
      }

      // Extract topics (simple keyword extraction)
      if (message.role === 'user') {
        const topics = this.extractTopics(message.content);
        patterns.topics.push(...topics.filter(topic => !patterns.topics.includes(topic)));
      }
    }

    return {
      userName,
      ...patterns,
      lastAgentInteraction
    };
  }

  private extractTopics(content: string): string[] {
    const topicKeywords = [
      'golf', 'blog', 'calendar', 'email', 'hr', 'meeting', 'schedule',
      'content', 'writing', 'rules', 'policy', 'benefits', 'employee'
    ];

    const lowerContent = content.toLowerCase();
    return topicKeywords.filter(keyword => lowerContent.includes(keyword));
  }
}