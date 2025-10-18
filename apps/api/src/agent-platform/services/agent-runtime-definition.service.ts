import { Injectable, Logger } from '@nestjs/common';
import type {
  JsonArray,
  JsonObject,
  JsonValue,
} from '@orchestrator-ai/transport-types';
import { load as yamlLoad } from 'js-yaml';
import { AgentRecord } from '../interfaces/agent.interface';
import {
  AgentConfigDefinition,
  AgentCommunicationDefinition,
  AgentExecutionDefinition,
  AgentHierarchyDefinition,
  AgentLLMDefinition,
  AgentMetadataDefinition,
  AgentPromptDefinition,
  AgentRuntimeDefinition,
  AgentSkillDefinition,
  AgentTransportDefinition,
} from '../interfaces/agent.interface';

type UnknownRecord = JsonObject | null | undefined;

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
    const descriptorSchemas = this.toJsonObject(descriptor?.schemas);

    const planStructure = this.resolveSchema(
      record.plan_structure,
      config?.plan_structure,
      config?.planStructure,
      descriptor?.plan_structure,
      descriptor?.planStructure,
      descriptorSchemas?.plan,
    );
    const deliverableStructure = this.resolveSchema(
      record.deliverable_structure,
      config?.deliverable_structure,
      config?.deliverableStructure,
      descriptor?.deliverable_structure,
      descriptor?.deliverableStructure,
      descriptorSchemas?.deliverable,
      descriptorSchemas?.build,
    );
    const ioSchema = this.resolveSchema(
      record.io_schema,
      config?.io_schema,
      config?.ioSchema,
      descriptor?.io_schema,
      descriptor?.ioSchema,
      descriptorSchemas?.io,
      descriptorSchemas?.io_schema,
      descriptorSchemas?.ioSchema,
    );

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
      planStructure,
      deliverableStructure,
      ioSchema,
      record,
    };
  }

  private parseDescriptor(raw: string | null | undefined): JsonObject | null {
    if (!raw || typeof raw !== 'string' || !raw.trim()) {
      return null;
    }

    try {
      // Attempt JSON parse first for stored JSON payloads
      const maybeJson = JSON.parse(raw) as unknown;
      if (this.isJsonObject(maybeJson)) {
        return maybeJson;
      }
    } catch {
      // Not valid JSON; fall back to YAML
    }

    try {
      const parsed = yamlLoad(raw);
      const jsonObject = this.toJsonObject(parsed);
      if (jsonObject) {
        return jsonObject;
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
    const metadataNode = this.toJsonObject(descriptor?.metadata);
    const tags = this.toStringArray(metadataNode?.tags ?? descriptor?.tags);

    return {
      name:
        this.asString(metadataNode?.name) ??
        this.asString(descriptor?.name) ??
        record.slug,
      displayName:
        this.asString(metadataNode?.displayName) ??
        this.asString(descriptor?.displayName) ??
        record.display_name,
      description:
        this.asString(metadataNode?.description) ??
        this.asString(descriptor?.description) ??
        record.description,
      category:
        this.asString(metadataNode?.category) ??
        this.asString(descriptor?.category) ??
        null,
      version:
        this.asString(metadataNode?.version) ??
        this.asString(descriptor?.version) ??
        record.version ??
        null,
      type:
        this.asString(metadataNode?.type) ??
        this.asString(descriptor?.type) ??
        this.asString(descriptor?.agent_type) ??
        null,
      provider: this.asString(metadataNode?.provider) ?? null,
      tags,
      raw: metadataNode ?? null,
    };
  }

  private extractHierarchy(
    descriptor: UnknownRecord,
  ): AgentHierarchyDefinition | undefined {
    const hierarchyNode = this.toJsonObject(descriptor?.hierarchy);
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
    return this.toStringArray(descriptor?.capabilities);
  }

  private extractSkills(descriptor: UnknownRecord): AgentSkillDefinition[] {
    const skills = this.toJsonArray(descriptor?.skills);
    if (!skills) {
      return [];
    }

    return skills
      .map((skill) => this.toJsonObject(skill))
      .filter((skill): skill is JsonObject => Boolean(skill))
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
        metadata: this.toJsonObject(skill.metadata) ?? undefined,
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
    const configuration = this.toJsonObject(descriptor?.configuration);
    const recordConfig = record.config ?? null;

    const executionCaps =
      this.toJsonObject(
        configuration?.execution_capabilities ??
          configuration?.executionCapabilities ??
          recordConfig?.execution_capabilities ??
          recordConfig?.executionCapabilities,
      ) ?? null;

    const executionProfile =
      this.asString(configuration?.execution_profile) ??
      this.asString(configuration?.executionProfile) ??
      this.asString(recordConfig?.execution_profile) ??
      this.asString(recordConfig?.executionProfile) ??
      undefined;

    const modeProfile = record.mode_profile ?? 'conversation_only';

    return {
      modeProfile,
      canConverse:
        this.asBoolean(executionCaps?.can_converse) ??
        this.asBoolean(executionCaps?.canConverse) ??
        true,
      canPlan:
        this.asBoolean(executionCaps?.can_plan) ??
        this.asBoolean(executionCaps?.canPlan) ??
        this.guessCanPlan(modeProfile),
      canBuild:
        this.asBoolean(executionCaps?.can_build) ??
        this.asBoolean(executionCaps?.canBuild) ??
        this.guessCanBuild(modeProfile),
      canOrchestrate:
        this.asBoolean(executionCaps?.can_orchestrate) ??
        this.asBoolean(executionCaps?.canOrchestrate) ??
        this.guessCanOrchestrate(modeProfile),
      requiresHumanGate:
        this.asBoolean(executionCaps?.requires_human_gate) ??
        this.asBoolean(executionCaps?.requiresHumanGate) ??
        false,
      executionProfile,
      timeoutSeconds:
        this.asNumber(configuration?.timeout_seconds) ??
        this.asNumber(configuration?.timeoutSeconds) ??
        this.asNumber(recordConfig?.timeout_seconds) ??
        this.asNumber(recordConfig?.timeoutSeconds),
    };
  }

  private extractTransport(
    descriptor: UnknownRecord,
  ): AgentTransportDefinition | undefined {
    const apiConfig = this.toJsonObject(descriptor?.api_configuration);
    if (apiConfig) {
      const headers = this.toStringRecord(apiConfig.headers);
      const authentication =
        apiConfig.authentication === null
          ? null
          : (this.toJsonObject(apiConfig.authentication) ?? null);
      const requestTransform =
        this.toJsonObject(
          apiConfig.request_transform ?? apiConfig.requestTransform,
        ) ?? null;
      const responseTransform =
        this.toJsonObject(
          apiConfig.response_transform ?? apiConfig.responseTransform,
        ) ?? null;
      return {
        kind: 'api',
        api: {
          endpoint: this.asString(apiConfig.endpoint) ?? '',
          method: this.asString(apiConfig.method) ?? 'POST',
          timeout: this.asNumber(apiConfig.timeout),
          headers,
          authentication,
          requestTransform: requestTransform ?? undefined,
          responseTransform: responseTransform ?? undefined,
        },
        raw: apiConfig,
      };
    }

    const externalConfig =
      this.toJsonObject(descriptor?.external_a2a_configuration) ??
      this.toJsonObject(descriptor?.external_configuration);
    if (externalConfig) {
      const authentication =
        externalConfig.authentication === null
          ? null
          : (this.toJsonObject(externalConfig.authentication) ?? null);
      const retry =
        externalConfig.retry === null
          ? null
          : (this.toJsonObject(externalConfig.retry) ?? null);
      const healthCheck =
        this.toJsonObject(
          externalConfig.health_check ?? externalConfig.healthCheck,
        ) ?? null;

      return {
        kind: 'external',
        external: {
          endpoint: this.asString(externalConfig.endpoint) ?? '',
          protocol: this.asString(externalConfig.protocol),
          timeout: this.asNumber(externalConfig.timeout),
          authentication,
          retry,
          expectedCapabilities: this.toStringArray(
            externalConfig.expected_capabilities ??
              externalConfig.expectedCapabilities,
          ),
          healthCheck,
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
    const llmNode = this.toJsonObject(descriptor?.llm);
    const configNode = this.toJsonObject(record.config);
    const configLlm = this.toJsonObject(configNode?.llm);
    const providerCandidate = llmNode?.provider ?? configLlm?.provider;
    const modelCandidate = llmNode?.model ?? configLlm?.model;

    if (!llmNode && !providerCandidate && !modelCandidate) {
      return undefined;
    }

    return {
      provider: this.asString(providerCandidate),
      model: this.asString(modelCandidate),
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
    const promptsNode = this.toJsonObject(descriptor?.prompts);
    const contextNode = this.toJsonObject(descriptor?.context);
    const systemFromContext =
      this.asString(
        record.context?.system_prompt ?? record.context?.systemPrompt,
      ) ??
      this.asString(contextNode?.system_prompt ?? contextNode?.systemPrompt);

    return {
      system:
        this.asString(promptsNode?.system) ??
        systemFromContext ??
        llm?.systemPrompt ??
        undefined,
      plan: this.asString(promptsNode?.plan),
      build: this.asString(promptsNode?.build),
      human: this.asString(promptsNode?.human),
      additional: promptsNode ?? undefined,
    };
  }

  private mergeContext(
    record: AgentRecord,
    descriptor: UnknownRecord,
  ): JsonObject | null {
    const descriptorContext = this.toJsonObject(descriptor?.context);
    const recordContext = record.context ?? null;
    const merged = this.mergeJsonObjects(descriptorContext, recordContext);
    return merged;
  }

  private mergeConfig(
    record: AgentRecord,
    descriptor: UnknownRecord,
  ): AgentConfigDefinition | null {
    const descriptorConfig = this.toJsonObject(
      descriptor?.configuration,
    ) as AgentConfigDefinition | null;
    const merged = this.mergeJsonObjects(descriptorConfig, record.config);
    return (merged as AgentConfigDefinition | null) ?? null;
  }

  private toJsonObject(value: unknown): JsonObject | null {
    if (this.isJsonObject(value)) {
      return value;
    }
    return null;
  }

  private toJsonArray(value: unknown): JsonArray | null {
    if (this.isJsonArray(value)) {
      return value;
    }
    return null;
  }

  private mergeJsonObjects(
    base?: JsonObject | null,
    override?: JsonObject | null,
  ): JsonObject | null {
    if (!base && !override) {
      return null;
    }
    if (!base) {
      return override ?? null;
    }
    if (!override) {
      return base ?? null;
    }
    return { ...base, ...override } as JsonObject;
  }

  private toStringRecord(value: unknown): Record<string, string> | undefined {
    if (!this.isJsonObject(value)) {
      return undefined;
    }

    const result: Record<string, string> = {};
    for (const [key, entry] of Object.entries(value)) {
      const normalized = this.asString(entry);
      if (normalized !== undefined) {
        result[key] = normalized;
      }
    }

    return Object.keys(result).length > 0 ? result : undefined;
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

  private isJsonValue(value: unknown): value is JsonValue {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'boolean'
    ) {
      return true;
    }
    if (typeof value === 'number') {
      return Number.isFinite(value);
    }
    if (Array.isArray(value)) {
      return value.every((entry) => this.isJsonValue(entry));
    }
    if (typeof value === 'object') {
      return this.isJsonObject(value);
    }
    return false;
  }

  private isJsonObject(value: unknown): value is JsonObject {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    return Object.entries(value as Record<string, unknown>).every(([, entry]) =>
      this.isJsonValue(entry),
    );
  }

  private isJsonArray(value: unknown): value is JsonArray {
    if (!Array.isArray(value)) {
      return false;
    }
    return value.every((entry) => this.isJsonValue(entry));
  }

  private resolveSchema(...candidates: unknown[]): string | JsonObject | null {
    for (const candidate of candidates) {
      const normalized = this.normalizeSchema(candidate);
      if (normalized) {
        return normalized;
      }
    }
    return null;
  }

  private normalizeSchema(value: unknown): string | JsonObject | null {
    if (!value) {
      return null;
    }

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value) as unknown;
        return this.toJsonObject(parsed);
      } catch {
        // If it's not valid JSON, return the string as-is (e.g., markdown template)
        return value;
      }
    }

    return this.toJsonObject(value);
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

  private guessCanOrchestrate(modeProfile: string): boolean {
    const lowered = modeProfile.toLowerCase();
    return lowered.includes('orchestrate') || lowered.includes('full');
  }
}
