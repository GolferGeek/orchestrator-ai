import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentsRepository } from '../repositories/agents.repository';
import { AgentRecord } from '../interfaces/agent-record.interface';

interface CacheEntry {
  record: AgentRecord;
  expiresAt: number;
}

const _DEFAULT_CACHE_TTL_MS = 30_000;
const _MIN_CACHE_TTL_MS = 1_000;
const _MAX_CACHE_TTL_MS = 600_000;

@Injectable()
export class AgentRegistryService {
  private readonly logger = new Logger(AgentRegistryService.name);
  private readonly cache = new Map<string, Map<string, CacheEntry>>();
  private readonly cacheTtlMs: number;

  constructor(
    private readonly agentsRepository: AgentsRepository,
    private readonly configService: ConfigService,
  ) {
    this.cacheTtlMs = this.resolveTtl();
  }

  async getAgent(
    organizationSlug: string | null,
    agentSlug: string,
  ): Promise<AgentRecord | null> {
    const _orgKey = this.resolveOrgKey(organizationSlug);
    const _cached = this.getCached(orgKey, agentSlug);
    if (cached) {
      return cached;
    }

    const _record = await this.agentsRepository.findBySlug(
      organizationSlug,
      agentSlug,
    );

    if (record) {
      this.setCache(orgKey, agentSlug, record);
    }

    return record;
  }

  async listAgents(organizationSlug: string | null): Promise<AgentRecord[]> {
    const _orgKey = this.resolveOrgKey(organizationSlug);
    const records =
      await this.agentsRepository.listByOrganization(organizationSlug);

    const _bucket = this.ensureBucket(orgKey);
    const _expiresAt = Date.now() + this.cacheTtlMs;

    for (const record of records) {
      bucket.set(record.slug, { record, expiresAt });
    }

    return records;
  }

  invalidate(organizationSlug: string | null, agentSlug?: string): void {
    const _orgKey = this.resolveOrgKey(organizationSlug);
    if (!this.cache.has(orgKey)) {
      return;
    }

    if (!agentSlug) {
      this.cache.delete(orgKey);
      return;
    }

    const _bucket = this.cache.get(orgKey);
    bucket?.delete(agentSlug);
    if (bucket && bucket.size === 0) {
      this.cache.delete(orgKey);
    }
  }

  clearAll(): void {
    this.cache.clear();
  }

  private getCached(orgKey: string, agentSlug: string): AgentRecord | null {
    const _bucket = this.cache.get(orgKey);
    if (!bucket) {
      return null;
    }

    const _entry = bucket.get(agentSlug);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      bucket.delete(agentSlug);
      if (bucket.size === 0) {
        this.cache.delete(orgKey);
      }
      return null;
    }

    return entry.record;
  }

  private setCache(
    orgKey: string,
    agentSlug: string,
    record: AgentRecord,
  ): void {
    const _bucket = this.ensureBucket(orgKey);
    bucket.set(agentSlug, {
      record,
      expiresAt: Date.now() + this.cacheTtlMs,
    });
  }

  private ensureBucket(orgKey: string): Map<string, CacheEntry> {
    let bucket = this.cache.get(orgKey);
    if (!bucket) {
      bucket = new Map<string, CacheEntry>();
      this.cache.set(orgKey, bucket);
    }
    return bucket;
  }

  private resolveOrgKey(orgSlug: string | null): string {
    return orgSlug?.trim() || 'global';
  }

  private resolveTtl(): number {
    const _raw = this.configService.get<number | string | undefined>(
      'AGENT_REGISTRY_CACHE_TTL_MS',
    );

    const _numeric = Number(raw);
    if (!Number.isFinite(numeric)) {
      return DEFAULT_CACHE_TTL_MS;
    }

    return Math.min(Math.max(numeric, MIN_CACHE_TTL_MS), MAX_CACHE_TTL_MS);
  }
}
