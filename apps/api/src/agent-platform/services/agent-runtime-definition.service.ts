import { Injectable, Logger } from '@nestjs/common';
import { load as yamlLoad } from 'js-yaml';
import { AgentRecord } from '../interfaces/agent-record.interface';
import {
  AgentCommunicationDefinition,
  AgentExecutionDefinition,
  AgentHierarchyDefinition,
  AgentLLMDefinition,
  AgentMetadataDefinition,
  AgentPromptDefinition,
  AgentRuntimeDefinition,
  AgentSkillDefinition,
  AgentTransportDefinition,
} from '../interfaces/database-agent-definition.interface';

type UnknownRecord = Record<string, any> | null | undefined;

@Injectable()
export class AgentRuntimeDefinitionService {
  private readonly logger = new Logger(AgentRuntimeDefinitionService.name);

  buildDefinition(record: AgentRecord): AgentRuntimeDefinition {
    const descriptor = this.parseDescriptor(record.yaml);

    const metadata = this.extractMetadata(record, descriptor);
    const hierarchy = this.extractHierarchy(descriptor);
    const capabilities = this.extractCapabilities(descriptor);
    const skills = this.extractSkills(descriptor);
    const communication = this.extractCommunication(descriptor);
    const execution = this.extractExecution(record, descriptor);
    const transport = this.extractTransport(descriptor);
    const llm = this.extractLlm(record, descriptor);
    const prompts = this.extractPrompts(record, descriptor, llm);
    const context = this.mergeContext(record, descriptor);
    const config = this.mergeConfig(record, descriptor);

    return {
      id: record.id,
      slug: record.slug,
      organizationSlug: record.organization_slug,
      displayName: record.display_name,
      description: record.description,
      agentType: metadata.type ?? record.agent_type,
      modeProfile: record.mode_profile,
      status: record.status,
      metadata,
      hierarchy,
      capabilities,
      skills,
      communication,
      execution,
      transport,
      llm,
      prompts,
      context,
      config,
      agentCard: record.agent_card ?? null,
      rawDescriptor: descriptor,
      record,
    };
  }

  private parseDescriptor(
    raw: string | null | undefined,
  ): Record<string, any> | null {
    if (!raw || typeof raw !== 'string' || !raw.trim()) {
      return null;
    }

    try {
      // Attempt JSON parse first for stored JSON payloads
      const maybeJson = JSON.parse(raw);
      if (maybeJson && typeof maybeJson === 'object') {
        return maybeJson as Record<string, any>;
      }
    } catch {
      // Not valid JSON; fall back to YAML
    }

    try {
      const parsed = yamlLoad(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, any>;
      }
    } catch (error) {
      this.logger.warn(`Unable to parse agent YAML: ${String(error)}`);
    }

    return null;
  }

  private extractMetadata(
    record: AgentRecord,
    descriptor: UnknownRecord,
  ): AgentMetadataDefinition {
    const metadataNode = this.asRecord(descriptor?.metadata) ?? {};
    const tags = this.toStringArray(
      metadataNode.tags ?? descriptor?.tags ?? descriptor?.metadata?.tags,
    );

    return {
      name: (metadataNode.name ?? descriptor?.name ?? record.slug) || undefined,
      displayName:
        metadataNode.displayName ??
        descriptor?.displayName ??
        record.display_name,
      description:
        metadataNode.description ??
        descriptor?.description ??
        record.description,
      category: metadataNode.category ?? descriptor?.category ?? null,
      version:
        metadataNode.version ?? descriptor?.version ?? record.version ?? null,
      type:
        metadataNode.type ?? descriptor?.type ?? descriptor?.agent_type ?? null,
      provider: metadataNode.provider ?? null,
      tags,
      raw: metadataNode,
    };
  }

  private extractHierarchy(
    descriptor: UnknownRecord,
  ): AgentHierarchyDefinition | undefined {
    const hierarchyNode = this.asRecord(descriptor?.hierarchy);
    if (!hierarchyNode) {
      return undefined;
    }

    return {
      level: this.asString(hierarchyNode.level),
      reportsTo: this.asString(hierarchyNode.reportsTo),
      department: this.asString(hierarchyNode.department),
      team: this.toStringArray(hierarchyNode.team),
      path: this.asString(hierarchyNode.path),
    };
  }

