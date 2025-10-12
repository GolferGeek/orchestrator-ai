import { Injectable, Logger } from '@nestjs/common';
import { TaskResponsePayload } from '@orchestrator-ai/transport-types';

export interface OrchestrationMappedOutput {
  output: Record<string, any>;
  deliverableId: string | null;
  deliverableVersionId: string | null;
}

@Injectable()
export class OrchestrationOutputMapper {
  private readonly logger = new Logger(OrchestrationOutputMapper.name);

  map(
    payload: TaskResponsePayload | null | undefined,
    mapping: Record<string, any> | null | undefined,
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
    mapping: Record<string, any>,
  ): Record<string, any> {
    const result: Record<string, any> = {};
    const root = payload as Record<string, any>;

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

  private defaultProjection(payload: TaskResponsePayload): Record<string, any> {
    return {
      content: this.cloneValue(payload.content),
      metadata: this.cloneValue(payload.metadata ?? {}),
    };
  }

  private resolveDeliverableReference(
    payload: TaskResponsePayload,
  ): { id: string | null; versionId: string | null } | null {
    const asAny = payload as any;

    if (Array.isArray(asAny?.deliverables) && asAny.deliverables.length > 0) {
      const primary = asAny.deliverables[0] ?? {};
      return {
        id: primary.id ?? null,
        versionId: primary.versionId ?? primary.version_id ?? null,
      };
    }

    const contentDeliverable = asAny?.content?.deliverable;
    if (contentDeliverable) {
      return {
        id: contentDeliverable.id ?? null,
        versionId:
          contentDeliverable.versionId ??
          contentDeliverable.version_id ??
          contentDeliverable.currentVersion?.id ??
          null,
      };
    }

    return null;
  }

  private resolveJsonPath(root: Record<string, any>, expression: string): any {
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
    let current: any = root;

    for (const segment of segments) {
      if (current === null || current === undefined) {
        return null;
      }
      current = this.accessSegment(current, segment);
    }

    return this.cloneValue(current);
  }

  private accessSegment(target: any, segment: string): any {
    if (segment.length === 0) {
      return target;
    }

    let remainder = segment;
    let current = target;

    const fieldMatch = remainder.match(/^([^\[\]]+)/);
    if (fieldMatch?.[1]) {
      const fieldName = fieldMatch[1];
      current = current?.[fieldName];
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

  private cloneValue<T>(value: T): T {
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
}
