import { Injectable, Logger } from '@nestjs/common';
import type {
  JsonObject,
  JsonValue,
  TaskResponsePayload,
} from '@orchestrator-ai/transport-types';

export interface OrchestrationMappedOutput {
  output: JsonObject;
  deliverableId: string | null;
  deliverableVersionId: string | null;
}

@Injectable()
export class OrchestrationOutputMapper {
  private readonly logger = new Logger(OrchestrationOutputMapper.name);

  map(
    payload: TaskResponsePayload | null | undefined,
    mapping: JsonObject | null | undefined,
  ): OrchestrationMappedOutput {
    const safePayload: TaskResponsePayload = payload ?? {
      content: null,
      metadata: {},
    };

    const output =
      mapping && Object.keys(mapping).length > 0
        ? this.applyMapping(safePayload, mapping)
        : this.defaultProjection(safePayload);

    const deliverableRef = this.resolveDeliverableReference(safePayload);

    return {
      output,
      deliverableId: deliverableRef?.id ?? null,
      deliverableVersionId: deliverableRef?.versionId ?? null,
    };
  }

  private applyMapping(
    payload: TaskResponsePayload,
    mapping: JsonObject,
  ): JsonObject {
    const result: JsonObject = {};
    const root = payload as unknown as JsonObject;

    Object.entries(mapping).forEach(([key, expression]) => {
      try {
        if (typeof expression === 'string' && expression.trim().startsWith('$')) {
          result[key] = this.resolveJsonPath(root, expression.trim());
        } else {
          result[key] = this.cloneValue(expression);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to map orchestration output for key ${key}: ${error instanceof Error ? error.message : String(error)}`,
        );
        result[key] = null;
      }
    });

    return result;
  }

  private defaultProjection(payload: TaskResponsePayload): JsonObject {
    return {
      content: this.cloneValue(payload.content),
      metadata: this.cloneValue(payload.metadata ?? {}),
    };
  }

  private resolveDeliverableReference(
    payload: TaskResponsePayload,
  ): { id: string | null; versionId: string | null } | null {
    const candidate = payload as unknown as JsonObject;

    const deliverables = candidate.deliverables;
    if (Array.isArray(deliverables) && deliverables.length > 0) {
      const primary = (deliverables[0] ?? {}) as JsonObject;
      return {
        id: this.asString(primary.id) ?? null,
        versionId:
          this.asString(primary.versionId) ??
          this.asString(primary.version_id) ??
          null,
      };
    }

    const contentDeliverable =
      (candidate.content as JsonObject | undefined)?.deliverable;
    if (contentDeliverable && typeof contentDeliverable === 'object') {
      const deliverable = contentDeliverable as JsonObject;
      return {
        id: this.asString(deliverable.id) ?? null,
        versionId:
          this.asString(deliverable.versionId) ??
          this.asString(deliverable.version_id) ??
          this.asString(
            (deliverable.currentVersion as JsonObject | undefined)?.id,
          ) ??
          null,
      };
    }

    return null;
  }

  private resolveJsonPath(root: JsonObject, expression: string): JsonValue {
    let path = expression.trim();
    if (!path.startsWith('$')) {
      return null;
    }

    path = path.slice(1);
    if (path.startsWith('.')) {
      path = path.slice(1);
    }

    if (!path) {
      return this.cloneValue(root);
    }

    const segments = path.split('.');
    let current: JsonValue = root;

    for (const segment of segments) {
      if (current === null || current === undefined) {
        return null;
      }
      current = this.accessSegment(current, segment);
    }

    return this.cloneValue(current);
  }

  private accessSegment(target: JsonValue, segment: string): JsonValue {
    if (segment.length === 0) {
      return target;
    }

    let remainder = segment;
    let current = target;

    const fieldMatch = remainder.match(/^([^\[\]]+)/);
    if (fieldMatch?.[1]) {
      const fieldName = fieldMatch[1];
      if (current && typeof current === 'object' && !Array.isArray(current)) {
        current = (current as JsonObject)[fieldName];
      } else {
        current = undefined;
      }
      remainder = remainder.slice(fieldName.length);
    }

    const indexRegex = /\[(\d+)\]/g;
    let indexMatch: RegExpExecArray | null;
    while ((indexMatch = indexRegex.exec(remainder))) {
      const index = Number(indexMatch[1]);
      if (!Array.isArray(current)) {
        return null;
      }
      current = current[index];
    }

    return current;
  }

  private cloneValue<T extends JsonValue>(value: T): T {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'object') {
      try {
        return JSON.parse(JSON.stringify(value));
      } catch (_error) {
        // Fallback to original reference if cloning fails
        return value;
      }
    }

    return value;
  }

  private asString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
  }
}