  private extractCapabilities(descriptor: UnknownRecord): string[] {
    const capabilities = descriptor?.capabilities;
    if (Array.isArray(capabilities)) {
      return capabilities
        .map((entry) => this.asString(entry))
        .filter((entry): entry is string => Boolean(entry));
    }
    return [];
  }

  private extractSkills(descriptor: UnknownRecord): AgentSkillDefinition[] {
    const skills = descriptor?.skills;
    if (!Array.isArray(skills)) {
      return [];
    }

    return skills
      .map((skill) => this.asRecord(skill))
      .filter((skill): skill is Record<string, any> => Boolean(skill))
      .map((skill) => ({
        id: this.asString(skill.id),
        name: this.asString(skill.name) ?? 'Unnamed skill',
        description: this.asString(skill.description),
        tags: this.toStringArray(skill.tags),
        examples: this.toStringArray(skill.examples),
        inputModes: this.toStringArray(skill.input_modes ?? skill.inputModes),
        outputModes: this.toStringArray(
          skill.output_modes ?? skill.outputModes,
        ),
        skillOrder: this.asNumber(skill.skillOrder ?? skill.skill_order),
        isPrimary: this.asBoolean(skill.isPrimary ?? skill.is_primary),
        metadata: this.asRecord(skill.metadata) ?? undefined,
      }));
  }

  private extractCommunication(
    descriptor: UnknownRecord,
  ): AgentCommunicationDefinition {
    return {
      inputModes: this.toStringArray(
        descriptor?.input_modes ?? descriptor?.inputModes,
      ),
      outputModes: this.toStringArray(
        descriptor?.output_modes ?? descriptor?.outputModes,
      ),
    };
  }

  private extractExecution(
    record: AgentRecord,
    descriptor: UnknownRecord,
  ): AgentExecutionDefinition {
    const configuration = this.asRecord(descriptor?.configuration);

    // Check both descriptor.configuration (YAML) and record.config (JSON column)
    const executionCaps = this.asRecord(
      configuration?.execution_capabilities ??
        configuration?.executionCapabilities ??
        record.config?.execution_capabilities,
    );

    // execution_profile can come from descriptor YAML or record.config JSON
    const executionProfile =
      this.asString(configuration?.execution_profile) ??
      this.asString(record.config?.execution_profile);

    const modeProfile = record.mode_profile ?? 'conversation_only';

    return {
      modeProfile,
      canConverse: this.asBoolean(executionCaps?.can_converse) ?? true,
      canPlan:
        this.asBoolean(executionCaps?.can_plan) ??
        this.guessCanPlan(modeProfile),
      canBuild:
        this.asBoolean(executionCaps?.can_build) ??
        this.guessCanBuild(modeProfile),
      requiresHumanGate:
        this.asBoolean(executionCaps?.requires_human_gate) ?? false,
      executionProfile,
      timeoutSeconds: this.asNumber(configuration?.timeout_seconds),
    };
  }

  private extractTransport(
    descriptor: UnknownRecord,
  ): AgentTransportDefinition | undefined {
    const apiConfig = this.asRecord(descriptor?.api_configuration);
    if (apiConfig) {
      return {
        kind: 'api',
        api: {
          endpoint: this.asString(apiConfig.endpoint) ?? '',
          method: this.asString(apiConfig.method) ?? 'POST',
          timeout: this.asNumber(apiConfig.timeout),
          headers: this.asRecord(apiConfig.headers) ?? undefined,
          authentication: apiConfig.authentication,
          requestTransform:
            this.asRecord(apiConfig.request_transform) ?? undefined,
          responseTransform:
            this.asRecord(apiConfig.response_transform) ?? undefined,
        },
        raw: apiConfig,
      };
    }

    const externalConfig =
      this.asRecord(descriptor?.external_a2a_configuration) ??
      this.asRecord(descriptor?.external_configuration);
    if (externalConfig) {
      return {
        kind: 'external',
        external: {
          endpoint: this.asString(externalConfig.endpoint) ?? '',
          protocol: this.asString(externalConfig.protocol),
          timeout: this.asNumber(externalConfig.timeout),
          authentication: this.asRecord(externalConfig.authentication) ?? null,
          retry: this.asRecord(externalConfig.retry) ?? null,
          expectedCapabilities: this.toStringArray(
            externalConfig.expected_capabilities ??
              externalConfig.expectedCapabilities,
          ),
          healthCheck:
            this.asRecord(
              externalConfig.health_check ?? externalConfig.healthCheck,
            ) ?? null,
        },
        raw: externalConfig,
      };
    }

    return undefined;
  }

