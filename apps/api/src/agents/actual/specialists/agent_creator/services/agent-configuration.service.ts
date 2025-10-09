import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../../../../supabase';

export interface AgentConfigurationData {
  agentId: string;
  displayName: string;
  agentType: 'context' | 'api' | 'function';
  department: 'marketing' | 'engineering' | 'operations' | 'finance' | 'hr' | 'sales' | 'research' | 'product' | 'specialists';
  reportsTo?: string;
  primaryPurpose: string;
  capabilities: string[];
  expertiseAreas: string[];
  responsibilities: string[];
  limitations: string[];
  communicationStyle?: 'professional' | 'casual' | 'technical' | 'conversational' | 'formal' | 'creative';
  coreIdentity?: string;
  yamlConfig: string;
  contextContent: string;
  serviceContent: string;
  metadata?: Record<string, any>;
}

export interface AgentSkillData {
  skillId: string;
  skillName: string;
  description: string;
  examples: string[];
  tags?: string[];
  inputModes?: string[];
  outputModes?: string[];
  skillOrder?: number;
  isPrimary?: boolean;
}

export interface ConversationData {
  sessionId: string;
  conversationData: Record<string, any>;
  requirementsGathered: Record<string, any>;
  currentPhase: 'identity' | 'hierarchy' | 'purpose' | 'skills' | 'style' | 'technical' | 'complete';
  currentQuestion: number;
  completionStatus: 'in_progress' | 'completed' | 'abandoned' | 'failed';
  completionPercentage: number;
  userAgent?: string;
  ipAddress?: string;
  metadata?: Record<string, any>;
}

export interface ConversationEventData {
  conversationId: string;
  eventType: 'conversation_started' | 'question_asked' | 'answer_provided' | 'validation_passed' | 'validation_failed' | 'phase_completed' | 'agent_created' | 'conversation_completed' | 'conversation_abandoned';
  eventData: Record<string, any>;
  questionNumber?: number;
  fieldName?: string;
  userInput?: string;
  aiResponse?: string;
  validationResult?: Record<string, any>;
}

@Injectable()
export class AgentConfigurationService {
  private readonly logger = new Logger(AgentConfigurationService.name);

  constructor(private supabaseService: SupabaseService) {}

  async createAgentConfiguration(
    data: AgentConfigurationData,
    userId?: string
  ): Promise<{ id: string; agentId: string }> {
    try {
      const client = this.supabaseService.getServiceClient();
      
      const insertData = {
        agent_id: data.agentId,
        display_name: data.displayName,
        agent_type: data.agentType,
        department: data.department,
        reports_to: data.reportsTo,
        created_by: userId,
        primary_purpose: data.primaryPurpose,
        capabilities: JSON.stringify(data.capabilities),
        expertise_areas: JSON.stringify(data.expertiseAreas),
        responsibilities: JSON.stringify(data.responsibilities),
        limitations: JSON.stringify(data.limitations),
        communication_style: data.communicationStyle,
        core_identity: data.coreIdentity,
        yaml_config: data.yamlConfig,
        context_content: data.contextContent,
        service_content: data.serviceContent,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        status: 'active'
      };

      const { data: result, error } = await client
        .from('agent_configurations')
        .insert(insertData)
        .select('id, agent_id')
        .single();

      if (error) {
        this.logger.error('Failed to create agent configuration', error);
        throw new Error(`Failed to create agent configuration: ${error.message}`);
      }

      // Log the creation
      await this.logAgentAction('created', result.id, { agent_id: data.agentId });

      this.logger.log(`Created agent configuration: ${data.agentId} (${result.id})`);
      return { id: result.id, agentId: result.agent_id };
    } catch (error) {
      this.logger.error('Error creating agent configuration', error);
      throw error;
    }
  }

  async getAgentConfiguration(agentId: string): Promise<AgentConfigurationData | null> {
    try {
      const client = this.supabaseService.getAnonClient();
      
      const { data, error } = await client
        .from('agent_configurations')
        .select('*')
        .eq('agent_id', agentId)
        .eq('status', 'active')
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // No rows returned
          return null;
        }
        this.logger.error(`Failed to get agent configuration: ${agentId}`, error);
        throw new Error(`Failed to get agent configuration: ${error.message}`);
      }

