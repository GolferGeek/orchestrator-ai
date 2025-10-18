import Ajv from 'ajv';
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/agent.interface';
import { LLMService } from '@llm/llm.service';
import { Agent2AgentConversationsService } from '../agent-conversations.service';
import { PlansService } from '../../plans/services/plans.service';
import { DeliverablesService } from '../../deliverables/deliverables.service';
import { TaskRequestDto, AgentTaskMode } from '../../dto/task-request.dto';
import { TaskResponseDto } from '../../dto/task-response.dto';
import type {
  BuildCopyVersionPayload,
  BuildDeletePayload,
  BuildDeleteVersionPayload,
  BuildEditPayload,
  BuildListPayload,
  BuildMergeVersionsPayload,
  BuildReadPayload,
  BuildRerunPayload,
  BuildSetCurrentPayload,
} from '@orchestrator-ai/transport-types/modes/build.types';
import type {
  DeliverableData,
  DeliverableVersionData,
} from '@orchestrator-ai/transport-types/shared/data-types';
import type { JsonObject, JsonValue } from '@orchestrator-ai/transport-types';
import {
  fetchExistingDeliverable,
  buildResponseMetadata,
  handleError,
  resolveConversationId,
  resolveTaskId,
  resolveUserId,
} from './shared.helpers';

const isJsonObject = (value: JsonValue | undefined): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export interface BuildHandlerDependencies {
  deliverablesService: DeliverablesService;
  plansService: PlansService;
  llmService: LLMService;
  conversationsService: Agent2AgentConversationsService;
}

export type ExecuteBuildFn = (
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
) => Promise<TaskResponseDto>;

/**
 * Handles BUILD read action by retrieving a deliverable.
 * @param definition - Agent definition context
 * @param request - Incoming task request payload
 * @param organizationSlug - Optional organization identifier
 * @param services - Supporting service dependencies
 * @returns A task response containing deliverable data
 */
export async function handleBuildRead(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: BuildHandlerDependencies,
): Promise<TaskResponseDto> {
  void organizationSlug;
  void services.plansService;
  void services.llmService;
  void services.conversationsService;

  try {
    const payload = (request.payload ?? {}) as Partial<BuildReadPayload>;
    const { userId, conversationId, executionContext } =
      buildBuildActionContext(definition, request);

    const existingDeliverable = (await fetchExistingDeliverable(
      services.deliverablesService,
      request,
    )) as Record<string, any> | null;

    if (!existingDeliverable) {
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        'No deliverable found for this conversation',
      );
    }

    const deliverableRecord = await services.deliverablesService.findOne(
      existingDeliverable.id as string,
      userId,
    );

    const baseDeliverable = serializeDeliverable(
      deliverableRecord,
      definition,
      userId,
    );

    if (payload.versionId) {
      const listResult = await services.deliverablesService.executeAction(
        'list',
        {
          includeArchived: true,
        },
        executionContext,
      );

      if (!listResult.success || !listResult.data) {
        return TaskResponseDto.failure(
          AgentTaskMode.BUILD,
          listResult.error?.message ??
            'Unable to list deliverable versions for version lookup',
        );
      }

      const versions = (listResult.data.versions ?? []) as any[];
      const targetVersion = versions.find(
        (version) => version.id === payload.versionId,
      );

      if (!targetVersion) {
        return TaskResponseDto.failure(
          AgentTaskMode.BUILD,
          `Deliverable version ${payload.versionId} not found`,
        );
      }

      const metadata = buildResponseMetadata(EMPTY_BUILD_METADATA, {
        deliverableMetadata: buildDeliverableMetadata(targetVersion.content),
        requestedVersionId: payload.versionId,
        conversationId,
      });

      return TaskResponseDto.success(AgentTaskMode.BUILD, {
        content: {
          deliverable: baseDeliverable,
          version: serializeDeliverableVersion(targetVersion) ?? undefined,
        },
        metadata,
      });
    }

    const readResult = await services.deliverablesService.executeAction(
      'read',
      {},
      executionContext,
    );

    if (!readResult.success || !readResult.data) {
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        readResult.error?.message ?? 'Failed to read deliverable',
      );
    }

    const responseDeliverable =
      readResult.data.deliverable ?? deliverableRecord;
    const responseVersion =
      readResult.data.version ?? deliverableRecord.currentVersion ?? null;

    const metadata = buildResponseMetadata(EMPTY_BUILD_METADATA, {
      deliverableMetadata: buildDeliverableMetadata(
        responseVersion?.content ?? '',
      ),
      conversationId,
    });

    return TaskResponseDto.success(AgentTaskMode.BUILD, {
      content: {
        deliverable: serializeDeliverable(
          responseDeliverable,
          definition,
          userId,
        ),
        version: serializeDeliverableVersion(responseVersion) ?? undefined,
      },
      metadata,
    });
  } catch (error) {
    return handleError(AgentTaskMode.BUILD, error);
  }
}

