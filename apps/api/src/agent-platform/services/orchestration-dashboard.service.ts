import { Injectable, Logger } from '@nestjs/common';
import {
  OrchestrationRunsRepository,
  OrchestrationRunListOptions,
} from '../repositories/orchestration-runs.repository';
import {
  HumanApprovalsRepository,
  HumanApprovalRecord,
  HumanApprovalListOptions,
} from '../repositories/human-approvals.repository';
import { OrchestrationEventsService } from './orchestration-events.service';
import { OrchestrationStatusService } from './orchestration-status.service';
import { OrchestrationRunnerService } from './orchestration-runner.service';
import {
  OrchestrationCheckpointDecision,
  OrchestrationCheckpointService,
} from './orchestration-checkpoint.service';
import { OrchestrationDefinitionService } from './orchestration-definition.service';
import { OrchestrationRunRecord } from '../interfaces/orchestration-run-record.interface';
import {
  OrchestrationApprovalListResult,
  OrchestrationApprovalListItem,
  OrchestrationApprovalView,
  OrchestrationDashboardListResult,
  OrchestrationReplayContext,
  OrchestrationRunDetail,
  OrchestrationRunSummary,
} from '../types/orchestration-dashboard.types';

export interface OrchestrationDashboardListOptions {
  organizationSlug?: string | null;
  lifecycle?: 'active' | 'completed' | 'all';
  search?: string;
  definitionId?: string | null;
  parentRunId?: string | null;
  limit?: number;
  offset?: number;
  startedAfter?: string;
  startedBefore?: string;
}

export interface OrchestrationApprovalQueryOptions {
  organizationSlug?: string | null;
  status?: 'pending' | 'approved' | 'rejected';
  statuses?: Array<'pending' | 'approved' | 'rejected'>;
  limit?: number;
  offset?: number;
  sortDirection?: 'asc' | 'desc';
}

export interface OrchestrationRunDetailOptions {
  approvalLimit?: number;
  childLimit?: number;
}

export interface ResolveOrchestrationApprovalOptions {
  approvalId: string;
  decision: OrchestrationCheckpointDecision;
  actorId?: string | null;
  notes?: string | null;
  modifications?: Record<string, any>;
}

@Injectable()
export class OrchestrationDashboardService {
  private readonly logger = new Logger(OrchestrationDashboardService.name);
  private readonly activeStatuses = [
    'pending',
    'planning',
    'running',
    'checkpoint',
  ];
  private readonly completedStatuses = [
    'completed',
    'failed',
    'cancelled',
    'canceled',
    'aborted',
  ];

  constructor(
    private readonly runsRepository: OrchestrationRunsRepository,
    private readonly approvalsRepository: HumanApprovalsRepository,
    private readonly events: OrchestrationEventsService,
    private readonly statusService: OrchestrationStatusService,
    private readonly runner: OrchestrationRunnerService,
    private readonly checkpointService: OrchestrationCheckpointService,
    private readonly definitionService: OrchestrationDefinitionService,
  ) {}

  async listRuns(
    options: OrchestrationDashboardListOptions = {},
  ): Promise<OrchestrationDashboardListResult> {
    const statuses = this.resolveLifecycleStatuses(options.lifecycle);

    const listOptions: OrchestrationRunListOptions = {
      organizationSlug: options.organizationSlug,
      statuses,
      definitionId: options.definitionId ?? undefined,
      parentRunId: options.parentRunId ?? undefined,
      search: options.search,
      limit: options.limit,
      offset: options.offset,
      startedAfter: options.startedAfter,
      startedBefore: options.startedBefore,
      sortBy: 'created_at',
      sortDirection: 'desc',
    };

    const { data, count, limit, offset } =
      await this.runsRepository.list(listOptions);

    const runIds = data.map((run) => run.id);
    const pendingCounts =
      await this.approvalsRepository.countPendingByRunIds(runIds);

    const items = data.map((run) =>
      this.buildRunSummary(run, pendingCounts[run.id] ?? 0),
    );

    const total = count ?? items.length;
    const hasMore =
      total !== null
        ? offset + items.length < total
        : items.length === limit;

    return {
      items,
      total,
      limit,
      offset,
      hasMore,
    };
  }

