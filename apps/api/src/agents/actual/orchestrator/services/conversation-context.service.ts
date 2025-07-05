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
  ): { shouldContinue: boolean; agentName?: string; reason?: string; confidence?: number } {
    if (!conversationHistory || conversationHistory.length === 0) {
      return { shouldContinue: false };
    }

    const lowerMessage = userMessage.toLowerCase();
    let confidence = 0;
    let reason = '';
    
    // Enhanced follow-up indicators with stronger patterns first
    const strongFollowUpIndicators = [
      'tell me more about', 'explain further', 'continue with', 'elaborate on',
      'more details about', 'follow up on', 'expand on that', 'dig deeper'
    ];
    
    const mediumFollowUpIndicators = [
      'also', 'and', 'what about', 'how about', 'additionally', 
      'furthermore', 'moreover', 'can you also', 'tell me more',
      'continue', 'go on', 'next', 'then what'
    ];

    const weakFollowUpIndicators = [
      'another', 'similar', 'related', 'same topic', 'regarding'
    ];

    // Find the last non-orchestrator agent with enhanced metadata extraction
    const lastAgentMessage = [...conversationHistory]
      .reverse()
      .find(msg => 
        msg.role === 'assistant' && 
        msg.metadata?.agentName &&
        !msg.metadata.agentName.toLowerCase().includes('orchestrator') &&
        msg.metadata?.agentType !== 'orchestrator'
      );

    if (!lastAgentMessage) {
      return { shouldContinue: false };
    }

    // Check for strong follow-up indicators
    const hasStrongFollowUp = strongFollowUpIndicators.some(indicator => 
      lowerMessage.includes(indicator)
    );
    
    if (hasStrongFollowUp) {
      confidence = 0.9;
      reason = 'Strong follow-up language detected';
    }

    // Check for medium follow-up indicators
    const hasMediumFollowUp = mediumFollowUpIndicators.some(indicator => 
      lowerMessage.includes(indicator)
    );
    
    if (hasMediumFollowUp && confidence < 0.7) {
      confidence = 0.7;
      reason = 'Follow-up indicators detected';
    }

    // Check for weak follow-up indicators
    const hasWeakFollowUp = weakFollowUpIndicators.some(indicator => 
      lowerMessage.includes(indicator)
    );
    
    if (hasWeakFollowUp && confidence < 0.4) {
      confidence = 0.4;
      reason = 'Weak follow-up language detected';
    }

    // Enhanced pronoun and context reference detection
    const contextReferences = [
      'it', 'this', 'that', 'them', 'they', 'the same', 'above',
      'previous', 'earlier', 'before', 'you mentioned', 'you said'
    ];
    
    const hasContextReference = contextReferences.some(ref => 
      lowerMessage.includes(ref)
    );

    if (hasContextReference && confidence < 0.6) {
      confidence = Math.max(confidence, 0.6);
      reason = confidence === 0.6 ? 'Context reference detected' : reason;
    }

    // Topic continuity check - see if user message relates to last agent's domain
    const topicContinuity = this.checkTopicContinuity(userMessage, lastAgentMessage, conversationHistory);
    if (topicContinuity.isRelated && confidence < topicContinuity.confidence) {
      confidence = Math.max(confidence, topicContinuity.confidence);
      reason = topicContinuity.confidence > confidence * 0.8 ? topicContinuity.reason : reason;
    }

    // Temporal proximity boost - recent interactions are more likely to continue
    const messagesSinceLastAgent = this.getMessagesSinceLastAgent(conversationHistory, lastAgentMessage);
    if (messagesSinceLastAgent <= 2 && confidence > 0) {
      confidence = Math.min(1.0, confidence + 0.1);
    }

    // Return decision based on confidence threshold
    const shouldContinue = confidence >= 0.5;
    
    return {
      shouldContinue,
      agentName: shouldContinue ? lastAgentMessage.metadata?.agentName : undefined,
      reason: shouldContinue ? reason : 'Insufficient context for continuation',
      confidence
    };
  }

  /**
   * Check if the current message relates to the topic/domain of the last agent
   */
  private checkTopicContinuity(
    userMessage: string,
    lastAgentMessage: any,
    conversationHistory: Array<{ role: string; content: string; metadata?: any }>
  ): { isRelated: boolean; confidence: number; reason: string } {
    const lowerMessage = userMessage.toLowerCase();
    const agentName = lastAgentMessage.metadata?.agentName?.toLowerCase() || '';
    
    // Define agent domain keywords
    const agentDomains: Record<string, string[]> = {
      'hr': ['employee', 'benefits', 'policy', 'vacation', 'leave', 'payroll', 'hr', 'human resources', 'personnel'],
      'golf': ['golf', 'rules', 'handicap', 'course', 'penalty', 'usga', 'r&a', 'tournament', 'tee', 'green'],
      'blog': ['blog', 'article', 'content', 'writing', 'post', 'publish', 'draft', 'seo', 'marketing'],
      'calendar': ['meeting', 'schedule', 'appointment', 'calendar', 'event', 'time', 'book', 'available'],
      'email': ['email', 'message', 'send', 'reply', 'inbox', 'draft', 'forward', 'communication'],
      'content': ['content', 'writing', 'creative', 'copy', 'text', 'draft', 'edit', 'review']
    };

    // Find matching domain for the agent
    let domainKeywords: string[] = [];
    for (const [domain, keywords] of Object.entries(agentDomains)) {
      if (agentName.includes(domain)) {
        domainKeywords = keywords;
        break;
      }
    }

    // Check for domain keyword matches
    const domainMatches = domainKeywords.filter(keyword => lowerMessage.includes(keyword));
    
    if (domainMatches.length > 0) {
      return {
        isRelated: true,
        confidence: Math.min(0.8, 0.4 + (domainMatches.length * 0.2)),
        reason: `Topic continuity: ${domainMatches.join(', ')} relates to ${agentName}`
      };
    }

    // Check for conceptual similarity with last agent's response
    if (lastAgentMessage.content) {
      const lastAgentWords = lastAgentMessage.content.toLowerCase().split(/\s+/);
      const userWords = lowerMessage.split(/\s+/);
      const commonWords = userWords.filter(word => 
        word.length > 3 && lastAgentWords.includes(word)
      );
      
      if (commonWords.length >= 2) {
        return {
          isRelated: true,
          confidence: Math.min(0.6, 0.3 + (commonWords.length * 0.1)),
          reason: `Shared concepts: ${commonWords.slice(0, 3).join(', ')}`
        };
      }
    }

    return { isRelated: false, confidence: 0, reason: 'No topic continuity detected' };
  }

  /**
   * Count messages since the last agent interaction
   */
  private getMessagesSinceLastAgent(
    conversationHistory: Array<{ role: string; content: string; metadata?: any }>,
    lastAgentMessage: any
  ): number {
    const lastAgentIndex = conversationHistory.lastIndexOf(lastAgentMessage);
    return conversationHistory.length - lastAgentIndex - 1;
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

  /**
   * Analyze agent interaction patterns and relationships in the conversation
   */
  analyzeAgentInteractions(
    conversationHistory: Array<{ role: string; content: string; metadata?: any }>
  ): {
    agentSequence: Array<{ agentName: string; timestamp: string; interactionType: string }>;
    agentRelationships: Array<{ fromAgent: string; toAgent: string; handoffReason?: string }>;
    currentAgentContext: { agentName?: string; lastInteraction?: string; contextStrength: number };
    agentSpecializations: Record<string, string[]>;
  } {
    const agentSequence: Array<{ agentName: string; timestamp: string; interactionType: string }> = [];
    const agentRelationships: Array<{ fromAgent: string; toAgent: string; handoffReason?: string }> = [];
    const agentSpecializations: Record<string, string[]> = {};
    
    let lastAgent: string | null = null;
    
    // Analyze conversation flow
    for (const message of conversationHistory) {
      if (message.role === 'assistant' && message.metadata?.agentName) {
        const agentName = message.metadata.agentName;
        
        // Skip orchestrator entries for cleaner analysis
        if (agentName.toLowerCase().includes('orchestrator')) {
          continue;
        }
        
        // Record agent interaction
        agentSequence.push({
          agentName,
          timestamp: message.metadata?.timestamp || new Date().toISOString(),
          interactionType: message.metadata?.isDelegated ? 'delegated' : 'direct'
        });
        
        // Track agent handoffs
        if (lastAgent && lastAgent !== agentName) {
          agentRelationships.push({
            fromAgent: lastAgent,
            toAgent: agentName,
            handoffReason: message.metadata?.delegationReason || 'Topic change detected'
          });
        }
        
        // Extract specializations from agent responses
        if (!agentSpecializations[agentName]) {
          agentSpecializations[agentName] = [];
        }
        
        // Simple keyword extraction for specializations
        const topicsInResponse = this.extractTopics(message.content);
        agentSpecializations[agentName]?.push(...topicsInResponse.filter(
          topic => !agentSpecializations[agentName]?.includes(topic)
        ));
        
        lastAgent = agentName;
      }
    }
    
    // Determine current agent context strength
    const currentAgentContext = this.calculateCurrentAgentContext(conversationHistory, agentSequence);
    
    return {
      agentSequence,
      agentRelationships,
      currentAgentContext,
      agentSpecializations
    };
  }

  /**
   * Calculate the strength of current agent context for better handoff decisions
   */
  private calculateCurrentAgentContext(
    conversationHistory: Array<{ role: string; content: string; metadata?: any }>,
    agentSequence: Array<{ agentName: string; timestamp: string; interactionType: string }>
  ): { agentName?: string; lastInteraction?: string; contextStrength: number } {
    if (agentSequence.length === 0) {
      return { contextStrength: 0 };
    }
    
    const lastAgentInteraction = agentSequence[agentSequence.length - 1];
    const agentName = lastAgentInteraction?.agentName;
    
    // Find the last message from this agent
    const lastAgentMessage = [...conversationHistory]
      .reverse()
      .find(msg => 
        msg.role === 'assistant' && 
        msg.metadata?.agentName === agentName
      );
    
    if (!lastAgentMessage) {
      return { contextStrength: 0 };
    }
    
    // Calculate context strength based on multiple factors
    let contextStrength = 0.5; // Base strength
    
    // Recent interaction boost
    const messagesSince = this.getMessagesSinceLastAgent(conversationHistory, lastAgentMessage);
    if (messagesSince === 0) contextStrength += 0.3;
    else if (messagesSince === 1) contextStrength += 0.2;
    else if (messagesSince === 2) contextStrength += 0.1;
    
    // Consecutive interactions with same agent
    const consecutiveInteractions = this.getConsecutiveAgentInteractions(agentSequence, agentName || '');
    contextStrength += Math.min(0.2, consecutiveInteractions * 0.05);
    
    // Response completeness (longer responses suggest more investment in context)
    if (lastAgentMessage.content && lastAgentMessage.content.length > 200) {
      contextStrength += 0.1;
    }
    
    // Cap at 1.0
    contextStrength = Math.min(1.0, contextStrength);
    
    return {
      agentName,
      lastInteraction: lastAgentMessage.content?.substring(0, 100),
      contextStrength
    };
  }

  /**
   * Get count of consecutive interactions with the same agent
   */
  private getConsecutiveAgentInteractions(
    agentSequence: Array<{ agentName: string; timestamp: string; interactionType: string }>,
    targetAgent: string
  ): number {
    let count = 0;
    for (let i = agentSequence.length - 1; i >= 0; i--) {
      if (agentSequence[i]?.agentName === targetAgent) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  /**
   * Generate context handoff information for seamless agent transitions
   */
  generateContextHandoff(
    conversationHistory: Array<{ role: string; content: string; metadata?: any }>,
    fromAgent: string,
    toAgent: string,
    userMessage: string
  ): {
    handoffReason: string;
    contextSummary: string;
    relevantHistory: Array<{ role: string; content: string; agentName?: string }>;
    handoffStrength: number;
  } {
    // Find relevant messages from the fromAgent
    const fromAgentMessages = conversationHistory
      .filter(msg => 
        msg.role === 'assistant' && 
        msg.metadata?.agentName === fromAgent
      )
      .slice(-3); // Last 3 interactions
    
    // Find relevant user messages that led to agent interactions
    const relevantUserMessages = conversationHistory
      .filter(msg => msg.role === 'user')
      .slice(-5); // Last 5 user messages
    
    // Create context summary
    const contextSummary = this.createContextSummary(fromAgentMessages, relevantUserMessages, userMessage);
    
    // Determine handoff reason
    const handoffReason = this.determineHandoffReason(fromAgent, toAgent, userMessage, conversationHistory);
    
    // Calculate handoff strength
    const handoffStrength = this.calculateHandoffStrength(fromAgent, toAgent, conversationHistory);
    
    // Prepare relevant history for the new agent
    const relevantHistory = [
      ...relevantUserMessages.slice(-2).map(msg => ({
        role: msg.role,
        content: msg.content,
        agentName: undefined
      })),
      ...fromAgentMessages.slice(-1).map(msg => ({
        role: msg.role,
        content: msg.content,
        agentName: fromAgent
      })),
      {
        role: 'user' as const,
        content: userMessage,
        agentName: undefined
      }
    ];
    
    return {
      handoffReason,
      contextSummary,
      relevantHistory,
      handoffStrength
    };
  }

  /**
   * Create a context summary for agent handoffs
   */
  private createContextSummary(
    fromAgentMessages: Array<{ role: string; content: string; metadata?: any }>,
    userMessages: Array<{ role: string; content: string; metadata?: any }>,
    currentUserMessage: string
  ): string {
    let summary = '';
    
    if (fromAgentMessages.length > 0) {
      const lastAgentResponse = fromAgentMessages[fromAgentMessages.length - 1];
      summary += `Previous context: ${lastAgentResponse?.content?.substring(0, 150)}...`;
    }
    
    if (userMessages.length > 0) {
      const recentTopics = userMessages
        .flatMap(msg => this.extractTopics(msg.content))
        .filter((topic, index, arr) => arr.indexOf(topic) === index)
        .slice(0, 3);
      
      if (recentTopics.length > 0) {
        summary += ` Recent topics: ${recentTopics.join(', ')}.`;
      }
    }
    
    summary += ` Current request: ${currentUserMessage.substring(0, 100)}`;
    
    return summary;
  }

  /**
   * Determine the reason for agent handoff
   */
  private determineHandoffReason(
    fromAgent: string,
    toAgent: string,
    userMessage: string,
    conversationHistory: Array<{ role: string; content: string; metadata?: any }>
  ): string {
    const lowerMessage = userMessage.toLowerCase();
    
    // Check for explicit agent requests
    if (lowerMessage.includes(`talk to ${toAgent.toLowerCase()}`) || 
        lowerMessage.includes(`switch to ${toAgent.toLowerCase()}`)) {
      return 'User requested specific agent';
    }
    
    // Check for topic changes
    const fromAgentDomain = this.getAgentDomain(fromAgent);
    const toAgentDomain = this.getAgentDomain(toAgent);
    
    if (fromAgentDomain !== toAgentDomain) {
      return `Topic change from ${fromAgentDomain} to ${toAgentDomain}`;
    }
    
    // Check for capability requirements
    if (lowerMessage.includes('help') || lowerMessage.includes('different') || lowerMessage.includes('other')) {
      return 'User needs different expertise';
    }
    
    return 'Orchestrator decision based on request analysis';
  }

  /**
   * Calculate handoff strength for decision confidence
   */
  private calculateHandoffStrength(
    fromAgent: string,
    toAgent: string,
    conversationHistory: Array<{ role: string; content: string; metadata?: any }>
  ): number {
    let strength = 0.5; // Base strength
    
    // Check agent interaction history
    const agentInteractions = this.analyzeAgentInteractions(conversationHistory);
    
    // If agents have worked together before, increase strength
    const hasWorkedTogether = agentInteractions.agentRelationships.some(rel =>
      (rel.fromAgent === fromAgent && rel.toAgent === toAgent) ||
      (rel.fromAgent === toAgent && rel.toAgent === fromAgent)
    );
    
    if (hasWorkedTogether) {
      strength += 0.2;
    }
    
    // Recent context strength
    if (agentInteractions.currentAgentContext.contextStrength > 0.7) {
      strength += 0.2;
    }
    
    return Math.min(1.0, strength);
  }

  /**
   * Get the primary domain/specialization of an agent
   */
  private getAgentDomain(agentName: string): string {
    const lowerName = agentName.toLowerCase();
    
    if (lowerName.includes('hr') || lowerName.includes('human')) return 'hr';
    if (lowerName.includes('golf') || lowerName.includes('rules')) return 'golf';
    if (lowerName.includes('blog') || lowerName.includes('content')) return 'content';
    if (lowerName.includes('calendar') || lowerName.includes('meeting')) return 'calendar';
    if (lowerName.includes('email') || lowerName.includes('message')) return 'email';
    
    return 'general';
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