/**
 * Handles BUILD list action by returning deliverable history.
 * @param definition - Agent definition context
 * @param request - Incoming task request payload
 * @param organizationSlug - Optional organization identifier
 * @param services - Supporting service dependencies
 * @returns A task response containing deliverable list data
 */
export async function handleBuildList(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: BuildHandlerDependencies,
): Promise<TaskResponseDto> {
  void organizationSlug;
  void services.plansService;
  void services.llmService;
  void services.conversationsService;

  try {
    const payload = (request.payload ?? {}) as Partial<BuildListPayload>;
    const { userId, executionContext } = buildBuildActionContext(
      definition,
      request,
    );

    const listResult = await services.deliverablesService.executeAction(
      'list',
      {
        includeArchived: payload.includeArchived ?? false,
      },
      executionContext,
    );

    if (!listResult.success || !listResult.data) {
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        listResult.error?.message ?? 'Failed to list deliverable versions',
      );
    }

    const deliverable = serializeDeliverable(
      listResult.data.deliverable,
      definition,
      userId,
    );
    const versions = (listResult.data.versions ?? []).map((version: any) =>
      serializeDeliverableVersion(version),
    );

    const metadata = buildResponseMetadata(EMPTY_BUILD_METADATA, {
      versionCount: versions.filter(
        (version: any): version is DeliverableVersionData => Boolean(version),
      ).length,
    });

    return TaskResponseDto.success(AgentTaskMode.BUILD, {
      content: {
        deliverables: [deliverable],
        versions: versions.filter(
          (version: any): version is DeliverableVersionData => Boolean(version),
        ),
      },
      metadata,
    });
  } catch (error) {
    return handleError(AgentTaskMode.BUILD, error);
  }
}

/**
 * Handles BUILD edit action by creating a new deliverable version.
 * @param definition - Agent definition context
 * @param request - Incoming task request payload
 * @param organizationSlug - Optional organization identifier
 * @param services - Supporting service dependencies
 * @returns A task response describing the updated deliverable
 */
export async function handleBuildEdit(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: BuildHandlerDependencies,
): Promise<TaskResponseDto> {
  void organizationSlug;
  void services.plansService;
  void services.llmService;
  void services.conversationsService;

  try {
    const payload = (request.payload ?? {}) as Partial<BuildEditPayload>;
    if (!payload.editedContent) {
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        'editedContent is required to edit a deliverable',
      );
    }

    const { userId, executionContext } = buildBuildActionContext(
      definition,
      request,
    );

    const normalizedContent =
      typeof payload.editedContent === 'string'
        ? payload.editedContent
        : JSON.stringify(payload.editedContent, null, 2);

    validateDeliverableStructure(
      normalizedContent,
      definition.deliverableStructure ?? null,
    );

    const ioSchemaOutput =
      (typeof definition.ioSchema === 'object' &&
        definition.ioSchema?.output) ??
      definition.ioSchema ??
      null;

    validateDeliverableSchema(normalizedContent, ioSchemaOutput);

    const metadataPayload = {
      comment: payload.comment,
      deliverableMetadata: buildDeliverableMetadata(normalizedContent),
      deliverableStructureApplied: Boolean(definition.deliverableStructure),
      ioSchemaApplied: Boolean(ioSchemaOutput),
    };

    const editResult = await services.deliverablesService.executeAction(
      'edit',
      {
        content: normalizedContent,
        metadata: metadataPayload,
      },
      executionContext,
    );

    if (!editResult.success || !editResult.data) {
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        editResult.error?.message ?? 'Failed to edit deliverable',
      );
    }

    const metadata = buildResponseMetadata(EMPTY_BUILD_METADATA, {
      deliverableMetadata: buildDeliverableMetadata(
        editResult.data.version?.content ?? '',
      ),
      source: 'manual-edit',
    });

    return TaskResponseDto.success(AgentTaskMode.BUILD, {
      content: {
        deliverable: serializeDeliverable(
          editResult.data.deliverable,
          definition,
          userId,
        ),
        version:
          serializeDeliverableVersion(editResult.data.version) ?? undefined,
      },
      metadata,
    });
  } catch (error) {
    return handleError(AgentTaskMode.BUILD, error);
  }
}