  async getRunDetail(
    runId: string,
    options: OrchestrationRunDetailOptions = {},
  ): Promise<OrchestrationRunDetail | null> {
    const [status, runRecord] = await Promise.all([
      this.statusService.getRunStatus(runId),
      this.runner.getRun(runId),
    ]);

    if (!status || !runRecord) {
      return null;
    }

    const childLimit = options.childLimit ?? 20;
    const childRuns = await this.runsRepository.list({
      parentRunId: runId,
      limit: childLimit,
      sortBy: 'created_at',
      sortDirection: 'desc',
    });
    const childPending =
      await this.approvalsRepository.countPendingByRunIds(
        childRuns.data.map((child) => child.id),
      );

    const childSummaries = childRuns.data.map((child) =>
      this.buildRunSummary(child, childPending[child.id] ?? 0),
    );

    let parentSummary: OrchestrationRunSummary | null = null;
    if (runRecord.parent_orchestration_run_id) {
      const parent =
        await this.runner.getRun(runRecord.parent_orchestration_run_id);
      if (parent) {
        const parentCounts =
          await this.approvalsRepository.countPendingByRunIds([parent.id]);
        parentSummary = this.buildRunSummary(
          parent,
          parentCounts[parent.id] ?? 0,
        );
      }
    }

    const approvals = await this.approvalsRepository.list({
      orchestrationRunId: runId,
      statuses: ['pending', 'approved', 'rejected'],
      limit: options.approvalLimit ?? 200,
      offset: 0,
      sortBy: 'created_at',
      sortDirection: 'desc',
    });

    const approvalViews = approvals.data.map((record) =>
      this.buildApprovalView(record),
    );

    return {
      run: status.run,
      steps: status.steps,
      currentStep: status.currentStep,
      summary: status.summary,
      pendingApprovals: status.pendingApprovals,
      approvals: {
        items: approvalViews,
        total: approvals.count ?? approvalViews.length,
      },
      relatedRuns: {
        parent: parentSummary,
        children: childSummaries,
      },
      metadata: {
        latestCheckpoint: this.extractLatestCheckpoint(runRecord),
      },
    };
  }

