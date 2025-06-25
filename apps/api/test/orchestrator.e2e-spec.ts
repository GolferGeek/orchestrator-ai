require('dotenv').config({
  path: require('path').resolve(__dirname, '../../.env'),
});
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Orchestrator Agent (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Wait for agents to be discovered
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Authenticate to get token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: process.env.SUPABASE_TEST_USER || 'testuser@golfergeek.com',
        password: process.env.SUPABASE_TEST_PASSWORD || 'testuser01!',
      })
      .expect(200);

    authToken = loginResponse.body.access_token;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Agent Discovery Integration', () => {
    it('should have agents discovered and instantiated', async () => {
      // Wait a bit for agents to be discovered
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const response = await request(app.getHttpServer())
        .get('/agents')
        .expect(200);

      expect(response.body.discoveredAgents).toBeGreaterThan(0);
      expect(response.body.runningInstances).toBeGreaterThan(0);
      expect(response.body.status).toBe('running');
    });

    it('should have orchestrator agent discovered', async () => {
      // Wait for agent discovery
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const response = await request(app.getHttpServer())
        .get('/agents')
        .expect(200);

      const orchestratorAgent = response.body.agents.find(
        (agent: any) => agent.name === 'orchestrator',
      );
      expect(orchestratorAgent).toBeDefined();
      expect(orchestratorAgent.type).toBe('orchestrator');
    });

    it('should have specialist agents available', async () => {
      // Wait for agent discovery
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const response = await request(app.getHttpServer())
        .get('/agents')
        .expect(200);

      const blogPostAgent = response.body.agents.find(
        (agent: any) => agent.name === 'blog_post',
      );
      expect(blogPostAgent).toBeDefined();
      expect(blogPostAgent.type).toBe('specialists');
    });
  });

  describe('Agent Discovery', () => {
    it('should discover agents through the discovery service', async () => {
      const response = await request(app.getHttpServer())
        .get('/agents')
        .expect(200);

      expect(response.body.status).toBe('running');
      expect(response.body.discoveredAgents).toBeGreaterThanOrEqual(2);

      const agentNames = response.body.agents.map((agent: any) => agent.name);
      expect(agentNames).toContain('orchestrator');
      expect(agentNames).toContain('blog_post');
    });
  });

  describe('Agent Cards and Capabilities', () => {
    it('should provide agent cards for discovered agents', async () => {
      // Wait for agent discovery
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Test blog post agent card
      const blogPostResponse = await request(app.getHttpServer())
        .get('/agents/specialists/blog_post/.well-known/agent.json')
        .expect(200);

      expect(blogPostResponse.body.name).toBe('Blog Post Writer');
      expect(blogPostResponse.body.type).toBe('specialist');
      expect(blogPostResponse.body.skills).toBeInstanceOf(Array);
      expect(blogPostResponse.body.skills.length).toBeGreaterThan(0);

      // Check that at least one skill has content_creation tag
      const hasContentCreation = blogPostResponse.body.skills.some(
        (skill: any) => skill.tags && skill.tags.includes('content-creation'),
      );
      expect(hasContentCreation).toBe(true);
    });

    it('should handle task processing for agents', async () => {
      // Wait for agent discovery
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Test that we can make a task request to blog post agent
      const taskRequest = {
        method: 'generate_content',
        params: { prompt: 'Write a test blog post about NestJS' },
      };

      const response = await request(app.getHttpServer())
        .post('/agents/specialists/blog_post/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskRequest)
        .expect(200);

      expect(response.body).toBeDefined();
      // The response should contain some content or success indicator
    }, 15000); // Increase timeout to 15 seconds
  });
});