/**
 * Handles BUILD rerun action by regenerating a deliverable.
 * @param definition - Agent definition context
 * @param request - Incoming task request payload
 * @param organizationSlug - Optional organization identifier
 * @param services - Supporting service dependencies
 * @param executeBuild - Runner-provided build execution callback
 * @returns A task response containing regenerated deliverable data
 */
export async function handleBuildRerun(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: BuildHandlerDependencies,
  executeBuild: ExecuteBuildFn,
): Promise<TaskResponseDto> {
  void organizationSlug;
  void services.plansService;
  void services.llmService;
  void services.conversationsService;

  try {
    const payload = (request.payload ?? {}) as unknown as BuildRerunPayload;
    if (!payload.versionId || !payload.rerunConfig) {
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        'versionId and rerunConfig are required for rerun action',
      );
    }

    const { userId, conversationId, executionContext } =
      buildBuildActionContext(definition, request);

    const existingDeliverable = (await fetchExistingDeliverable(
      services.deliverablesService,
      request,
    )) as Record<string, any> | null;

    if (!existingDeliverable) {
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        'No deliverable found to rerun',
      );
    }

    const deliverableRecord = await services.deliverablesService.findOne(
      existingDeliverable.id as string,
      userId,
    );

    const listResult = await services.deliverablesService.executeAction(
      'list',
      {
        includeArchived: true,
      },
      executionContext,
    );

    if (!listResult.success || !listResult.data) {
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        listResult.error?.message ??
          'Unable to load deliverable versions for rerun',
      );
    }

    const versions = (listResult.data.versions ?? []) as any[];
    const sourceVersion = versions.find(
      (version) => version.id === payload.versionId,
    );

    if (!sourceVersion) {
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        `Deliverable version ${payload.versionId} not found`,
      );
    }

    const serializedDeliverable = serializeDeliverable(
      deliverableRecord,
      definition,
      userId,
    );

    const serializedVersion =
      serializeDeliverableVersion(sourceVersion) ?? undefined;

    const rerunPayload = {
      action: 'create' as const,
      title:
        (request.payload as any)?.title ??
        deliverableRecord.title ??
        'Deliverable',
      type:
        (request.payload as any)?.type ?? deliverableRecord.type ?? 'document',
      planVersionId: (request.payload as any)?.planVersionId,
      deliverableId: deliverableRecord.id,
      rerunConfig: payload.rerunConfig,
      rerunContext: {
        sourceVersion: serializedVersion,
        deliverable: serializedDeliverable,
      },
    };

    const rerunRequest: TaskRequestDto = {
      ...request,
      payload: rerunPayload as Record<string, any>,
      metadata: {
        ...(request.metadata ?? {}),
        buildRerun: {
          sourceVersionId: payload.versionId,
          rerunConfig: payload.rerunConfig,
        },
      },
    };

    const rerunResponse = await executeBuild(
      definition,
      rerunRequest,
      organizationSlug,
    );

    if (!rerunResponse.success) {
      return rerunResponse;
    }

    const metadata = buildResponseMetadata(
      rerunResponse.payload.metadata ?? {},
      {
        sourceVersionId: payload.versionId,
        rerunConfig: payload.rerunConfig,
        conversationId,
        origin: 'rerun',
      },
    );

    const content = {
      ...(rerunResponse.payload.content ?? {}),
      sourceVersionId: payload.versionId,
    };

    return TaskResponseDto.success(AgentTaskMode.BUILD, {
      content,
      metadata,
    });
  } catch (error) {
    return handleError(AgentTaskMode.BUILD, error);
  }
}

/**
 * Handles BUILD set_current action by updating the active deliverable version.
 * @param definition - Agent definition context
 * @param request - Incoming task request payload
 * @param organizationSlug - Optional organization identifier
 * @param services - Supporting service dependencies
 * @returns A task response confirming the update
 */
