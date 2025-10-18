import { Test, TestingModule } from '@nestjs/testing';
import { OrchestrationOutputMapper } from './orchestration-output-mapper.service';
import { TaskResponsePayload } from '@orchestrator-ai/transport-types';

describe('OrchestrationOutputMapper', () => {
  let service: OrchestrationOutputMapper;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrchestrationOutputMapper],
    }).compile();

    service = module.get<OrchestrationOutputMapper>(OrchestrationOutputMapper);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('map - default projection', () => {
    it('should return default projection when no mapping provided', () => {
      const payload: TaskResponsePayload = {
        content: { message: 'test' },
        metadata: { source: 'test-agent' },
      };

      const result = service.map(payload, null);

      expect(result.output).toEqual({
        content: { message: 'test' },
        metadata: { source: 'test-agent' },
      });
      expect(result.deliverableId).toBeNull();
      expect(result.deliverableVersionId).toBeNull();
    });

    it('should handle null payload with default projection', () => {
      const result = service.map(null, null);

      expect(result.output).toEqual({
        content: null,
        metadata: {},
      });
    });

    it('should handle undefined payload', () => {
      const result = service.map(undefined, undefined);

      expect(result.output).toEqual({
        content: null,
        metadata: {},
      });
    });

    it('should clone values to prevent mutation', () => {
      const payload = {
        content: { nested: { value: 42 } },
        metadata: {},
      } satisfies TaskResponsePayload;

      const result = service.map(payload, null);

      // Mutate original
      const originalContent = payload.content as { nested: { value: number } };
      originalContent.nested.value = 999;

      // Result should be unchanged
      const resultContent = result.output.content as {
        nested: { value: number };
      };
      expect(resultContent.nested.value).toBe(42);
    });
  });

  describe('map - JSONPath expressions', () => {
    it('should resolve simple dot notation path', () => {
      const payload: TaskResponsePayload = {
        content: { result: { data: 'test-value' } },
        metadata: {},
      };

      const mapping = { extractedData: '$.content.result.data' };
      const result = service.map(payload, mapping);

      expect(result.output.extractedData).toBe('test-value');
    });

    it('should resolve array index notation', () => {
      const payload: TaskResponsePayload = {
        content: { items: ['first', 'second', 'third'] },
        metadata: {},
      };

      const mapping = {
        firstItem: '$.content.items[0]',
        secondItem: '$.content.items[1]',
      };
      const result = service.map(payload, mapping);

      expect(result.output.firstItem).toBe('first');
      expect(result.output.secondItem).toBe('second');
    });

    it('should resolve nested array access', () => {
      const payload: TaskResponsePayload = {
        content: {
          records: [
            { id: 1, name: 'Alice' },
            { id: 2, name: 'Bob' },
          ],
        },
        metadata: {},
      };

      const mapping = { firstRecord: '$.content.records[0].name' };
      const result = service.map(payload, mapping);

      expect(result.output.firstRecord).toBe('Alice');
    });

    it('should handle root $ expression', () => {
      const payload: TaskResponsePayload = {
        content: { message: 'hello' },
        metadata: { version: 1 },
      };

      const mapping = { fullPayload: '$' };
      const result = service.map(payload, mapping);

      expect(result.output.fullPayload).toEqual(payload);
    });

    it('should return null for non-existent paths', () => {
      const payload: TaskResponsePayload = {
        content: { data: 'test' },
        metadata: {},
      };

      const mapping = { missing: '$.content.does.not.exist' };
      const result = service.map(payload, mapping);

      expect(result.output.missing).toBeNull();
    });

    it('should handle array index out of bounds', () => {
      const payload: TaskResponsePayload = {
        content: { items: ['one'] },
        metadata: {},
      };

      const mapping = { outOfBounds: '$.content.items[999]' };
      const result = service.map(payload, mapping);

      expect(result.output.outOfBounds).toBeUndefined();
    });

    it('should handle complex nested structures', () => {
      const payload: TaskResponsePayload = {
        content: {
          results: [
            {
              dataset: {
                rows: [
                  { column1: 'A', column2: 10 },
                  { column1: 'B', column2: 20 },
                ],
              },
            },
          ],
        },
        metadata: {},
      };

      const mapping = { firstRow: '$.content.results[0].dataset.rows[0]' };
      const result = service.map(payload, mapping);

      expect(result.output.firstRow).toEqual({ column1: 'A', column2: 10 });
    });

    it('should preserve object structures when mapped', () => {
      const payload: TaskResponsePayload = {
        content: {
          queryResults: {
            columns: ['id', 'name'],
            rows: [{ id: 1, name: 'test' }],
          },
        },
        metadata: {},
      };

      const mapping = { results: '$.content.queryResults' };
      const result = service.map(payload, mapping);

      expect(result.output.results).toEqual({
        columns: ['id', 'name'],
        rows: [{ id: 1, name: 'test' }],
      });
    });
  });

  describe('map - literal values', () => {
    it('should copy literal string values', () => {
      const payload: TaskResponsePayload = { content: null, metadata: {} };

      const mapping = { staticValue: 'constant-string' };
      const result = service.map(payload, mapping);

      expect(result.output.staticValue).toBe('constant-string');
    });

    it('should copy literal number values', () => {
      const payload: TaskResponsePayload = { content: null, metadata: {} };

      const mapping = { count: 42 };
      const result = service.map(payload, mapping);

      expect(result.output.count).toBe(42);
    });

    it('should copy literal boolean values', () => {
      const payload: TaskResponsePayload = { content: null, metadata: {} };

      const mapping = { enabled: true, disabled: false };
      const result = service.map(payload, mapping);

      expect(result.output.enabled).toBe(true);
      expect(result.output.disabled).toBe(false);
    });

    it('should copy literal object values', () => {
      const payload: TaskResponsePayload = { content: null, metadata: {} };

      const mapping = {
        config: {
          key: 'value',
          nested: { flag: true },
        },
      };
      const result = service.map(payload, mapping);

      expect(result.output.config).toEqual({
        key: 'value',
        nested: { flag: true },
      });
    });
  });

  describe('map - deliverable reference resolution', () => {
    it('should extract deliverable from payload.deliverables array', () => {
      const payload = {
        content: {},
        metadata: {},
        deliverables: [
          {
            id: 'deliv-123',
            versionId: 'ver-456',
            title: 'Test Deliverable',
          },
        ],
      } as TaskResponsePayload;

      const result = service.map(payload, null);

      expect(result.deliverableId).toBe('deliv-123');
      expect(result.deliverableVersionId).toBe('ver-456');
    });

    it('should handle version_id snake_case variant', () => {
      const payload = {
        content: {},
        metadata: {},
        deliverables: [
          {
            id: 'deliv-789',
            version_id: 'ver-abc',
          },
        ],
      } as TaskResponsePayload;

      const result = service.map(payload, null);

      expect(result.deliverableId).toBe('deliv-789');
      expect(result.deliverableVersionId).toBe('ver-abc');
    });

    it('should fallback to content.deliverable when no deliverables array', () => {
      const payload: TaskResponsePayload = {
        content: {
          deliverable: {
            id: 'deliv-content',
            versionId: 'ver-content',
          },
        },
        metadata: {},
      };

      const result = service.map(payload, null);

      expect(result.deliverableId).toBe('deliv-content');
      expect(result.deliverableVersionId).toBe('ver-content');
    });

    it('should handle currentVersion nested structure', () => {
      const payload: TaskResponsePayload = {
        content: {
          deliverable: {
            id: 'deliv-nested',
            currentVersion: { id: 'ver-nested' },
          },
        },
        metadata: {},
      };

      const result = service.map(payload, null);

      expect(result.deliverableId).toBe('deliv-nested');
      expect(result.deliverableVersionId).toBe('ver-nested');
    });

    it('should return null when no deliverable present', () => {
      const payload: TaskResponsePayload = {
        content: { data: 'test' },
        metadata: {},
      };

      const result = service.map(payload, null);

      expect(result.deliverableId).toBeNull();
      expect(result.deliverableVersionId).toBeNull();
    });

    it('should prioritize deliverables array over content.deliverable', () => {
      const payload = {
        content: {
          deliverable: { id: 'content-id', versionId: 'content-version' },
        },
        metadata: {},
        deliverables: [{ id: 'array-id', versionId: 'array-version' }],
      } as TaskResponsePayload;

      const result = service.map(payload, null);

      expect(result.deliverableId).toBe('array-id');
      expect(result.deliverableVersionId).toBe('array-version');
    });
  });

  describe('map - error handling', () => {
    it('should return null for fields with invalid expressions', () => {
      const payload: TaskResponsePayload = {
        content: { valid: 'data' },
        metadata: {},
      };

      const mapping = {
        validField: '$.content.valid',
        invalidField: '$.content.nonexistent.deeply.nested',
      };

      const result = service.map(payload, mapping);

      expect(result.output.validField).toBe('data');
      expect(result.output.invalidField).toBeNull();
    });

    it('should log warning for mapping failures', () => {
      const serviceWithLogger = service as unknown as {
        logger: { warn: jest.Mock };
      };
      const logSpy = jest
        .spyOn(serviceWithLogger.logger, 'warn')
        .mockImplementation();

      const payload: TaskResponsePayload = { content: {}, metadata: {} };
      const mapping = { bad: '$.content.deeply.nested.undefined.path' };

      service.map(payload, mapping);

      logSpy.mockRestore();
    });

    it('should continue mapping other fields after error', () => {
      const payload: TaskResponsePayload = {
        content: { good: 'value' },
        metadata: {},
      };

      const mapping = {
        field1: '$.content.good',
        field2: '$.content.does.not.exist',
        field3: '$.content.good',
      };

      const result = service.map(payload, mapping);

      expect(result.output.field1).toBe('value');
      expect(result.output.field2).toBeNull();
      expect(result.output.field3).toBe('value');
    });
  });

  describe('map - kpi-tracking orchestration scenario', () => {
    it('should map Supabase agent query results for summarizer consumption', () => {
      const supabasePayload: TaskResponsePayload = {
        content: {
          sql: 'SELECT * FROM kpis WHERE month = $1',
          rows: [
            { metric: 'revenue', value: 150000, change: 5.2 },
            { metric: 'expenses', value: 95000, change: -2.1 },
          ],
          summary: 'Retrieved 2 KPI records',
        },
        metadata: { executionTime: 245 },
      };

      const mapping = {
        query_results: '$.content.rows',
        sql_query: '$.content.sql',
        summary: '$.content.summary',
      };

      const result = service.map(supabasePayload, mapping);

      expect(result.output.query_results).toEqual([
        { metric: 'revenue', value: 150000, change: 5.2 },
        { metric: 'expenses', value: 95000, change: -2.1 },
      ]);
      expect(result.output.sql_query).toBe(
        'SELECT * FROM kpis WHERE month = $1',
      );
      expect(result.output.summary).toBe('Retrieved 2 KPI records');
    });
  });
});
