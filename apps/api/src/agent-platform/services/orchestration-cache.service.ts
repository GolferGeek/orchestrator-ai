import { Injectable, Logger } from '@nestjs/common';
import QuickLRU = require('quick-lru');
import { createHash } from 'crypto';
import { OrchestrationResolvedDefinition } from '../types/orchestration-definition.types';
import { OrchestrationRunRecord } from '../interfaces/orchestration-run-record.interface';
import { OrchestrationStepRecord } from '../interfaces/orchestration-step-record.interface';

const DEFAULT_DEFINITION_TTL_MS = 5 * 60 * 1000;
const MAX_DEFINITION_CACHE_SIZE = 200;
const MAX_STEP_OUTPUT_CACHE_SIZE = 2000;
const DEFAULT_STEP_OUTPUT_TTL_SECONDS = 600;
const MAX_STEP_OUTPUT_TTL_SECONDS = 24 * 60 * 60;

export interface DefinitionCacheKey {
  ownerAgentSlug: string;
  organizationSlug: string;
  name: string;
  version?: string | null;
}

export interface StepOutputCacheKey {
  key: string;
  fingerprint: string;
  definitionKey: string;
  organizationSlug: string | null;
  stepId: string;
}

export interface StepOutputCachePayload {
  output: Record<string, any> | null;
  deliverableId?: string | null;
  metadata: Record<string, any>;
  sourceRunId: string;
  sourceStepId: string;
  conversationId?: string | null;
}

export interface StepOutputCacheHit {
  key: string;
  fingerprint: string;
  storedAt: number;
  expiresAt?: number;
  payload: StepOutputCachePayload;
}

interface DefinitionCacheEntry {
  record: OrchestrationResolvedDefinition;
  expiresAt?: number;
  recordId?: string | null;
}

interface StepOutputCacheEntry {
  key: string;
  fingerprint: string;
  definitionKey: string;
  organizationSlug: string | null;
  stepId: string;
  payload: StepOutputCachePayload;
  createdAt: number;
  expiresAt?: number;
}

@Injectable()
export class OrchestrationCacheService {
  private readonly logger = new Logger(OrchestrationCacheService.name);
  private readonly definitionCache = new QuickLRU<string, DefinitionCacheEntry>(
    {
      maxSize: MAX_DEFINITION_CACHE_SIZE,
    },
  );
  private readonly definitionKeysByRecord = new Map<string, Set<string>>();
  private readonly stepOutputCache =
    new QuickLRU<string, StepOutputCacheEntry>({
      maxSize: MAX_STEP_OUTPUT_CACHE_SIZE,
    });

  getDefinition(
    key: DefinitionCacheKey,
  ): OrchestrationResolvedDefinition | null {
    const cacheKey = this.buildDefinitionKey(key);
    const entry = this.definitionCache.get(cacheKey);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.definitionCache.delete(cacheKey);
      if (entry.recordId) {
        this.removeDefinitionKey(entry.recordId, cacheKey);
      }
      return null;
    }