export async function handleBuildSetCurrent(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: BuildHandlerDependencies,
): Promise<TaskResponseDto> {
  void organizationSlug;
  void services.plansService;
  void services.llmService;
  void services.conversationsService;

  try {
    const payload = (request.payload ??
      {}) as unknown as BuildSetCurrentPayload;
    if (!payload.versionId) {
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        'versionId is required to set current deliverable version',
      );
    }

    const { userId, executionContext } = buildBuildActionContext(
      definition,
      request,
    );

    const result = await services.deliverablesService.executeAction(
      'set_current',
      {
        versionId: payload.versionId,
      },
      executionContext,
    );

    if (!result.success || !result.data) {
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        result.error?.message ?? 'Failed to set current deliverable version',
      );
    }

    const metadata = buildResponseMetadata(EMPTY_BUILD_METADATA, {
      deliverableMetadata: buildDeliverableMetadata(
        result.data.version?.content ?? '',
      ),
      updatedVersionId: payload.versionId,
    });

    return TaskResponseDto.success(AgentTaskMode.BUILD, {
      content: {
        deliverable: serializeDeliverable(
          result.data.deliverable,
          definition,
          userId,
        ),
        version: serializeDeliverableVersion(result.data.version) ?? undefined,
      },
      metadata,
    });
  } catch (error) {
    return handleError(AgentTaskMode.BUILD, error);
  }
}

/**
 * Handles BUILD delete_version action by removing a specific deliverable version.
 * @param definition - Agent definition context
 * @param request - Incoming task request payload
 * @param organizationSlug - Optional organization identifier
 * @param services - Supporting service dependencies
 * @returns A task response confirming version deletion
 */
export async function handleBuildDeleteVersion(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: BuildHandlerDependencies,
): Promise<TaskResponseDto> {
  void organizationSlug;
  void services.plansService;
  void services.llmService;
  void services.conversationsService;

  try {
    const payload = (request.payload ??
      {}) as unknown as BuildDeleteVersionPayload;
    if (!payload.versionId) {
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        'versionId is required to delete a deliverable version',
      );
    }

    const { userId, executionContext } = buildBuildActionContext(
      definition,
      request,
    );

    const deleteResult = await services.deliverablesService.executeAction(
      'delete_version',
      {
        versionId: payload.versionId,
      },
      executionContext,
    );

    if (!deleteResult.success || !deleteResult.data) {
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        deleteResult.error?.message ?? 'Failed to delete deliverable version',
      );
    }

    const deliverable = serializeDeliverable(
      deleteResult.data.deliverable,
      definition,
      userId,
    );

    const remainingVersions = (deleteResult.data.remainingVersions ?? []).map(
      (version: any) => serializeDeliverableVersion(version),
    );

    const metadata = buildResponseMetadata(EMPTY_BUILD_METADATA, {
      deletedVersionId: payload.versionId,
      remainingVersionCount: remainingVersions.filter(
        (version: any): version is DeliverableVersionData => Boolean(version),
      ).length,
    });

    return TaskResponseDto.success(AgentTaskMode.BUILD, {
      content: {
        deleted: true,
        deliverableId: deliverable.id,
        versionId: payload.versionId,
        remainingVersions: remainingVersions.filter(
          (version: any): version is DeliverableVersionData => Boolean(version),
        ),
      },
      metadata,
    });
  } catch (error) {
    return handleError(AgentTaskMode.BUILD, error);
  }
}

/**
 * Handles BUILD merge_versions action by combining multiple deliverable versions.
 * @param definition - Agent definition context
 * @param request - Incoming task request payload
 * @param organizationSlug - Optional organization identifier
 * @param services - Supporting service dependencies
 * @param executeBuild - Runner-provided build execution callback
 * @returns A task response describing the merged deliverable
 */
