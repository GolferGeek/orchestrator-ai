import { Injectable, Logger } from '@nestjs/common';
import { ContextAgentBaseService } from '@agents/base/implementations/base-services/context/context-agent-base.service';
import { AgentServicesContext } from '@agents/base/services/agent-services-context';
import { AgentConfigurationService, AgentConfigurationData, AgentSkillData, ConversationData } from './services/agent-configuration.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AgentCreatorService extends ContextAgentBaseService {
  protected readonly logger = new Logger(AgentCreatorService.name);

  private readonly STRUCTURED_QUESTIONS = [
    {
      id: 1,
      phase: 'identity',
      field: 'agentName',
      question: 'What would you like to name your agent? (This will be the unique identifier)',
      validation: (answer: string) => {
        if (!answer || answer.trim().length < 2) return 'Agent name must be at least 2 characters';
        if (!/^[a-zA-Z][a-zA-Z0-9_\s]*$/.test(answer)) return 'Agent name must start with a letter and contain only letters, numbers, underscores, and spaces';
        return null;
      }
    },
    {
      id: 2,
      phase: 'identity',
      field: 'description',
      question: 'Provide a brief description of what this agent does (1-2 sentences)',
      validation: (answer: string) => {
        if (!answer || answer.trim().length < 10) return 'Description must be at least 10 characters';
        if (answer.trim().length > 500) return 'Description must be less than 500 characters';
        return null;
      }
    },
    {
      id: 3,
      phase: 'hierarchy',
      field: 'department',
      question: 'Which department should this agent belong to? (marketing, engineering, operations, finance, hr, sales, research, product, specialists)',
      validation: (answer: string) => {
        const validDepts = ['marketing', 'engineering', 'operations', 'finance', 'hr', 'sales', 'research', 'product', 'specialists'];
        const normalized = answer.toLowerCase().trim();
        if (!validDepts.includes(normalized)) return `Department must be one of: ${validDepts.join(', ')}`;
        return null;
      }
    },
    {
      id: 4,
      phase: 'hierarchy',
      field: 'agentType',
      question: 'What type of agent is this? (context, api, function)',
      validation: (answer: string) => {
        const validTypes = ['context', 'api', 'function'];
        const normalized = answer.toLowerCase().trim();
        if (!validTypes.includes(normalized)) return `Agent type must be one of: ${validTypes.join(', ')}`;
        return null;
      }
    },
    {
      id: 5,
      phase: 'purpose',
      field: 'primaryPurpose',
      question: 'What is the primary purpose or problem this agent solves? (Be specific)',
      validation: (answer: string) => {
        if (!answer || answer.trim().length < 20) return 'Primary purpose must be at least 20 characters';
        if (answer.trim().length > 1000) return 'Primary purpose must be less than 1000 characters';
        return null;
      }
    },
    {
      id: 6,
      phase: 'purpose',
      field: 'capabilities',
      question: 'List the key capabilities of this agent (comma-separated)',
      validation: (answer: string) => {
        const capabilities = answer.split(',').map(c => c.trim()).filter(c => c);
        if (capabilities.length < 1) return 'At least 1 capability is required';
        if (capabilities.length > 10) return 'Maximum 10 capabilities allowed';
        return null;
      }
    },
    {
      id: 7,
      phase: 'skills',
      field: 'skillName',
      question: 'What is the primary skill this agent provides? (e.g., "Content Writing", "Data Analysis")',
      validation: (answer: string) => {
        if (!answer || answer.trim().length < 3) return 'Skill name must be at least 3 characters';
        if (answer.trim().length > 100) return 'Skill name must be less than 100 characters';
        return null;
      }
    },
    {
      id: 8,
      phase: 'skills',
      field: 'skillDescription',
      question: 'Describe this skill in detail (what exactly can the agent do?)',
      validation: (answer: string) => {
        if (!answer || answer.trim().length < 10) return 'Skill description must be at least 10 characters';
        if (answer.trim().length > 500) return 'Skill description must be less than 500 characters';
        return null;
      }
    },
    {
      id: 9,
      phase: 'skills',
      field: 'skillExamples',
      question: 'Provide 3-5 specific examples of tasks this agent can handle (one per line)',
      validation: (answer: string) => {
        const examples = answer.split('\n').map(e => e.trim()).filter(e => e);
        if (examples.length < 3) return 'At least 3 examples are required';
        if (examples.length > 10) return 'Maximum 10 examples allowed';
        if (examples.some(e => e.length < 5)) return 'Each example must be at least 5 characters';
        return null;
      }
    },
    {
      id: 10,
      phase: 'style',
      field: 'communicationStyle',
      question: 'What communication style should this agent use? (professional, casual, technical, conversational, formal, creative)',
      validation: (answer: string) => {
        const validStyles = ['professional', 'casual', 'technical', 'conversational', 'formal', 'creative'];
        const normalized = answer.toLowerCase().trim();
        if (!validStyles.includes(normalized)) return `Communication style must be one of: ${validStyles.join(', ')}`;
        return null;
      }
    },
    {
      id: 11,
      phase: 'technical',
      field: 'limitations',
      question: 'What are the limitations or things this agent should NOT do? (comma-separated)',
      validation: (answer: string) => {
        const limitations = answer.split(',').map(l => l.trim()).filter(l => l);
        if (limitations.length < 1) return 'At least 1 limitation is required';
        return null;
      }
    },
    {
      id: 12,
      phase: 'technical',
      field: 'coreIdentity',
      question: 'How should this agent present itself to users? (Write a brief identity statement)',
      validation: (answer: string) => {
        if (!answer || answer.trim().length < 20) return 'Core identity must be at least 20 characters';
        if (answer.trim().length > 300) return 'Core identity must be less than 300 characters';
        return null;
      }
    }
  ];

  constructor(
    services: AgentServicesContext,
    private agentConfigService: AgentConfigurationService
  ) {
    super(services);
  }

  /**
   * Override processTask to handle structured conversation flow
   */
  async processTask(taskRequest: any): Promise<any> {
    try {
      this.logger.debug(`Agent Creator processing task. User message: ${taskRequest.prompt?.substring(0, 100)}...`);
      
      const userMessage = taskRequest.prompt || '';
      const userId = taskRequest.userId;
      const sessionId = taskRequest.sessionId || uuidv4();

      // Check if this is a structured conversation in progress
      let conversation = await this.agentConfigService.getConversation(sessionId);
      
      if (!conversation) {
        // New conversation - check if user wants to start structured flow
        if (this.shouldStartStructuredFlow(userMessage)) {
          return await this.startStructuredConversation(sessionId, userId);
        } else {
          // Handle as normal context-based conversation
          const response = await super.processTask(taskRequest);
          return this.addStructuredFlowPrompt(response);
        }
      }

      // Continue structured conversation
      return await this.continueStructuredConversation(conversation, userMessage, userId);
      
    } catch (error) {

      return {
        message: "I apologize, but I encountered an error. Let me help you create your agent. Would you like me to guide you through the process step-by-step?",
        metadata: {
          agentName: 'Agent Creator',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Check if user wants to start the structured agent creation flow
   */
  private shouldStartStructuredFlow(userMessage: string): boolean {
    const message = userMessage.toLowerCase();
    const triggerPhrases = [
      'create an agent',
      'build an agent', 
      'new agent',
      'make an agent',
      'generate an agent',
      'step by step',
      'guide me through',
      'structured approach'
    ];
    
    return triggerPhrases.some(phrase => message.includes(phrase));
  }

  /**
   * Add structured flow prompt to regular responses
   */
  private addStructuredFlowPrompt(response: any): any {
    const originalMessage = response.message || '';
    const structuredPrompt = `\n\n---\n\n💡 **Want a guided experience?** I can walk you through creating an agent step-by-step with specific questions. Just say "**create an agent**" to start the structured process.`;
    
    return {
      ...response,
      message: originalMessage + structuredPrompt
    };
  }

  /**
   * Start a new structured conversation
   */
  private async startStructuredConversation(sessionId: string, userId?: string): Promise<any> {
    const conversationData: ConversationData = {
      sessionId,
      conversationData: { messages: [] },
      requirementsGathered: {},
      currentPhase: 'identity',
      currentQuestion: 1,
      completionStatus: 'in_progress',
      completionPercentage: 0
    };

    await this.agentConfigService.createConversation(conversationData, userId);
    
    const firstQuestion = this.STRUCTURED_QUESTIONS[0];
    
    if (!firstQuestion) {
      throw new Error('No questions configured');
    }
    
    return {
      message: `🎯 **Let's create your agent step-by-step!**\n\nI'll ask you 12 specific questions to gather all the information needed to build your agent. This ensures we create exactly what you need without any guesswork.\n\n**Question ${firstQuestion.id} of 12** (${firstQuestion.phase})\n${firstQuestion.question}`,
      metadata: {
        agentName: 'Agent Creator',
        structuredFlow: true,
        currentQuestion: firstQuestion.id,
        phase: firstQuestion.phase,
        sessionId
      }
    };
  }

  /**
   * Continue structured conversation with validation
   */
  private async continueStructuredConversation(conversation: ConversationData, userMessage: string, userId?: string): Promise<any> {
    const currentQuestion = this.STRUCTURED_QUESTIONS[conversation.currentQuestion - 1];
    
    if (!currentQuestion) {
      this.logger.error(`Invalid question number: ${conversation.currentQuestion}`);
      return { message: 'Something went wrong. Let me restart the process.' };
    }

    // Validate the user's answer
    const validationError = currentQuestion.validation(userMessage);
    
    if (validationError) {
      return {
        message: `❌ **${validationError}**\n\nPlease try again.\n\n**Question ${currentQuestion.id} of 12** (${currentQuestion.phase})\n${currentQuestion.question}`,
        metadata: {
          agentName: 'Agent Creator',
          structuredFlow: true,
          validationError: true,
          currentQuestion: currentQuestion.id,
          phase: currentQuestion.phase
        }
      };
    }

    // Store the validated answer
    const updatedRequirements = {
      ...conversation.requirementsGathered,
      [currentQuestion.field]: this.normalizeAnswer(currentQuestion.field, userMessage)
    };

    // Calculate completion percentage
    const completionPercentage = Math.round((conversation.currentQuestion / this.STRUCTURED_QUESTIONS.length) * 100);
    
    // Check if this was the last question
    if (conversation.currentQuestion >= this.STRUCTURED_QUESTIONS.length) {
      // Complete the conversation and create the agent
      await this.agentConfigService.updateConversation(conversation.sessionId, {
        requirementsGathered: updatedRequirements,
        completionStatus: 'completed',
        completionPercentage: 100
      });
      
      return await this.createAgentFromRequirements(updatedRequirements, userId);
    }

    // Move to next question
    const nextQuestionIndex = conversation.currentQuestion;
    const nextQuestion = this.STRUCTURED_QUESTIONS[nextQuestionIndex];
    
    if (!nextQuestion) {
      throw new Error(`No question found at index ${nextQuestionIndex}`);
    }
    
    const newPhase = nextQuestion.phase;
    
    await this.agentConfigService.updateConversation(conversation.sessionId, {
      requirementsGathered: updatedRequirements,
      currentQuestion: conversation.currentQuestion + 1,
      currentPhase: newPhase as any,
      completionPercentage
    });

    return {
      message: `✅ Got it!\n\n**Question ${nextQuestion.id} of 12** (${nextQuestion.phase})\n${nextQuestion.question}`,
      metadata: {
        agentName: 'Agent Creator',
        structuredFlow: true,
        currentQuestion: nextQuestion.id,
        phase: nextQuestion.phase,
        completionPercentage
      }
    };
  }

  /**
   * Normalize answers based on field type
   */
  private normalizeAnswer(field: string, answer: string): any {
    const trimmed = answer.trim();
    
    switch (field) {
      case 'department':
      case 'agentType':
      case 'communicationStyle':
        return trimmed.toLowerCase();
      
      case 'capabilities':
      case 'limitations':
        return trimmed.split(',').map(item => item.trim()).filter(item => item);
      
      case 'skillExamples':
        return trimmed.split('\n').map(example => example.trim()).filter(example => example);
      
      case 'agentName':
        return trimmed.toLowerCase().replace(/[^a-z0-9]/g, '_');
        
      default:
        return trimmed;
    }
  }

  /**
   * Create agent from gathered requirements
   */
  private async createAgentFromRequirements(requirements: any, userId?: string): Promise<any> {
    try {
      // Generate agent files content
      const yamlConfig = this.generateYamlConfig(requirements);
      const contextContent = this.generateContextContent(requirements);
      const serviceContent = this.generateServiceContent(requirements);
      
      const agentData: AgentConfigurationData = {
        agentId: requirements.agentName,
        displayName: requirements.agentName.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        agentType: requirements.agentType,
        department: requirements.department,
        primaryPurpose: requirements.primaryPurpose,
        capabilities: requirements.capabilities,
        expertiseAreas: [requirements.department, requirements.skillName],
        responsibilities: [requirements.skillDescription],
        limitations: requirements.limitations,
        communicationStyle: requirements.communicationStyle,
        coreIdentity: requirements.coreIdentity,
        yamlConfig,
        contextContent,
        serviceContent
      };

      // Create agent in database
      const result = await this.agentConfigService.createAgentConfiguration(agentData, userId);
      
      // Create skill
      const skillData: AgentSkillData = {
        skillId: requirements.skillName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        skillName: requirements.skillName,
        description: requirements.skillDescription,
        examples: requirements.skillExamples,
        tags: [requirements.department],
        isPrimary: true
      };
      
      await this.agentConfigService.createAgentSkills(result.id, [skillData]);
      
      this.logger.log(`Successfully created agent: ${agentData.agentId}`);
      
      return {
        message: `🎉 **Agent Created Successfully!**\n\nI've created your **${agentData.displayName}** agent and stored it in the database!\n\n**✅ Configuration Complete:**\n- ✓ Agent ID: \`${agentData.agentId}\`\n- ✓ Department: ${agentData.department}\n- ✓ Type: ${agentData.agentType}\n- ✓ Primary Skill: ${skillData.skillName}\n\n**🚀 Ready to Use!** Your agent is now:\n- ✓ Stored in the database\n- ✓ Available for conversations\n- ✓ Discoverable by the system\n\nNo coding required - your agent is live and ready!`,
        metadata: {
          agentName: 'Agent Creator',
          created_agent: {
            id: result.id,
            agent_id: result.agentId,
            display_name: agentData.displayName,
            department: agentData.department
          }
        }
      };
      
    } catch (error) {
      this.logger.error('Failed to create agent from requirements:', error);
      
      return {
        message: `❌ I encountered an error while creating your agent: ${error instanceof Error ? error.message : 'Unknown error'}\n\nLet me try again. Would you like to restart the agent creation process?`,
        metadata: {
          agentName: 'Agent Creator',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Generate YAML configuration
   */
  private generateYamlConfig(requirements: any): string {
    return `name: "${requirements.agentName.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}"
description: "${requirements.description}"
version: "1.0.0"
type: "${requirements.agentType}"
department: "${requirements.department}"
metadata:
  created_by: "Agent Creator"
  communication_style: "${requirements.communicationStyle}"
  primary_skill: "${requirements.skillName}"`;
  }

  /**
   * Generate context content
   */
  private generateContextContent(requirements: any): string {
    return `# System Prompt: ${requirements.agentName.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}

## Identity
${requirements.coreIdentity}

## Primary Purpose
${requirements.primaryPurpose}

## Capabilities
${requirements.capabilities.map((cap: string) => `- ${cap}`).join('\n')}

## Primary Skill: ${requirements.skillName}
${requirements.skillDescription}

### Examples of what you can help with:
${requirements.skillExamples.map((example: string) => `- ${example}`).join('\n')}

## Communication Style
Use a ${requirements.communicationStyle} communication style in all interactions.

## Limitations
${requirements.limitations.map((limit: string) => `- ${limit}`).join('\n')}

## Instructions
- Always stay within your area of expertise
- Ask clarifying questions when requests are ambiguous
- Provide specific, actionable responses
- Be helpful while respecting your limitations`;
  }

  /**
   * Generate service content
   */
  private generateServiceContent(requirements: any): string {
    const className = requirements.agentName.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join('');
    return `import { Injectable, Logger } from '@nestjs/common';
import { ContextAgentBaseService } from '@agents/base/implementations/base-services/context/context-agent-base.service';
import { AgentServicesContext } from '@agents/base/services/agent-services-context';

@Injectable()
export class ${className}Service extends ContextAgentBaseService {
  protected readonly logger = new Logger(${className}Service.name);

  constructor(services: AgentServicesContext) {
    super(services);
  }

  getAgentName(): string {
    return '${requirements.agentName.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}';
  }
}`;
  }

  /**
   * Override the default name generation to return the correct agent name
   */
  getAgentName(): string {
    return 'Agent Creator';
  }

  /**
   * Clean up old conversations (maintenance function)
   */
  private async cleanupOldConversations(): Promise<void> {
    // This would typically be called by a scheduled job
    // For now, just log that cleanup should happen
    this.logger.debug('Conversation cleanup should be implemented as a scheduled job');
  }
}