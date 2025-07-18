import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TasksService } from '../src/tasks/tasks.service';
import { TaskMessageService } from '../src/tasks/task-message.service';
import { SupabaseService } from '../src/supabase/supabase.service';
import { MessageEmitter } from '../src/tasks/message-emitter.interface';
import { TasksModule } from '../src/tasks/tasks.module';
import { SupabaseModule } from '../src/supabase/supabase.module';
import { AgentConversationsModule } from '../src/agent-conversations/agent-conversations.module';
import { HttpModule } from '@nestjs/axios';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';

describe('Blog Post with Messages E2E Test', () => {
  let app: INestApplication;
  let tasksService: TasksService;
  let taskMessageService: TaskMessageService;
  let supabaseService: SupabaseService;
  let jwtService: JwtService;

  // Test user data - will be populated after authentication
  let testUserId: string;
  let authToken: string;
  const testAgentName = 'blog_post';
  const testAgentType = 'specialist';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    tasksService = moduleFixture.get<TasksService>(TasksService);
    taskMessageService =
      moduleFixture.get<TaskMessageService>(TaskMessageService);
    supabaseService = moduleFixture.get<SupabaseService>(SupabaseService);
    jwtService = moduleFixture.get<JwtService>(JwtService);

    // Authenticate as test user
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: process.env.SUPABASE_TEST_USER || 'testuser@golfergeek.com',
        password: process.env.SUPABASE_TEST_PASSWORD || 'testuser01!',
      })
      .expect(200);

    authToken = loginResponse.body.accessToken;
    expect(authToken).toBeDefined();

    // Decode JWT to get user ID
    const decoded = jwtService.decode(authToken);
    testUserId = decoded.sub;
    expect(testUserId).toBeDefined();

    console.log(`🔐 Authenticated as user: ${testUserId}`);
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up any existing test data
    const { error } = await supabaseService
      .getAnonClient()
      .from('tasks')
      .delete()
      .eq('user_id', testUserId);

    if (error) {
      console.warn('Error cleaning up test data:', error);
    }
  });

  describe('Test Suite 1: Simple Agent (Blog Post Writer)', () => {
    it('Test 1.1: Basic Blog Post Generation with Progress Messages', async () => {
      console.log('🧪 Starting Test 1.1: Basic Blog Post Generation');

      // Create a task for blog post generation
      const createTaskDto = {
        method: 'blog_post_creation',
        prompt:
          'Write a 500-word blog post about sustainable gardening tips for beginners',
        params: {
          outputFormat: 'markdown',
          contentLength: 'medium',
          tone: 'conversational',
          audience: 'general',
        },
        timeoutSeconds: 120,
      };

      // Create the task
      const task = await tasksService.createTask(
        testUserId,
        testAgentName,
        testAgentType,
        createTaskDto,
      );

      console.log('📝 Task created:', task.id);
      expect(task).toBeDefined();
      expect(task.status).toBe('pending');
      expect(task.method).toBe('blog_post_creation');

      // Create a message emitter for the task
      const messageEmitter: MessageEmitter = tasksService.createMessageEmitter(
        task.id,
        testUserId,
      );

      console.log('📡 Message emitter created');

      // Simulate task execution with progress messages
      await messageEmitter.status('Analyzing blog post requirements...');
      await messageEmitter.progress('Generating content structure...', 25);
      await messageEmitter.progress(
        'Creating introduction and main points...',
        50,
      );
      await messageEmitter.progress(
        'Optimizing for SEO and readability...',
        75,
      );
      await messageEmitter.progress('Finalizing blog post content...', 90);

      console.log('💬 Progress messages emitted');

      // Simulate the actual blog post generation (mock successful result)
      const mockBlogPost = `# Sustainable Gardening Tips for Beginners

Sustainable gardening is becoming increasingly popular as more people recognize the importance of environmentally friendly practices. Here are some essential tips to get you started on your sustainable gardening journey.

## 1. Choose Native Plants
Native plants are adapted to your local climate and soil conditions, making them easier to grow and maintain. They also provide better support for local wildlife and pollinators.

## 2. Compost Your Kitchen Scraps
Creating compost from kitchen scraps reduces waste and provides nutrient-rich soil for your plants. Include fruit and vegetable scraps, coffee grounds, and eggshells.

## 3. Water Wisely
Collect rainwater in barrels for irrigation and water your plants early in the morning to reduce evaporation. Consider drip irrigation systems for more efficient watering.

## 4. Use Natural Pest Control
Encourage beneficial insects like ladybugs and lacewings to control pests naturally. Companion planting can also help deter unwanted insects.

## 5. Avoid Chemical Fertilizers
Opt for organic fertilizers like compost, fish emulsion, or bone meal instead of synthetic chemicals that can harm beneficial soil microorganisms.

## Conclusion
Starting a sustainable garden doesn't have to be overwhelming. Begin with these simple steps and gradually incorporate more eco-friendly practices as you gain experience. Your garden will thrive while supporting the environment.`;

      // Update task with the result
      const updatedTask = await tasksService.updateTask(task.id, testUserId, {
        status: 'completed',
        response: mockBlogPost,
        progress: 100,
        responseMetadata: {
          deliverableType: 'blog_post',
          wordCount: mockBlogPost.split(/\s+/).length,
          structure: ['introduction', 'main_points', 'conclusion'],
          seoOptimized: true,
          targetAudience: 'beginners',
        },
      });

      console.log('✅ Task completed successfully');
      expect(updatedTask.status).toBe('completed');
      expect(updatedTask.response).toBe(mockBlogPost);

      // Emit final completion message
      await messageEmitter.status(
        'Blog post generation completed successfully!',
      );

      // Verify messages were created
      const { messages } = await taskMessageService.getTaskMessages(
        task.id,
        testUserId,
      );
      console.log(`📊 Total messages created: ${messages.length}`);

      expect(messages.length).toBeGreaterThan(0);

      // Verify message types
      const progressMessages = messages.filter(
        (m) => m.messageType === 'progress',
      );
      const statusMessages = messages.filter((m) => m.messageType === 'status');

      expect(progressMessages.length).toBe(4); // 25%, 50%, 75%, 90%
      expect(statusMessages.length).toBe(2); // Initial analysis + completion

      // Verify progress percentages
      const progressPercentages = progressMessages
        .map((m) => m.progressPercentage)
        .filter((p) => p !== undefined)
        .sort((a, b) => (a || 0) - (b || 0));
      expect(progressPercentages).toEqual([25, 50, 75, 90]);

      // Verify deliverable structure
      expect(updatedTask.responseMetadata).toBeDefined();
      expect(updatedTask.responseMetadata?.deliverableType).toBe('blog_post');
      expect(updatedTask.responseMetadata?.wordCount).toBeGreaterThan(0);

      console.log('🎉 Test 1.1 completed successfully!');
    });

    it('Test 1.2: Blog Post with Validation Error', async () => {
      console.log('🧪 Starting Test 1.2: Blog Post with Validation Error');

      // Create a task with invalid prompt
      const createTaskDto = {
        method: 'blog_post_creation',
        prompt: '', // Empty prompt should cause validation error
        params: {},
        timeoutSeconds: 60,
      };

      const task = await tasksService.createTask(
        testUserId,
        testAgentName,
        testAgentType,
        createTaskDto,
      );

      const messageEmitter = tasksService.createMessageEmitter(
        task.id,
        testUserId,
      );

      // Simulate validation error
      await messageEmitter.error(
        'Validation error: Blog post prompt cannot be empty',
      );

      await tasksService.updateTask(task.id, testUserId, {
        status: 'failed',
        errorMessage: 'Validation error: Blog post prompt cannot be empty',
        errorCode: 'VALIDATION_ERROR',
      });

      // Verify error handling
      const updatedTask = await tasksService.getTaskById(task.id, testUserId);
      expect(updatedTask).toBeDefined();
      expect(updatedTask!.status).toBe('failed');
      expect(updatedTask!.errorMessage).toContain('Validation error');

      const { messages } = await taskMessageService.getTaskMessages(
        task.id,
        testUserId,
      );
      const errorMessages = messages.filter((m) => m.messageType === 'error');
      expect(errorMessages.length).toBe(1);

      console.log('✅ Test 1.2 completed successfully!');
    });

    it('Test 1.3: Message Statistics and Retrieval', async () => {
      console.log('🧪 Starting Test 1.3: Message Statistics and Retrieval');

      const createTaskDto = {
        method: 'blog_post_creation',
        prompt: 'Write a short blog post about artificial intelligence',
        params: { contentLength: 'short' },
        timeoutSeconds: 60,
      };

      const task = await tasksService.createTask(
        testUserId,
        testAgentName,
        testAgentType,
        createTaskDto,
      );

      const messageEmitter = tasksService.createMessageEmitter(
        task.id,
        testUserId,
      );

      // Create various message types
      await messageEmitter.info('Starting AI blog post generation...');
      await messageEmitter.progress('Researching AI trends...', 20);
      await messageEmitter.warning('Limited context available for AI topics');
      await messageEmitter.progress('Generating content...', 60);
      await messageEmitter.progress('Finalizing structure...', 100);
      await messageEmitter.status('Blog post completed successfully');

      // Get message statistics
      const stats = await taskMessageService.getTaskMessageStats(
        task.id,
        testUserId,
      );

      expect(stats.total).toBe(6);
      expect(stats.progressMessages).toBe(3);
      expect(stats.byType.info).toBe(1);
      expect(stats.byType.progress).toBe(3);
      expect(stats.byType.warning).toBe(1);
      expect(stats.byType.status).toBe(1);
      expect(stats.lastMessage).toBeDefined();
      expect(stats.lastMessage!.messageType).toBe('status');

      console.log('📊 Message statistics:', stats);
      console.log('✅ Test 1.3 completed successfully!');
    });
  });

  describe('Database Integration Tests', () => {
    it('Should maintain data integrity across tasks and messages', async () => {
      console.log('🧪 Testing database integrity');

      const task = await tasksService.createTask(
        testUserId,
        testAgentName,
        testAgentType,
        {
          method: 'blog_post_creation',
          prompt: 'Test blog post',
          params: {},
        },
      );

      const messageEmitter = tasksService.createMessageEmitter(
        task.id,
        testUserId,
      );
      await messageEmitter.info('Test message');

      // Verify foreign key relationships
      const { messages } = await taskMessageService.getTaskMessages(
        task.id,
        testUserId,
      );
      expect(messages.length).toBe(1);
      expect(messages[0]!.taskId).toBe(task.id);
      expect(messages[0]!.userId).toBe(testUserId);

      // Delete task and verify cascade
      await supabaseService
        .getAnonClient()
        .from('tasks')
        .delete()
        .eq('id', task.id);

      const { messages: messagesAfterDelete } =
        await taskMessageService.getTaskMessages(task.id, testUserId);
      expect(messagesAfterDelete.length).toBe(0);

      console.log('✅ Database integrity test passed!');
    });
  });
});