export async function handleBuildMergeVersions(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: BuildHandlerDependencies,
  executeBuild: ExecuteBuildFn,
): Promise<TaskResponseDto> {
  void organizationSlug;
  void services.plansService;
  void services.llmService;
  void services.conversationsService;

  try {
    const payload = (request.payload ??
      {}) as unknown as BuildMergeVersionsPayload;
    if (!payload.versionIds || payload.versionIds.length < 2) {
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        'At least two versionIds are required to merge versions',
      );
    }

    if (!payload.mergePrompt || payload.mergePrompt.trim().length === 0) {
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        'mergePrompt is required to merge versions',
      );
    }

    const { userId, conversationId, executionContext } =
      buildBuildActionContext(definition, request);

    const existingDeliverable = (await fetchExistingDeliverable(
      services.deliverablesService,
      request,
    )) as Record<string, any> | null;

    if (!existingDeliverable) {
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        'No deliverable found to merge',
      );
    }

    const deliverableRecord = await services.deliverablesService.findOne(
      existingDeliverable.id as string,
      userId,
    );

    const listResult = await services.deliverablesService.executeAction(
      'list',
      {
        includeArchived: true,
      },
      executionContext,
    );

    if (!listResult.success || !listResult.data) {
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        listResult.error?.message ??
          'Unable to load deliverable versions for merging',
      );
    }

    const versions = (listResult.data.versions ?? []) as any[];
    const sourceVersions = payload.versionIds
      .map((versionId) => versions.find((version) => version.id === versionId))
      .filter((version): version is Record<string, any> => Boolean(version));

    if (sourceVersions.length !== payload.versionIds.length) {
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        'One or more versions could not be found for merging',
      );
    }

    const serializedDeliverable = serializeDeliverable(
      deliverableRecord,
      definition,
      userId,
    );

    const serializedVersions = sourceVersions
      .map((version) => serializeDeliverableVersion(version))
      .filter((version): version is DeliverableVersionData => Boolean(version));

    const mergePayload = {
      action: 'create' as const,
      title:
        (request.payload as any)?.title ??
        deliverableRecord.title ??
        'Deliverable',
      type:
        (request.payload as any)?.type ?? deliverableRecord.type ?? 'document',
      planVersionId: (request.payload as any)?.planVersionId,
      deliverableId: deliverableRecord.id,
      mergeContext: {
        versionIds: payload.versionIds,
        mergePrompt: payload.mergePrompt,
        sourceVersions: serializedVersions,
        deliverable: serializedDeliverable,
      },
    };

    const mergeRequest: TaskRequestDto = {
      ...request,
      payload: mergePayload as Record<string, any>,
      metadata: {
        ...(request.metadata ?? {}),
        buildMerge: {
          versionIds: payload.versionIds,
          mergePrompt: payload.mergePrompt,
        },
      },
    };

    const mergeResponse = await executeBuild(
      definition,
      mergeRequest,
      organizationSlug,
    );

    if (!mergeResponse.success) {
      return mergeResponse;
    }

    const metadata = buildResponseMetadata(
      mergeResponse.payload.metadata ?? {},
      {
        sourceVersionIds: payload.versionIds,
        mergePrompt: payload.mergePrompt,
        conversationId,
        origin: 'merge',
      },
    );

    const content = {
      ...(mergeResponse.payload.content ?? {}),
      sourceVersionIds: payload.versionIds,
    };

    return TaskResponseDto.success(AgentTaskMode.BUILD, {
      content,
      metadata,
    });
  } catch (error) {
    return handleError(AgentTaskMode.BUILD, error);
  }
}

/**
 * Handles BUILD copy_version action by duplicating a deliverable version.
 * @param definition - Agent definition context
 * @param request - Incoming task request payload
 * @param organizationSlug - Optional organization identifier
 * @param services - Supporting service dependencies
 * @returns A task response containing copied deliverable data
 */
export async function handleBuildCopyVersion(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: BuildHandlerDependencies,
): Promise<TaskResponseDto> {
  void organizationSlug;
  void services.plansService;
  void services.llmService;
  void services.conversationsService;

  try {
    const payload = (request.payload ??
      {}) as unknown as BuildCopyVersionPayload;
    if (!payload.versionId) {
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        'versionId is required to copy a deliverable version',
      );
    }

    const { userId, executionContext } = buildBuildActionContext(
      definition,
      request,
    );

    const copyResult = await services.deliverablesService.executeAction(
      'copy_version',
      {
        versionId: payload.versionId,
      },
      executionContext,
    );

    if (!copyResult.success || !copyResult.data) {
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        copyResult.error?.message ?? 'Failed to copy deliverable version',
      );
    }

    const metadata = buildResponseMetadata(EMPTY_BUILD_METADATA, {
      sourceVersionId: payload.versionId,
      copiedVersionId: copyResult.data.copiedVersion?.id,
    });

    const targetDeliverable =
      copyResult.data.targetDeliverable ??
      copyResult.data.sourceDeliverable ??
      copyResult.data.deliverable ??
      {};

    return TaskResponseDto.success(AgentTaskMode.BUILD, {
      content: {
        deliverable: serializeDeliverable(
          targetDeliverable,
          definition,
          userId,
        ),
        version:
          serializeDeliverableVersion(copyResult.data.copiedVersion) ??
          undefined,
        sourceVersion:
          serializeDeliverableVersion(copyResult.data.sourceVersion) ??
          undefined,
      },
      metadata,
    });
  } catch (error) {
    return handleError(AgentTaskMode.BUILD, error);
  }
}

/**
 * Handles BUILD delete action by removing an entire deliverable.
 * @param definition - Agent definition context
 * @param request - Incoming task request payload
 * @param organizationSlug - Optional organization identifier
 * @param services - Supporting service dependencies
 * @returns A task response confirming deliverable deletion
 */