  private extractLlm(
    record: AgentRecord,
    descriptor: UnknownRecord,
  ): AgentLLMDefinition | undefined {
    const llmNode = this.asRecord(descriptor?.llm);
    const provider = llmNode?.provider ?? record.config?.llm?.provider;
    const model = llmNode?.model ?? record.config?.llm?.model;

    if (!llmNode && !provider && !model) {
      return undefined;
    }

    return {
      provider: this.asString(provider),
      model: this.asString(model),
      temperature: this.asNumber(llmNode?.temperature),
      maxTokens: this.asNumber(llmNode?.max_tokens ?? llmNode?.maxTokens),
      systemPrompt: this.asString(
        llmNode?.system_prompt ?? llmNode?.systemPrompt,
      ),
      raw: llmNode ?? undefined,
    };
  }

  private extractPrompts(
    record: AgentRecord,
    descriptor: UnknownRecord,
    llm: AgentLLMDefinition | undefined,
  ): AgentPromptDefinition {
    const promptsNode = this.asRecord(descriptor?.prompts);
    const contextNode = this.asRecord(descriptor?.context);
    const systemFromContext =
      this.asString(
        record.context?.system_prompt ?? record.context?.systemPrompt,
      ) ??
      this.asString(contextNode?.system_prompt ?? contextNode?.systemPrompt);

    return {
      system:
        promptsNode?.system ??
        systemFromContext ??
        llm?.systemPrompt ??
        undefined,
      plan: promptsNode?.plan ?? undefined,
      build: promptsNode?.build ?? undefined,
      human: promptsNode?.human ?? undefined,
      additional: promptsNode ?? undefined,
    };
  }

  private mergeContext(
    record: AgentRecord,
    descriptor: UnknownRecord,
  ): Record<string, any> | null {
    const contextNode = this.asRecord(descriptor?.context);
    if (record.context && contextNode) {
      return { ...contextNode, ...record.context };
    }
    return record.context ?? contextNode ?? null;
  }

  private mergeConfig(
    record: AgentRecord,
    descriptor: UnknownRecord,
  ): Record<string, any> | null {
    const configNode = this.asRecord(descriptor?.configuration);
    if (record.config && configNode) {
      return { ...configNode, ...record.config };
    }
    return record.config ?? configNode ?? null;
  }

  private asRecord(value: unknown): Record<string, any> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, any>;
  }

  private toStringArray(value: unknown): string[] {
    if (!value) {
      return [];
    }
    if (Array.isArray(value)) {
      return value
        .map((entry) => this.asString(entry))
        .filter((entry): entry is string => Boolean(entry));
    }
    if (typeof value === 'string') {
      return [value];
    }
    return [];
  }

  private asString(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
    return undefined;
  }

  private asNumber(value: unknown): number | undefined {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
    return undefined;
  }

  private asBoolean(value: unknown): boolean | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const lowered = value.toLowerCase();
      if (lowered === 'true') return true;
      if (lowered === 'false') return false;
    }
    return undefined;
  }

  private guessCanPlan(modeProfile: string): boolean {
    const lowered = modeProfile.toLowerCase();
    return lowered.includes('plan') || lowered.includes('full');
  }

  private guessCanBuild(modeProfile: string): boolean {
    const lowered = modeProfile.toLowerCase();
    return lowered.includes('build') || lowered.includes('full');
  }
}