      return this.mapDatabaseRowToAgentData(data);
    } catch (error) {
      this.logger.error(`Error getting agent configuration: ${agentId}`, error);
      throw error;
    }
  }

  async getAgentConfigurationById(id: string): Promise<AgentConfigurationData | null> {
    try {
      const client = this.supabaseService.getAnonClient();
      
      const { data, error } = await client
        .from('agent_configurations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        this.logger.error(`Failed to get agent configuration by ID: ${id}`, error);
        throw new Error(`Failed to get agent configuration: ${error.message}`);
      }

      return this.mapDatabaseRowToAgentData(data);
    } catch (error) {
      this.logger.error(`Error getting agent configuration by ID: ${id}`, error);
      throw error;
    }
  }

  async listAgentConfigurations(
    department?: string,
    agentType?: string,
    limit = 50,
    offset = 0
  ): Promise<AgentConfigurationData[]> {
    try {
      const client = this.supabaseService.getAnonClient();
      
      let query = client
        .from('agent_configurations')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (department) {
        query = query.eq('department', department);
      }

      if (agentType) {
        query = query.eq('agent_type', agentType);
      }

      const { data, error } = await query;

      if (error) {
        this.logger.error('Failed to list agent configurations', error);
        throw new Error(`Failed to list agent configurations: ${error.message}`);
      }

      return data.map(row => this.mapDatabaseRowToAgentData(row));
    } catch (error) {
      this.logger.error('Error listing agent configurations', error);
      throw error;
    }
  }

  async updateAgentConfiguration(
    agentId: string,
    updates: Partial<AgentConfigurationData>,
    userId?: string
  ): Promise<void> {
    try {
      const client = this.supabaseService.getServiceClient();
      
      // Get current state for audit log
      const currentData = await this.getAgentConfiguration(agentId);
      if (!currentData) {
        throw new Error(`Agent configuration not found: ${agentId}`);
      }

      const updateData: any = {};
      
      if (updates.displayName !== undefined) updateData.display_name = updates.displayName;
      if (updates.agentType !== undefined) updateData.agent_type = updates.agentType;
      if (updates.department !== undefined) updateData.department = updates.department;
      if (updates.reportsTo !== undefined) updateData.reports_to = updates.reportsTo;
      if (updates.primaryPurpose !== undefined) updateData.primary_purpose = updates.primaryPurpose;
      if (updates.capabilities !== undefined) updateData.capabilities = JSON.stringify(updates.capabilities);
      if (updates.expertiseAreas !== undefined) updateData.expertise_areas = JSON.stringify(updates.expertiseAreas);
      if (updates.responsibilities !== undefined) updateData.responsibilities = JSON.stringify(updates.responsibilities);
      if (updates.limitations !== undefined) updateData.limitations = JSON.stringify(updates.limitations);
      if (updates.communicationStyle !== undefined) updateData.communication_style = updates.communicationStyle;
      if (updates.coreIdentity !== undefined) updateData.core_identity = updates.coreIdentity;
      if (updates.yamlConfig !== undefined) updateData.yaml_config = updates.yamlConfig;
      if (updates.contextContent !== undefined) updateData.context_content = updates.contextContent;
      if (updates.serviceContent !== undefined) updateData.service_content = updates.serviceContent;
      if (updates.metadata !== undefined) updateData.metadata = updates.metadata ? JSON.stringify(updates.metadata) : null;

      const { error } = await client
        .from('agent_configurations')
        .update(updateData)
        .eq('agent_id', agentId);

      if (error) {
        this.logger.error(`Failed to update agent configuration: ${agentId}`, error);
        throw new Error(`Failed to update agent configuration: ${error.message}`);
      }

      // Log the update with before/after states
      const updatedData = await this.getAgentConfiguration(agentId);
      await this.logAgentAction('updated', undefined, 
        { agent_id: agentId, changes: Object.keys(updateData) },
        currentData,
        updatedData
      );

      this.logger.log(`Updated agent configuration: ${agentId}`);
    } catch (error) {
      this.logger.error(`Error updating agent configuration: ${agentId}`, error);
      throw error;
    }
  }

  async deactivateAgentConfiguration(agentId: string, userId?: string): Promise<void> {
    try {
      const client = this.supabaseService.getServiceClient();
      
      const { error } = await client
        .from('agent_configurations')
        .update({ status: 'inactive' })
        .eq('agent_id', agentId);

      if (error) {
        this.logger.error(`Failed to deactivate agent configuration: ${agentId}`, error);
        throw new Error(`Failed to deactivate agent configuration: ${error.message}`);
      }

      await this.logAgentAction('deactivated', undefined, { agent_id: agentId });
      this.logger.log(`Deactivated agent configuration: ${agentId}`);
    } catch (error) {
      this.logger.error(`Error deactivating agent configuration: ${agentId}`, error);
      throw error;
    }
  }

  async createAgentSkills(agentConfigurationId: string, skills: AgentSkillData[]): Promise<void> {
    try {
      const client = this.supabaseService.getServiceClient();
      
      const skillsData = skills.map(skill => ({
        agent_configuration_id: agentConfigurationId,
        skill_id: skill.skillId,
        skill_name: skill.skillName,
        description: skill.description,
        examples: JSON.stringify(skill.examples),
        tags: skill.tags ? JSON.stringify(skill.tags) : JSON.stringify([]),
        input_modes: skill.inputModes ? JSON.stringify(skill.inputModes) : JSON.stringify(['text/plain', 'application/json']),
        output_modes: skill.outputModes ? JSON.stringify(skill.outputModes) : JSON.stringify(['text/plain', 'application/json']),
        skill_order: skill.skillOrder || 0,
        is_primary: skill.isPrimary || false
      }));

      const { error } = await client
        .from('agent_skills')
        .insert(skillsData);

      if (error) {
        this.logger.error(`Failed to create agent skills for: ${agentConfigurationId}`, error);
        throw new Error(`Failed to create agent skills: ${error.message}`);
      }

      this.logger.log(`Created ${skills.length} skills for agent: ${agentConfigurationId}`);
    } catch (error) {
      this.logger.error(`Error creating agent skills for: ${agentConfigurationId}`, error);
      throw error;
    }
  }

  async getAgentSkills(agentConfigurationId: string): Promise<AgentSkillData[]> {
    try {
      const client = this.supabaseService.getAnonClient();
      
      const { data, error } = await client
        .from('agent_skills')
        .select('*')
        .eq('agent_configuration_id', agentConfigurationId)
        .order('skill_order', { ascending: true });

      if (error) {
        this.logger.error(`Failed to get agent skills for: ${agentConfigurationId}`, error);
        throw new Error(`Failed to get agent skills: ${error.message}`);
      }

      return data.map(row => ({
        skillId: row.skill_id,
        skillName: row.skill_name,
        description: row.description,
        examples: JSON.parse(row.examples),
        tags: JSON.parse(row.tags || '[]'),
        inputModes: JSON.parse(row.input_modes || '["text/plain", "application/json"]'),
        outputModes: JSON.parse(row.output_modes || '["text/plain", "application/json"]'),
        skillOrder: row.skill_order,
        isPrimary: row.is_primary
      }));
    } catch (error) {
      this.logger.error(`Error getting agent skills for: ${agentConfigurationId}`, error);
      throw error;
    }
  }

  async createConversation(data: ConversationData, userId?: string): Promise<string> {
    try {
      const client = this.supabaseService.getServiceClient();
      
      const insertData = {
        session_id: data.sessionId,
        user_id: userId,
        conversation_data: JSON.stringify(data.conversationData),
        requirements_gathered: JSON.stringify(data.requirementsGathered),
        current_phase: data.currentPhase,
        current_question: data.currentQuestion,
        completion_status: data.completionStatus,
        completion_percentage: data.completionPercentage,
        user_agent: data.userAgent,
        ip_address: data.ipAddress,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null
      };

      const { data: result, error } = await client
        .from('agent_creation_conversations')
        .insert(insertData)
        .select('id')
        .single();

      if (error) {
        this.logger.error('Failed to create conversation', error);
        throw new Error(`Failed to create conversation: ${error.message}`);
      }

      this.logger.log(`Created conversation: ${data.sessionId} (${result.id})`);
      return result.id;
    } catch (error) {
      this.logger.error('Error creating conversation', error);
      throw error;
    }
  }

  async updateConversation(sessionId: string, updates: Partial<ConversationData>): Promise<void> {
    try {
      const client = this.supabaseService.getServiceClient();
      
      const updateData: any = {};
      
      if (updates.conversationData !== undefined) updateData.conversation_data = JSON.stringify(updates.conversationData);
      if (updates.requirementsGathered !== undefined) updateData.requirements_gathered = JSON.stringify(updates.requirementsGathered);
      if (updates.currentPhase !== undefined) updateData.current_phase = updates.currentPhase;
      if (updates.currentQuestion !== undefined) updateData.current_question = updates.currentQuestion;
      if (updates.completionStatus !== undefined) updateData.completion_status = updates.completionStatus;
      if (updates.completionPercentage !== undefined) updateData.completion_percentage = updates.completionPercentage;
      if (updates.metadata !== undefined) updateData.metadata = updates.metadata ? JSON.stringify(updates.metadata) : null;

      const { error } = await client
        .from('agent_creation_conversations')
        .update(updateData)
        .eq('session_id', sessionId);

      if (error) {
        this.logger.error(`Failed to update conversation: ${sessionId}`, error);
        throw new Error(`Failed to update conversation: ${error.message}`);
      }

      this.logger.log(`Updated conversation: ${sessionId}`);
    } catch (error) {
      this.logger.error(`Error updating conversation: ${sessionId}`, error);
      throw error;
    }
  }

  async getConversation(sessionId: string): Promise<ConversationData | null> {
    try {
      const client = this.supabaseService.getAnonClient();
      
      const { data, error } = await client
        .from('agent_creation_conversations')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        this.logger.error(`Failed to get conversation: ${sessionId}`, error);
        throw new Error(`Failed to get conversation: ${error.message}`);
      }

      return {
        sessionId: data.session_id,
        conversationData: JSON.parse(data.conversation_data),
        requirementsGathered: JSON.parse(data.requirements_gathered),
        currentPhase: data.current_phase,
        currentQuestion: data.current_question,
        completionStatus: data.completion_status,
        completionPercentage: data.completion_percentage,
        userAgent: data.user_agent,
        ipAddress: data.ip_address,
        metadata: data.metadata ? JSON.parse(data.metadata) : null
      };
    } catch (error) {
      this.logger.error(`Error getting conversation: ${sessionId}`, error);
      throw error;
    }
  }

  async logConversationEvent(data: ConversationEventData): Promise<void> {
    try {
      const client = this.supabaseService.getServiceClient();
      
      const insertData = {
        conversation_id: data.conversationId,
        event_type: data.eventType,
        event_data: JSON.stringify(data.eventData),
        question_number: data.questionNumber,
        field_name: data.fieldName,
        user_input: data.userInput,
        ai_response: data.aiResponse,
        validation_result: data.validationResult ? JSON.stringify(data.validationResult) : null
      };

      const { error } = await client
        .from('agent_creation_events')
        .insert(insertData);

      if (error) {
        this.logger.error('Failed to log conversation event', error);
        // Don't throw error for logging failures to avoid disrupting main flow
      }
    } catch (error) {
      this.logger.error('Error logging conversation event', error);
    }
  }

  private async logAgentAction(
    action: string,
    agentConfigurationId?: string,
    details: Record<string, any> = {},
    previousState?: any,
    newState?: any
  ): Promise<void> {
    try {
      const client = this.supabaseService.getServiceClient();
      
      const { error } = await client.rpc('log_agent_action', {
        p_action: action,
        p_agent_id: agentConfigurationId,
        p_details: details,
        p_previous_state: previousState,
        p_new_state: newState,
        p_success: true
      });

      if (error) {
        this.logger.warn('Failed to log agent action', error);
      }
    } catch (error) {
      this.logger.warn('Error logging agent action', error);
    }
  }

  private mapDatabaseRowToAgentData(row: any): AgentConfigurationData {
    return {
      agentId: row.agent_id,
      displayName: row.display_name,
      agentType: row.agent_type,
      department: row.department,
      reportsTo: row.reports_to,
      primaryPurpose: row.primary_purpose,
      capabilities: JSON.parse(row.capabilities || '[]'),
      expertiseAreas: JSON.parse(row.expertise_areas || '[]'),
      responsibilities: JSON.parse(row.responsibilities || '[]'),
      limitations: JSON.parse(row.limitations || '[]'),
      communicationStyle: row.communication_style,
      coreIdentity: row.core_identity,
      yamlConfig: row.yaml_config,
      contextContent: row.context_content,
      serviceContent: row.service_content,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    };
  }
}