export async function handleBuildDelete(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: BuildHandlerDependencies,
): Promise<TaskResponseDto> {
  void organizationSlug;
  void services.plansService;
  void services.llmService;
  void services.conversationsService;

  try {
    const payload = (request.payload ?? {}) as unknown as BuildDeletePayload;
    void payload;

    const { userId, executionContext } = buildBuildActionContext(
      definition,
      request,
    );

    const deleteResult = await services.deliverablesService.executeAction(
      'delete',
      {},
      executionContext,
    );

    if (!deleteResult.success || !deleteResult.data) {
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        deleteResult.error?.message ?? 'Failed to delete deliverable',
      );
    }

    const deletedDeliverableId =
      deleteResult.data.deletedDeliverableId ??
      deleteResult.data.deletedPlanId ??
      '';

    const metadata = buildResponseMetadata(EMPTY_BUILD_METADATA, {
      deletedDeliverableId,
      deletedVersionCount: deleteResult.data.deletedVersionCount ?? 0,
    });

    return TaskResponseDto.success(AgentTaskMode.BUILD, {
      content: {
        deleted: true,
        deliverableId: deletedDeliverableId,
        deletedVersionCount: deleteResult.data.deletedVersionCount ?? 0,
        userId,
      },
      metadata,
    });
  } catch (error) {
    return handleError(AgentTaskMode.BUILD, error);
  }
}

/**
 * Validates deliverable content against the configured structure.
 * @param deliverableContent - Generated deliverable payload
 * @param deliverableStructure - Expected structure definition
 */
export function validateDeliverableStructure(
  deliverableContent: unknown,
  deliverableStructure: unknown,
): void {
  if (!deliverableStructure) {
    return;
  }

  const schema =
    typeof deliverableStructure === 'string'
      ? parseJsonSafely(
          deliverableStructure,
          'deliverable_structure must be valid JSON',
        )
      : deliverableStructure;

  const ajv = new Ajv({
    allErrors: true,
    strict: false,
    allowUnionTypes: true,
  });

  const validate = ajv.compile(schema as Record<string, unknown>);
  const candidate = coerceDeliverableContent(deliverableContent);

  if (!validate(candidate)) {
    const message = ajv.errorsText(validate.errors, { separator: '; ' });
    const error = new Error(
      `Deliverable does not conform to agent structure: ${message}`,
    );
    (error as any).details = validate.errors;
    throw error;
  }
}

/**
 * Validates deliverable content against an IO schema definition.
 * @param deliverableContent - Generated deliverable payload
 * @param ioSchema - IO schema definition
 */
export function validateDeliverableSchema(
  deliverableContent: unknown,
  ioSchema: unknown,
): void {
  if (!ioSchema) {
    return;
  }

  const schema =
    typeof ioSchema === 'string'
      ? parseJsonSafely(ioSchema, 'io_schema output must be valid JSON')
      : ioSchema;

  const ajv = new Ajv({
    allErrors: true,
    strict: false,
    allowUnionTypes: true,
  });

  const validate = ajv.compile(schema as Record<string, unknown>);

  // For io_schema validation, we need the ORIGINAL wrapped format (not unwrapped)
  // So parse the string but don't unwrap
  let candidate = deliverableContent;
  if (typeof deliverableContent === 'string') {
    const extracted = extractCodeFenceContent(deliverableContent.trim());
    const parsed = tryParseJson(extracted);
    candidate = parsed !== null ? parsed : extracted;
  }

  console.log(
    '[validateDeliverableSchema] Validating io_schema with wrapped format',
  );

  if (!validate(candidate)) {
    const message = ajv.errorsText(validate.errors, { separator: '; ' });
    const error = new Error(
      `Deliverable output does not conform to io_schema: ${message}`,
    );
    (error as any).details = validate.errors;
    throw error;
  }
}

/**
 * Prepares metadata associated with BUILD responses.
 * @param deliverableContent - Generated deliverable payload
 * @returns Metadata describing the deliverable
 */
