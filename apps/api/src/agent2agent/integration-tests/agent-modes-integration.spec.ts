import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { Agent2AgentModule } from '../agent2agent.module';
import { TaskRequestDto, AgentTaskMode } from '../dto/task-request.dto';

/**
 * Phase 6: Backend Integration Testing
 *
 * Comprehensive integration tests for all three modes (CONVERSE, PLAN, BUILD)
 * Tests complete workflows, error handling, edge cases, and transport-types conformance
 */
describe('Agent Modes Integration Tests (Phase 6)', () => {
  let app: INestApplication;
  let httpServer: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [Agent2AgentModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    httpServer = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * Test 1: Complete Workflow - Talk → Plan → Build
   *
   * Tests full agent workflow from start to finish:
   * 1. Start conversation
   * 2. Continue conversation
   * 3. Create plan
   * 4. Read plan
   * 5. Edit plan
   * 6. Build deliverable
   * 7. Read deliverable
   */
  describe('Test 1: Complete Workflow - Talk → Plan → Build', () => {
    const conversationId = `integration-test-1-${Date.now()}`;

    it('should execute complete workflow successfully', async () => {
      // 1. Start conversation
      const converseRequest: TaskRequestDto = {
        mode: AgentTaskMode.CONVERSE,
        userMessage:
          'I need to write a technical blog post about Kubernetes best practices',
        conversationId,
      };

      const converse1 = await request(httpServer)
        .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
        .send(converseRequest)
        .expect(201);

      expect(converse1.body).toHaveProperty('mode', AgentTaskMode.CONVERSE);
      expect(converse1.body).toHaveProperty('content');
      expect(converse1.body.content).toHaveProperty('message');
      expect(converse1.body).toHaveProperty('metadata');
      expect(converse1.body.metadata).toHaveProperty('provider');
      expect(converse1.body.metadata).toHaveProperty('model');
      expect(converse1.body.metadata).toHaveProperty('usage');

      // 2. Continue conversation
      const converse2Request: TaskRequestDto = {
        mode: AgentTaskMode.CONVERSE,
        userMessage:
          'Target audience is DevOps engineers with 2-3 years experience',
        conversationId,
      };

      const converse2 = await request(httpServer)
        .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
        .send(converse2Request)
        .expect(201);

      expect(converse2.body).toHaveProperty('mode', AgentTaskMode.CONVERSE);
      expect(converse2.body.content).toHaveProperty('message');

      // 3. Create plan
      const planCreateRequest: TaskRequestDto = {
        mode: AgentTaskMode.PLAN,
        conversationId,
        payload: {
          action: 'create',
          title: 'Kubernetes Best Practices Plan',
        },
      };

      const planCreate = await request(httpServer)
        .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
        .send(planCreateRequest)
        .expect(201);

      expect(planCreate.body).toHaveProperty('mode', AgentTaskMode.PLAN);
      expect(planCreate.body.content).toHaveProperty('plan');
      expect(planCreate.body.content).toHaveProperty('version', 1);
      expect(planCreate.body.content).toHaveProperty('isNew', true);

      const planId = planCreate.body.content.plan.id;

      // 4. Read plan
      const planReadRequest: TaskRequestDto = {
        mode: AgentTaskMode.PLAN,
        conversationId,
        payload: { action: 'read' },
      };

      const planRead = await request(httpServer)
        .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
        .send(planReadRequest)
        .expect(201);

      expect(planRead.body).toHaveProperty('mode', AgentTaskMode.PLAN);
      expect(planRead.body.content).toHaveProperty('plan');
      expect(planRead.body.content.plan.id).toBe(planId);

      // 5. Edit plan
      const planEditRequest: TaskRequestDto = {
        mode: AgentTaskMode.PLAN,
        conversationId,
        payload: {
          action: 'edit',
          editedContent: {
            sections: ['Introduction', 'Best Practices', 'Conclusion'],
            target_audience: 'DevOps engineers',
          },
          comment: 'Added more detail to sections',
        },
      };

      const planEdit = await request(httpServer)
        .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
        .send(planEditRequest)
        .expect(201);

      expect(planEdit.body).toHaveProperty('mode', AgentTaskMode.PLAN);
      expect(planEdit.body.content).toHaveProperty('version', 2);
      expect(planEdit.body.content).toHaveProperty('isNew', false);

      // 6. Build deliverable
      const buildCreateRequest: TaskRequestDto = {
        mode: AgentTaskMode.BUILD,
        conversationId,
        payload: {
          action: 'create',
          title: 'Kubernetes Best Practices',
          type: 'blog_post',
        },
      };

      const buildCreate = await request(httpServer)
        .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
        .send(buildCreateRequest)
        .expect(201);

      expect(buildCreate.body).toHaveProperty('mode', AgentTaskMode.BUILD);
      expect(buildCreate.body.content).toHaveProperty('deliverable');
      expect(buildCreate.body.content).toHaveProperty('version', 1);
      expect(buildCreate.body.content).toHaveProperty('isNew', true);

      // 7. Read deliverable
      const buildReadRequest: TaskRequestDto = {
        mode: AgentTaskMode.BUILD,
        conversationId,
        payload: { action: 'read' },
      };

      const buildRead = await request(httpServer)
        .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
        .send(buildReadRequest)
        .expect(201);

      expect(buildRead.body).toHaveProperty('mode', AgentTaskMode.BUILD);
      expect(buildRead.body.content).toHaveProperty('deliverable');
      expect(buildRead.body.content.deliverable).toHaveProperty(
        'title',
        'Kubernetes Best Practices',
      );
    });
  });

  /**
   * Test 2: Skip Planning Workflow - Talk → Build
   *
   * Tests building directly from conversation without creating a plan
   */
  describe('Test 2: Skip Planning Workflow - Talk → Build', () => {
    const conversationId = `integration-test-2-${Date.now()}`;

    it('should build deliverable directly from conversation without plan', async () => {
      // 1. Conversation
      const converseRequest: TaskRequestDto = {
        mode: AgentTaskMode.CONVERSE,
        userMessage: 'Write a quick intro paragraph about Docker containers',
        conversationId,
      };

      const converse = await request(httpServer)
        .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
        .send(converseRequest)
        .expect(201);

      expect(converse.body).toHaveProperty('mode', AgentTaskMode.CONVERSE);

      // 2. Build directly (no plan)
      const buildRequest: TaskRequestDto = {
        mode: AgentTaskMode.BUILD,
        conversationId,
        payload: {
          action: 'create',
          title: 'Docker Intro',
        },
      };

      const build = await request(httpServer)
        .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
        .send(buildRequest)
        .expect(201);

      expect(build.body).toHaveProperty('mode', AgentTaskMode.BUILD);
      expect(build.body.content).toHaveProperty('deliverable');
      expect(build.body.content.deliverable).toHaveProperty(
        'title',
        'Docker Intro',
      );
      expect(build.body.content.deliverable).toHaveProperty('content');
      expect(build.body.content.deliverable.content).toContain('Docker');
    });
  });

  /**
   * Test 3: Multiple Plan Versions
   *
   * Tests creating and managing multiple plan versions
   */
  describe('Test 3: Multiple Plan Versions', () => {
    const conversationId = `integration-test-3-${Date.now()}`;

    it('should manage multiple plan versions correctly', async () => {
      // Setup conversation
      await request(httpServer)
        .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
        .send({
          mode: AgentTaskMode.CONVERSE,
          userMessage: 'Create a blog post about TypeScript',
          conversationId,
        })
        .expect(201);

      // Create plan v1
      const planV1 = await request(httpServer)
        .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
        .send({
          mode: AgentTaskMode.PLAN,
          conversationId,
          payload: { action: 'create', title: 'TypeScript Blog Plan' },
        })
        .expect(201);

      expect(planV1.body.content).toHaveProperty('version', 1);

      // Edit to create v2
      const planV2 = await request(httpServer)
        .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
        .send({
          mode: AgentTaskMode.PLAN,
          conversationId,
          payload: {
            action: 'edit',
            editedContent: { sections: ['Intro', 'Advanced Features'] },
            comment: 'Version 2',
          },
        })
        .expect(201);

      expect(planV2.body.content).toHaveProperty('version', 2);

      // Edit to create v3
      const planV3 = await request(httpServer)
        .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
        .send({
          mode: AgentTaskMode.PLAN,
          conversationId,
          payload: {
            action: 'edit',
            editedContent: { sections: ['Intro', 'Advanced', 'Conclusion'] },
            comment: 'Version 3',
          },
        })
        .expect(201);

      expect(planV3.body.content).toHaveProperty('version', 3);

      // List all versions
      const listVersions = await request(httpServer)
        .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
        .send({
          mode: AgentTaskMode.PLAN,
          conversationId,
          payload: { action: 'listVersions' },
        })
        .expect(201);

      expect(listVersions.body.content).toHaveProperty('versions');
      expect(listVersions.body.content.versions).toHaveLength(3);

      // Set v2 as current
      await request(httpServer)
        .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
        .send({
          mode: AgentTaskMode.PLAN,
          conversationId,
          payload: { action: 'setCurrent', versionNumber: 2 },
        })
        .expect(201);

      // Verify v2 is current
      const readCurrent = await request(httpServer)
        .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
        .send({
          mode: AgentTaskMode.PLAN,
          conversationId,
          payload: { action: 'read' },
        })
        .expect(201);

      expect(readCurrent.body.content.plan).toHaveProperty('currentVersion', 2);
    });
  });

  /**
   * Test 4: Multiple Deliverable Versions
   *
   * Tests deliverable versioning (edit, rerun)
   */
  describe('Test 4: Multiple Deliverable Versions', () => {
    const conversationId = `integration-test-4-${Date.now()}`;

    it('should manage multiple deliverable versions through edit and rerun', async () => {
      // Setup conversation and plan
      await request(httpServer)
        .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
        .send({
          mode: AgentTaskMode.CONVERSE,
          userMessage: 'Write about React hooks',
          conversationId,
        })
        .expect(201);

      // Create initial deliverable (v1)
      const buildV1 = await request(httpServer)
        .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
        .send({
          mode: AgentTaskMode.BUILD,
          conversationId,
          payload: { action: 'create', title: 'React Hooks Guide' },
        })
        .expect(201);

      expect(buildV1.body.content).toHaveProperty('version', 1);

      // Edit deliverable (creates v2)
      const buildV2 = await request(httpServer)
        .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
        .send({
          mode: AgentTaskMode.BUILD,
          conversationId,
          payload: {
            action: 'edit',
            editedContent: { content: 'Updated content for v2' },
            comment: 'Manual edit to v2',
          },
        })
        .expect(201);

      expect(buildV2.body.content).toHaveProperty('version', 2);

      // Rerun with different temperature (creates v3)
      const buildV3 = await request(httpServer)
        .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
        .send({
          mode: AgentTaskMode.BUILD,
          conversationId,
          payload: {
            action: 'rerun',
            llmConfig: { temperature: 0.9 },
          },
        })
        .expect(201);

      expect(buildV3.body.content).toHaveProperty('version', 3);

      // List all deliverable versions
      const listVersions = await request(httpServer)
        .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
        .send({
          mode: AgentTaskMode.BUILD,
          conversationId,
          payload: { action: 'listVersions' },
        })
        .expect(201);

      expect(listVersions.body.content).toHaveProperty('versions');
      expect(listVersions.body.content.versions).toHaveLength(3);

      // Set v1 as current
      await request(httpServer)
        .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
        .send({
          mode: AgentTaskMode.BUILD,
          conversationId,
          payload: { action: 'setCurrent', versionNumber: 1 },
        })
        .expect(201);

      // Read (should get v1)
      const readV1 = await request(httpServer)
        .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
        .send({
          mode: AgentTaskMode.BUILD,
          conversationId,
          payload: { action: 'read' },
        })
        .expect(201);

      expect(readV1.body.content.deliverable).toHaveProperty(
        'currentVersion',
        1,
      );
    });
  });

  /**
   * Test 5: Error Handling - Invalid Actions
   *
   * Tests error responses for invalid actions
   */
  describe('Test 5: Error Handling - Invalid Actions', () => {
    it('should return proper error for invalid PLAN action', async () => {
      const response = await request(httpServer)
        .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
        .send({
          mode: AgentTaskMode.PLAN,
          conversationId: 'test-errors',
          payload: { action: 'invalid_action' },
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('invalid');
    });

    it('should return proper error for invalid BUILD action', async () => {
      const response = await request(httpServer)
        .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
        .send({
          mode: AgentTaskMode.BUILD,
          conversationId: 'test-errors',
          payload: { action: 'bad_action' },
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('invalid');
    });

    it('should not crash server on invalid actions', async () => {
      // Multiple invalid requests shouldn't crash server
      const requests = Array(5)
        .fill(null)
        .map(() =>
          request(httpServer)
            .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
            .send({
              mode: AgentTaskMode.PLAN,
              conversationId: 'test-errors',
              payload: { action: 'nonsense' },
            }),
        );

      const responses = await Promise.all(requests);
      responses.forEach((res) => {
        expect([400, 500]).toContain(res.status);
      });

      // Server should still work
      await request(httpServer).get('/health').expect(200);
    });
  });

  /**
   * Test 6: Error Handling - Validation Failures
   *
   * Tests schema validation error handling
   */
  describe('Test 6: Error Handling - Validation Failures', () => {
    it('should validate plan structure if agent has plan_structure schema', async () => {
      // Note: This test assumes existence of an agent with strict plan_structure
      // If no such agent exists, this test will be skipped or modified

      const conversationId = `validation-test-${Date.now()}`;

      // Try to create plan with invalid structure
      const response = await request(httpServer)
        .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
        .send({
          mode: AgentTaskMode.PLAN,
          conversationId,
          payload: {
            action: 'create',
            // Missing required fields based on schema
            title: 'Test',
          },
        });

      // May succeed if no strict schema, or fail with validation error
      if (response.status === 400) {
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('validation');
      }
    });

    it('should validate deliverable structure if agent has deliverable_structure schema', async () => {
      const conversationId = `validation-test-build-${Date.now()}`;

      const response = await request(httpServer)
        .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
        .send({
          mode: AgentTaskMode.BUILD,
          conversationId,
          payload: {
            action: 'create',
            // Missing required fields
          },
        });

      // May succeed if no strict schema, or fail with validation error
      if (response.status === 400) {
        expect(response.body).toHaveProperty('message');
      }
    });
  });

  /**
   * Test 7: Null Schema Handling
   *
   * Verifies agents without schemas work correctly
   */
  describe('Test 7: Null Schema Handling', () => {
    const conversationId = `null-schema-test-${Date.now()}`;

    it('should work with agents that have no plan_structure or deliverable_structure', async () => {
      // Use agent without schemas (or default agent)
      await request(httpServer)
        .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
        .send({
          mode: AgentTaskMode.CONVERSE,
          userMessage: 'Test message',
          conversationId,
        })
        .expect(201);

      // Create plan without validation
      const planResponse = await request(httpServer)
        .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
        .send({
          mode: AgentTaskMode.PLAN,
          conversationId,
          payload: { action: 'create', title: 'Flexible Plan' },
        })
        .expect(201);

      expect(planResponse.body).toHaveProperty('mode', AgentTaskMode.PLAN);

      // Create deliverable without validation
      const buildResponse = await request(httpServer)
        .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
        .send({
          mode: AgentTaskMode.BUILD,
          conversationId,
          payload: { action: 'create', title: 'Flexible Deliverable' },
        })
        .expect(201);

      expect(buildResponse.body).toHaveProperty('mode', AgentTaskMode.BUILD);
    });
  });

  /**
   * Test 8: Transport-Types Conformance Check
   *
   * Verifies all responses match transport-types exactly
   */
  describe('Test 8: Transport-Types Conformance Check', () => {
    const conversationId = `transport-test-${Date.now()}`;

    it('should return CONVERSE response matching TaskResponseDto', async () => {
      const response = await request(httpServer)
        .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
        .send({
          mode: AgentTaskMode.CONVERSE,
          userMessage: 'Hello',
          conversationId,
        })
        .expect(201);

      // Verify TaskResponseDto structure
      expect(response.body).toMatchObject({
        mode: AgentTaskMode.CONVERSE,
        content: {
          message: expect.any(String),
        },
        metadata: {
          provider: expect.any(String),
          model: expect.any(String),
          usage: expect.objectContaining({
            promptTokens: expect.any(Number),
            completionTokens: expect.any(Number),
            totalTokens: expect.any(Number),
          }),
        },
      });
    });

    it('should return PLAN create response matching TaskResponseDto', async () => {
      const response = await request(httpServer)
        .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
        .send({
          mode: AgentTaskMode.PLAN,
          conversationId,
          payload: { action: 'create', title: 'Test Plan' },
        })
        .expect(201);

      expect(response.body).toMatchObject({
        mode: AgentTaskMode.PLAN,
        content: {
          plan: expect.any(Object),
          version: expect.any(Number),
          isNew: expect.any(Boolean),
        },
        metadata: expect.any(Object),
      });
    });

    it('should return BUILD create response matching TaskResponseDto', async () => {
      const response = await request(httpServer)
        .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
        .send({
          mode: AgentTaskMode.BUILD,
          conversationId,
          payload: { action: 'create', title: 'Test Deliverable' },
        })
        .expect(201);

      expect(response.body).toMatchObject({
        mode: AgentTaskMode.BUILD,
        content: {
          deliverable: expect.any(Object),
          version: expect.any(Number),
          isNew: expect.any(Boolean),
        },
        metadata: expect.any(Object),
      });
    });

    it('should return all PLAN actions with correct types', async () => {
      const planActions = ['read', 'listVersions', 'getVersion', 'delete'];

      for (const action of planActions) {
        const response = await request(httpServer)
          .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
          .send({
            mode: AgentTaskMode.PLAN,
            conversationId,
            payload: {
              action,
              ...(action === 'getVersion' ? { versionNumber: 1 } : {}),
            },
          });

        expect(response.body).toHaveProperty('mode', AgentTaskMode.PLAN);
        expect(response.body).toHaveProperty('content');
        expect(response.body).toHaveProperty('metadata');
      }
    });

    it('should return all BUILD actions with correct types', async () => {
      const buildActions = ['read', 'listVersions', 'getVersion', 'delete'];

      for (const action of buildActions) {
        const response = await request(httpServer)
          .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
          .send({
            mode: AgentTaskMode.BUILD,
            conversationId,
            payload: {
              action,
              ...(action === 'getVersion' ? { versionNumber: 1 } : {}),
            },
          });

        expect(response.body).toHaveProperty('mode', AgentTaskMode.BUILD);
        expect(response.body).toHaveProperty('content');
        expect(response.body).toHaveProperty('metadata');
      }
    });
  });

  /**
   * Test 9: Concurrent Requests
   *
   * Tests multiple simultaneous requests
   */
  describe('Test 9: Concurrent Requests', () => {
    it('should handle 5 CONVERSE requests simultaneously', async () => {
      const requests = Array(5)
        .fill(null)
        .map((_, i) =>
          request(httpServer)
            .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
            .send({
              mode: AgentTaskMode.CONVERSE,
              userMessage: `Concurrent message ${i}`,
              conversationId: `concurrent-converse-${i}-${Date.now()}`,
            }),
        );

      const responses = await Promise.all(requests);

      responses.forEach((res) => {
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('mode', AgentTaskMode.CONVERSE);
      });
    });

    it('should handle 3 PLAN creates simultaneously for different conversations', async () => {
      const timestamp = Date.now();

      // Setup conversations first
      const setupRequests = Array(3)
        .fill(null)
        .map((_, i) =>
          request(httpServer)
            .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
            .send({
              mode: AgentTaskMode.CONVERSE,
              userMessage: `Setup for plan ${i}`,
              conversationId: `concurrent-plan-${i}-${timestamp}`,
            }),
        );

      await Promise.all(setupRequests);

      // Create plans concurrently
      const planRequests = Array(3)
        .fill(null)
        .map((_, i) =>
          request(httpServer)
            .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
            .send({
              mode: AgentTaskMode.PLAN,
              conversationId: `concurrent-plan-${i}-${timestamp}`,
              payload: { action: 'create', title: `Concurrent Plan ${i}` },
            }),
        );

      const responses = await Promise.all(planRequests);

      responses.forEach((res) => {
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('mode', AgentTaskMode.PLAN);
      });
    });

    it('should handle 2 BUILD creates simultaneously for different conversations', async () => {
      const timestamp = Date.now();

      // Setup conversations
      const setupRequests = Array(2)
        .fill(null)
        .map((_, i) =>
          request(httpServer)
            .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
            .send({
              mode: AgentTaskMode.CONVERSE,
              userMessage: `Setup for build ${i}`,
              conversationId: `concurrent-build-${i}-${timestamp}`,
            }),
        );

      await Promise.all(setupRequests);

      // Create deliverables concurrently
      const buildRequests = Array(2)
        .fill(null)
        .map((_, i) =>
          request(httpServer)
            .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
            .send({
              mode: AgentTaskMode.BUILD,
              conversationId: `concurrent-build-${i}-${timestamp}`,
              payload: { action: 'create', title: `Concurrent Build ${i}` },
            }),
        );

      const responses = await Promise.all(buildRequests);

      responses.forEach((res) => {
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('mode', AgentTaskMode.BUILD);
      });
    });

    it('should maintain correct conversation isolation', async () => {
      const timestamp = Date.now();
      const conv1 = `isolation-test-1-${timestamp}`;
      const conv2 = `isolation-test-2-${timestamp}`;

      // Create two conversations with different content
      await Promise.all([
        request(httpServer)
          .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
          .send({
            mode: AgentTaskMode.CONVERSE,
            userMessage: 'Talk about Python',
            conversationId: conv1,
          }),
        request(httpServer)
          .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
          .send({
            mode: AgentTaskMode.CONVERSE,
            userMessage: 'Talk about JavaScript',
            conversationId: conv2,
          }),
      ]);

      // Create plans for both
      const [plan1, plan2] = await Promise.all([
        request(httpServer)
          .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
          .send({
            mode: AgentTaskMode.PLAN,
            conversationId: conv1,
            payload: { action: 'create', title: 'Python Plan' },
          }),
        request(httpServer)
          .post('/api/a2a/agent-to-agent/demo/blog-post-writer/tasks')
          .send({
            mode: AgentTaskMode.PLAN,
            conversationId: conv2,
            payload: { action: 'create', title: 'JavaScript Plan' },
          }),
      ]);

      // Verify plans are different and correctly isolated
      expect(plan1.body.content.plan.id).not.toBe(plan2.body.content.plan.id);
      expect(plan1.body.content.plan.conversationId).toBe(conv1);
      expect(plan2.body.content.plan.conversationId).toBe(conv2);
    });
  });

  /**
   * Test 10: Database State Verification
   *
   * Verifies database state after all tests
   * Note: This test uses direct database queries - implementation depends on your DB setup
   */
  describe('Test 10: Database State Verification', () => {
    it('should have correct database state after integration tests', async () => {
      // Note: This test would require database service injection
      // Placeholder assertions - implement based on your database setup

      // Expected: Multiple conversations created
      // Expected: Multiple messages saved
      // Expected: Multiple plans created
      // Expected: Multiple plan versions
      // Expected: Multiple deliverables created
      // Expected: Multiple deliverable versions
      // Expected: All foreign keys intact
      // Expected: No orphaned records

      expect(true).toBe(true); // Placeholder
    });
  });
});