    return entry.record;
  }

  setDefinition(
    key: DefinitionCacheKey,
    definition: OrchestrationResolvedDefinition,
    ttlMs: number = DEFAULT_DEFINITION_TTL_MS,
  ): void {
    const cacheKey = this.buildDefinitionKey(key);
    const expiresAt =
      ttlMs && Number.isFinite(ttlMs) ? Date.now() + Math.max(ttlMs, 0) : undefined;

    this.definitionCache.set(cacheKey, {
      record: definition,
      expiresAt,
      recordId: definition.recordId ?? null,
    });

    if (definition.recordId) {
      this.trackDefinitionKey(definition.recordId, cacheKey);
    }
  }

  invalidateDefinition(key: DefinitionCacheKey): void {
    const cacheKey = this.buildDefinitionKey(key);
    const entry = this.definitionCache.get(cacheKey);
    this.definitionCache.delete(cacheKey);
    if (entry?.recordId) {
      this.removeDefinitionKey(entry.recordId, cacheKey);
    }
  }

  invalidateDefinitionByRecordId(recordId: string | null | undefined): void {
    if (!recordId) {
      return;
    }
    const keys = this.definitionKeysByRecord.get(recordId);
    if (!keys) {
      return;
    }
    keys.forEach((key) => this.definitionCache.delete(key));
    this.definitionKeysByRecord.delete(recordId);
  }

  buildStepOutputKey(params: {
    run: OrchestrationRunRecord;
    step: OrchestrationStepRecord;
    input: Record<string, any>;
  }): StepOutputCacheKey {
    const definitionKey = this.deriveDefinitionKey(params.run);
    const organizationSlug = params.run.organization_slug ?? null;
    const stepId = this.resolveStepKey(params.step);
    const fingerprint = this.computeFingerprint(params.input);

    return {
      key: `${definitionKey}|${organizationSlug ?? 'global'}|${stepId}|${fingerprint}`,
      fingerprint,
      definitionKey,
      organizationSlug,
      stepId,
    };
  }

  getStepOutput(key: string): StepOutputCacheHit | null {
    const entry = this.stepOutputCache.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.stepOutputCache.delete(key);
      return null;
    }

    return {
      key: entry.key,
      fingerprint: entry.fingerprint,
      storedAt: entry.createdAt,
      expiresAt: entry.expiresAt,
      payload: this.clonePayload(entry.payload),
    };
  }

  setStepOutput(
    key: StepOutputCacheKey,
    payload: StepOutputCachePayload,
    ttlSeconds: number | null | undefined,
  ): void {
    const normalizedTtl = this.normalizeTtlSeconds(ttlSeconds);
    const expiresAt =
      normalizedTtl !== null ? Date.now() + normalizedTtl * 1000 : undefined;

    const entry: StepOutputCacheEntry = {
      key: key.key,
      fingerprint: key.fingerprint,
      definitionKey: key.definitionKey,
      organizationSlug: key.organizationSlug,
      stepId: key.stepId,
      payload: this.clonePayload(payload),
      createdAt: Date.now(),
      expiresAt,
    };

    this.stepOutputCache.set(key.key, entry);
  }

  updateStepOutputMetadata(
    key: StepOutputCacheKey,
    existing: StepOutputCacheHit,
    updatedPayload: StepOutputCachePayload,
  ): void {
    const entry: StepOutputCacheEntry = {
      key: key.key,
      fingerprint: key.fingerprint,
      definitionKey: key.definitionKey,
      organizationSlug: key.organizationSlug,
      stepId: key.stepId,
      payload: this.clonePayload(updatedPayload),
      createdAt: existing.storedAt,
      expiresAt: existing.expiresAt,
    };

    this.stepOutputCache.set(key.key, entry);
  }

  private buildDefinitionKey(key: DefinitionCacheKey): string {
    const owner = key.ownerAgentSlug ?? 'unknown-owner';
    const org = key.organizationSlug ?? 'global';
    const version =
      key.version && key.version.length > 0 ? key.version : 'latest';
    return `def:${owner}:${org}:${key.name}:${version}`;
  }

  private deriveDefinitionKey(run: OrchestrationRunRecord): string {
    if (run.orchestration_definition_id) {
      return `id:${run.orchestration_definition_id}`;
    }

    const metadata = this.asRecord(run.metadata);
    const plan = this.asRecord(metadata?.plan);
    const agentMeta = this.asRecord(metadata?.agent);

    const owner =
      (agentMeta?.slug as string | undefined) ??
      run.orchestration_slug ??
      run.orchestration_name ??
      'unknown';
    const name =
      (plan?.name as string | undefined) ??
      run.orchestration_name ??
      'ad_hoc';
    const version =
      (plan?.version as string | undefined) ??
      metadata?.definitionVersion ??
      'latest';

    return `name:${owner}:${name}:${version}`;
  }

  private resolveStepKey(step: OrchestrationStepRecord): string {
    if (step.step_id) {
      return step.step_id;
    }
    return `index_${step.step_index}`;
  }

  private computeFingerprint(input: Record<string, any>): string {
    const serialized = this.stableSerialize(input);
    return createHash('sha256').update(serialized).digest('hex');
  }

  private stableSerialize(value: any): string {
    if (value === null || value === undefined) {
      return 'null';
    }

    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableSerialize(item)).join(',')}]`;
    }

    if (typeof value === 'object') {
      const entries = Object.keys(value)
        .sort()
        .map(
          (key) =>
            `${JSON.stringify(key)}:${this.stableSerialize((value as any)[key])}`,
        );
      return `{${entries.join(',')}}`;
    }

    if (typeof value === 'number' && !Number.isFinite(value)) {
      return JSON.stringify(String(value));
    }

    return JSON.stringify(value);
  }

  private clonePayload(
    payload: StepOutputCachePayload,
  ): StepOutputCachePayload {
    return {
      output: this.cloneValue(payload.output),
      deliverableId: payload.deliverableId ?? null,
      metadata: this.cloneValue(payload.metadata ?? {}),
      sourceRunId: payload.sourceRunId,
      sourceStepId: payload.sourceStepId,
      conversationId: payload.conversationId ?? null,
    };
  }

  private cloneValue<T>(value: T): T {
    if (value === null || value === undefined) {
      return value;
    }
    if (typeof value === 'object') {
      try {
        return JSON.parse(JSON.stringify(value));
      } catch (_error) {
        return value;
      }
    }
    return value;
  }

  private trackDefinitionKey(recordId: string, key: string): void {
    const existing = this.definitionKeysByRecord.get(recordId);
    if (existing) {
      existing.add(key);
      return;
    }
    this.definitionKeysByRecord.set(recordId, new Set([key]));
  }

  private removeDefinitionKey(recordId: string, key: string): void {
    const existing = this.definitionKeysByRecord.get(recordId);
    if (!existing) {
      return;
    }
    existing.delete(key);
    if (existing.size === 0) {
      this.definitionKeysByRecord.delete(recordId);
    }
  }

  private normalizeTtlSeconds(
    ttlSeconds: number | null | undefined,
  ): number | null {
    if (ttlSeconds === null || ttlSeconds === undefined) {
      return DEFAULT_STEP_OUTPUT_TTL_SECONDS;
    }
    const parsed = Number(ttlSeconds);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    return Math.min(
      MAX_STEP_OUTPUT_TTL_SECONDS,
      Math.max(1, Math.floor(parsed)),
    );
  }

  private asRecord(value: unknown): Record<string, any> | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    return { ...(value as Record<string, any>) };
  }
}