export function buildDeliverableMetadata(
  deliverableContent: unknown,
): Record<string, unknown> {
  if (deliverableContent === null || deliverableContent === undefined) {
    return { hasContent: false };
  }

  if (typeof deliverableContent === 'string') {
    const trimmed = deliverableContent.trim();
    const metadata: Record<string, unknown> = {
      format: 'text',
      contentLength: trimmed.length,
      lineCount: trimmed.split(/\r?\n/).length,
    };

    if (trimmed.length > 0) {
      metadata.preview = trimmed.slice(0, 200);
    }

    const parsed = tryParseJson(trimmed);
    if (parsed !== null) {
      const keys = Object.keys(parsed as Record<string, unknown>);
      metadata.format = Array.isArray(parsed) ? 'array' : 'json';
      metadata.keyCount = keys.length;
      if (keys.length > 0) {
        metadata.topLevelKeys = keys.slice(0, 10);
      }
    }

    return metadata;
  }

  if (Array.isArray(deliverableContent)) {
    return {
      format: 'array',
      length: deliverableContent.length,
      hasContent: deliverableContent.length > 0,
    };
  }

  if (typeof deliverableContent === 'object') {
    const keys = Object.keys(deliverableContent as Record<string, unknown>);
    return {
      format: 'object',
      keyCount: keys.length,
      topLevelKeys: keys.slice(0, 10),
    };
  }

  return {
    format: typeof deliverableContent,
  };
}

const EMPTY_USAGE = {
  inputTokens: 0 as number,
  outputTokens: 0 as number,
  totalTokens: 0 as number,
  cost: 0 as number,
};

const EMPTY_BUILD_METADATA = {
  provider: '',
  model: '',
  usage: EMPTY_USAGE,
};

function buildBuildActionContext(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
): {
  userId: string;
  conversationId: string;
  taskId?: string;
  executionContext: {
    conversationId: string;
    userId: string;
    agentSlug: string;
    taskId?: string;
    metadata: JsonObject;
  };
} {
  const userId = resolveUserId(request);
  if (!userId) {
    throw new Error('Unable to determine user identity for build operation');
  }

  const conversationId = resolveConversationId(request);
  if (!conversationId) {
    throw new Error('Missing conversationId for build operation');
  }
  request.conversationId = conversationId;

  const taskId = resolveTaskId(request) ?? undefined;

  return {
    userId,
    conversationId,
    taskId,
    executionContext: {
      conversationId,
      userId,
      agentSlug: definition.slug,
      taskId,
      metadata: sanitizeMetadata(request.metadata),
    },
  };
}

function sanitizeMetadata(
  value: Record<string, unknown> | undefined,
): JsonObject {
  if (!value) {
    return {};
  }

  const jsonValue = toJsonValue(value);
  return isJsonObject(jsonValue) ? jsonValue : {};
}

function toJsonValue(value: unknown): JsonValue | undefined {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    const mapped = value
      .map((entry) => toJsonValue(entry))
      .filter((entry): entry is JsonValue => entry !== undefined);
    return mapped as JsonValue;
  }

  if (typeof value === 'object') {
    const result: JsonObject = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
      const jsonEntry = toJsonValue(entry);
      if (jsonEntry !== undefined) {
        result[key] = jsonEntry;
      }
    });
    return result;
  }

  return undefined;
}

function serializeDeliverable(
  deliverable: any,
  definition: AgentRuntimeDefinition,
  fallbackUserId: string,
): DeliverableData {
  const createdAt = toIsoString(
    deliverable.createdAt ?? deliverable.created_at ?? new Date().toISOString(),
  );
  const updatedAt = toIsoString(
    deliverable.updatedAt ?? deliverable.updated_at ?? createdAt,
  );

  const userId = deliverable.userId ?? deliverable.user_id ?? fallbackUserId;

  const namespace =
    deliverable.namespace ??
    definition.organizationSlug ??
    definition.context?.namespace ??
    'global';

  const currentVersionId =
    deliverable.currentVersionId ??
    deliverable.current_version_id ??
    deliverable.currentVersion?.id ??
    '';

  return {
    id: deliverable.id,
    conversationId:
      deliverable.conversationId ?? deliverable.conversation_id ?? '',
    userId,
    agentName:
      deliverable.agentName ??
      deliverable.agent_name ??
      definition.displayName ??
      definition.slug,
    namespace,
    title: deliverable.title ?? 'Deliverable',
    type: deliverable.type ?? deliverable.deliverableType ?? 'document',
    currentVersionId,
    createdAt,
    updatedAt,
  };
}