  async listApprovals(
    options: OrchestrationApprovalQueryOptions = {},
  ): Promise<OrchestrationApprovalListResult> {
    const repoOptions: HumanApprovalListOptions = {
      organizationSlug: options.organizationSlug,
      status: options.status,
      statuses: options.statuses,
      mode: 'orchestration_checkpoint',
      limit: options.limit,
      offset: options.offset,
      sortBy: 'created_at',
      sortDirection: options.sortDirection ?? 'desc',
    };

    const { data, count, limit, offset } =
      await this.approvalsRepository.list(repoOptions);

    const runIds = Array.from(
      new Set(
        data
          .map((record) => record.orchestration_run_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    const runs = runIds.length
      ? await this.runsRepository.listByIds(runIds)
      : [];

    const pendingCounts =
      await this.approvalsRepository.countPendingByRunIds(runIds);

    const runLookup = new Map(runs.map((run) => [run.id, run]));

    const items: OrchestrationApprovalListItem[] = data.map((record) => {
      const runId = record.orchestration_run_id;
      const runRecord = runId ? runLookup.get(runId) ?? null : null;
      return {
        approval: this.buildApprovalView(record),
        run:
          runRecord !== null
            ? this.buildRunSummary(
                runRecord,
                runId ? pendingCounts[runId] ?? 0 : 0,
              )
            : null,
      };
    });

    const total = count ?? items.length;
    const hasMore =
      total !== null
        ? offset + items.length < total
        : items.length === limit;

    return {
      items,
      total,
      limit,
      offset,
      hasMore,
    };
  }

  async resolveApproval(
    options: ResolveOrchestrationApprovalOptions,
  ): Promise<{
    approval: OrchestrationApprovalView;
    run: OrchestrationRunSummary;
  }> {
    const result = await this.checkpointService.resolveCheckpoint({
      approvalId: options.approvalId,
      decision: options.decision,
      actorId: options.actorId ?? null,
      notes: options.notes ?? null,
      modifications: options.modifications,
    });

    const pendingCounts =
      await this.approvalsRepository.countPendingByRunIds([
        result.run.id,
      ]);

    return {
      approval: this.buildApprovalView(result.approval),
      run: this.buildRunSummary(
        result.run,
        pendingCounts[result.run.id] ?? 0,
      ),
    };
  }

  async getReplayContext(
    runId: string,
  ): Promise<OrchestrationReplayContext | null> {
    const run = await this.runner.getRun(runId);
    if (!run) {
      return null;
    }

    const metadata = (run.metadata ?? {}) as Record<string, any>;
    const agentMetadata =
      (metadata.agent as Record<string, any> | undefined) ?? {};

    const definition =
      run.orchestration_definition_id !== null
        ? await this.definitionService.getDefinitionById(
            run.orchestration_definition_id,
          )
        : null;

    return {
      runId: run.id,
      organizationSlug: run.organization_slug ?? null,
      conversationId: run.conversation_id ?? null,
      definition: {
        id: run.orchestration_definition_id,
        name: definition?.name ?? run.orchestration_name ?? null,
        displayName: definition?.displayName ?? null,
        version: definition?.version ?? null,
        ownerAgentSlug: definition?.ownerAgentSlug ?? null,
      },
      agent: {
        id: this.asString(agentMetadata.id),
        slug: this.asString(agentMetadata.slug),
        displayName: this.asString(agentMetadata.displayName),
        type: this.asString(agentMetadata.type),
      },
      parameters: this.cloneRecord(run.parameters ?? {}),
      plan: this.cloneRecord(run.plan ?? {}),
      results: this.cloneRecord(run.results ?? {}),
      metadata: this.cloneRecord(metadata),
      origin: {
        type: run.origin_type ?? null,
        id: run.origin_id ?? null,
        slug: run.orchestration_slug ?? null,
      },
      timestamps: {
        createdAt: run.created_at,
        startedAt: run.started_at ?? null,
        completedAt: run.completed_at ?? null,
      },
    };
  }

  private resolveLifecycleStatuses(
    lifecycle: 'active' | 'completed' | 'all' | undefined,
  ): string[] | undefined {
    if (!lifecycle || lifecycle === 'all') {
      return undefined;
    }
    if (lifecycle === 'active') {
      return this.activeStatuses;
    }
    return this.completedStatuses;
  }

  private buildRunSummary(
    run: OrchestrationRunRecord,
    pendingApprovals: number,
  ): OrchestrationRunSummary {
    const snapshot = this.events.snapshotRun(run);
    return {
      id: snapshot.id,
      status: snapshot.status,
      name: snapshot.name,
      definitionId: snapshot.definitionId,
      planId: snapshot.planId,
      parentRunId: snapshot.parentRunId,
      organizationSlug: snapshot.organizationSlug,
      orchestrationSlug: run.orchestration_slug ?? null,
      originType: run.origin_type ?? null,
      originId: run.origin_id ?? null,
      agent: snapshot.agent,
      stats: snapshot.stats,
      timings: snapshot.timings,
      currentStepId: snapshot.currentStepId,
      currentStepIndex: snapshot.currentStepIndex,
      pendingApprovals,
      latestCheckpoint: this.extractLatestCheckpoint(run),
    };
  }

  private buildApprovalView(
    record: HumanApprovalRecord,
  ): OrchestrationApprovalView {
    const metadata = ((record.metadata ?? {}) as Record<string, any>) || null;
    const decision =
      (metadata?.decision as Record<string, any> | undefined) ?? undefined;

    return {
      id: record.id,
      status: record.status,
      mode: record.mode,
      runId: record.orchestration_run_id ?? null,
      stepId: record.orchestration_step_id ?? null,
      organizationSlug: record.organization_slug ?? null,
      agentSlug: record.agent_slug,
      conversationId: record.conversation_id ?? null,
      createdAt: record.created_at ?? null,
      updatedAt: record.updated_at ?? null,
      decisionAt:
        decision?.decidedAt ??
        decision?.decided_at ??
        record.decision_at ??
        null,
      decisionBy:
        decision?.decidedBy ??
        decision?.decided_by ??
        record.approved_by ??
        null,
      metadata,
    };
  }

  private extractLatestCheckpoint(
    run: OrchestrationRunRecord,
  ): OrchestrationRunSummary['latestCheckpoint'] {
    const metadata = (run.metadata ?? {}) as Record<string, any>;
    const checkpoint =
      (metadata.lastCheckpoint as Record<string, any> | undefined) ?? undefined;
    if (!checkpoint) {
      return null;
    }

    const step =
      (checkpoint.step as Record<string, any> | undefined) ?? undefined;

    return {
      approvalId: this.asString(checkpoint.approvalId),
      checkpointId: this.asString(checkpoint.checkpointId),
      requestedAt: this.asString(checkpoint.requestedAt),
      stepLabel: this.asString(step?.label),
    };
  }

  private asString(value: unknown): string | null {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
    return null;
  }

  private cloneRecord(source: Record<string, any>): Record<string, any> {
    try {
      return JSON.parse(JSON.stringify(source));
    } catch (_error) {
      return {};
    }
  }
}