function serializeDeliverableVersion(
  version: any,
): DeliverableVersionData | null {
  if (!version) {
    return null;
  }

  const formatRaw = version.format ?? version.deliverableFormat ?? 'markdown';
  const normalizedFormat =
    typeof formatRaw === 'string'
      ? normalizeDeliverableFormat(formatRaw)
      : 'markdown';

  return {
    id: version.id,
    deliverableId: version.deliverableId ?? version.deliverable_id ?? '',
    versionNumber: numberOrZero(
      version.versionNumber ?? version.version_number ?? 1,
      1,
    ),
    content: version.content ?? '',
    format: normalizedFormat,
    createdByType: version.createdByType ?? version.created_by_type ?? 'agent',
    createdById: version.createdById ?? version.created_by_id ?? null,
    metadata: version.metadata ?? undefined,
    isCurrentVersion: Boolean(
      version.isCurrentVersion ?? version.is_current_version,
    ),
    createdAt: toIsoString(version.createdAt ?? version.created_at),
  };
}

function normalizeDeliverableFormat(
  format: string,
): 'markdown' | 'json' | 'html' {
  const normalized = format.toLowerCase();
  if (normalized.includes('json')) {
    return 'json';
  }
  if (normalized === 'html' || normalized.includes('html')) {
    return 'html';
  }
  return 'markdown';
}

function coerceDeliverableContent(content: unknown): unknown {
  console.log('[coerceDeliverableContent] Input type:', typeof content);
  if (typeof content === 'string') {
    console.log('[coerceDeliverableContent] Content length:', content.length);
    console.log(
      '[coerceDeliverableContent] First 300 chars:',
      content.substring(0, 300),
    );
    console.log(
      '[coerceDeliverableContent] Last 300 chars:',
      content.substring(Math.max(0, content.length - 300)),
    );
  } else {
    console.log(
      '[coerceDeliverableContent] Input value:',
      JSON.stringify(content).substring(0, 200),
    );
  }

  if (typeof content === 'string') {
    const candidate = extractCodeFenceContent(content.trim());
    const parsed = tryParseJson(candidate);
    console.log('[coerceDeliverableContent] After parsing:', {
      hadCodeFence: candidate !== content.trim(),
      parsedSuccessfully: parsed !== null,
      parsedType: parsed !== null ? typeof parsed : 'null',
    });

    // If parsed successfully, check if it's wrapped in io_schema output format
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
    ) {
      // Check for common io_schema output wrappers and extract the actual deliverable
      if ('blog_post' in parsed) {
        console.log(
          '[coerceDeliverableContent] Unwrapping blog_post from io_schema output format',
        );
        return parsed.blog_post;
      }
      if ('deliverable' in parsed) {
        console.log(
          '[coerceDeliverableContent] Unwrapping deliverable from io_schema output format',
        );
        return parsed.deliverable;
      }
      if ('data' in parsed) {
        console.log(
          '[coerceDeliverableContent] Unwrapping data from io_schema output format',
        );
        return parsed.data;
      }
    }

    return parsed !== null ? parsed : candidate;
  }

  if (Array.isArray(content)) {
    return content;
  }

  if (content && typeof content === 'object') {
    // Check if this is an io_schema wrapped object
    const obj = content as any;
    if ('blog_post' in obj) {
      console.log(
        '[coerceDeliverableContent] Unwrapping blog_post from object',
      );
      return obj.blog_post;
    }
    if ('deliverable' in obj) {
      console.log(
        '[coerceDeliverableContent] Unwrapping deliverable from object',
      );
      return obj.deliverable;
    }
    if ('data' in obj) {
      console.log('[coerceDeliverableContent] Unwrapping data from object');
      return obj.data;
    }
    return content;
  }

  return content ?? '';
}

function tryParseJson(value: string): any {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  // First try: parse the entire string if it starts with JSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Fall through to search for JSON within the string
    }
  }

  // Second try: search for JSON within the string (for models that output thinking text first)
  // Look for the first occurrence of { or [ and try to parse from there
  const jsonStartIndex = Math.min(
    trimmed.indexOf('{') >= 0 ? trimmed.indexOf('{') : Infinity,
    trimmed.indexOf('[') >= 0 ? trimmed.indexOf('[') : Infinity,
  );

  if (jsonStartIndex !== Infinity && jsonStartIndex > 0) {
    const possibleJson = trimmed.substring(jsonStartIndex);
    try {
      return JSON.parse(possibleJson);
    } catch {
      // Fall through to original parsing attempt
    }
  }

  // Original parsing attempt (will fail but we tried)
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function extractCodeFenceContent(value: string): string {
  const fencedMatch = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch && fencedMatch[1]) {
    return fencedMatch[1].trim();
  }
  return value;
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return new Date().toISOString();
}

function numberOrZero(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function parseJsonSafely(value: string, errorMessage: string): any {
  try {
    return JSON.parse(value);
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : 'Unable to parse JSON';
    throw new Error(`${errorMessage}: ${reason}`);
  }
}
