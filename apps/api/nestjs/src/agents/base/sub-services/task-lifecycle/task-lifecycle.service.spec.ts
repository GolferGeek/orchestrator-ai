import { Test, TestingModule } from '@nestjs/testing';
import { TaskLifecycleService, TaskStatus, TaskExecutor, TaskCreationRequest } from './task-lifecycle.service';

// Mock executor for testing
class MockTaskExecutor implements TaskExecutor {
  private shouldFail = false;
  private delay = 0;
  private result: any = 'mock-result';

  setFailure(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  setDelay(delay: number): void {
    this.delay = delay;
  }

  setResult(result: any): void {
    this.result = result;
  }

  async executeTask(method: string, params: any): Promise<any> {
    if (this.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delay));
    }

    if (this.shouldFail) {
      throw new Error('Mock execution failure');
    }

    return this.result;
  }
}

describe('TaskLifecycleService', () => {
  let service: TaskLifecycleService;
  let mockExecutor: MockTaskExecutor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TaskLifecycleService],
    }).compile();

    service = module.get<TaskLifecycleService>(TaskLifecycleService);
    mockExecutor = new MockTaskExecutor();
  });

  afterEach(async () => {
    // Clean up any running tasks and intervals
    await service.onModuleDestroy();
  });

  describe('Configuration Management', () => {
    it('should have default configuration', () => {
      const config = service.getConfig();
      expect(config.defaultTimeout).toBe(300000);
      expect(config.maxConcurrentTasks).toBe(100);
      expect(config.enableMetrics).toBe(true);
      expect(config.cleanupInterval).toBe(60000);
    });

    it('should update configuration', () => {
      const newConfig = {
        defaultTimeout: 60000,
        maxConcurrentTasks: 50
      };

      service.updateConfig(newConfig);
      const config = service.getConfig();

      expect(config.defaultTimeout).toBe(60000);
      expect(config.maxConcurrentTasks).toBe(50);
      expect(config.enableMetrics).toBe(true); // Should retain existing values
    });
  });

  describe('Task Creation', () => {
    it('should create a task with default timeout', async () => {
      const request: TaskCreationRequest = {
        method: 'test-method',
        params: { key: 'value' }
      };

      const task = await service.createTask(request);

      expect(task.id).toBeDefined();
      expect(task.method).toBe('test-method');
      expect(task.params).toEqual({ key: 'value' });
      expect(task.status).toBe(TaskStatus.PENDING);
      expect(task.timeout).toBe(300000);
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a task with custom timeout', async () => {
      const request: TaskCreationRequest = {
        method: 'test-method',
        params: { key: 'value' },
        timeout: 60000
      };

      const task = await service.createTask(request);

      expect(task.timeout).toBe(60000);
    });

    it('should reject task creation when max concurrent limit reached', async () => {
      service.updateConfig({ maxConcurrentTasks: 1 });

      // Create first task
      await service.createTask({ method: 'test1' });

      // Second task should fail
      await expect(service.createTask({ method: 'test2' }))
        .rejects.toThrow('Maximum concurrent tasks limit reached (1)');
    });

    it('should generate unique task IDs', async () => {
      const task1 = await service.createTask({ method: 'test1' });
      const task2 = await service.createTask({ method: 'test2' });

      expect(task1.id).not.toBe(task2.id);
    });
  });

  describe('Task Execution', () => {
    it('should execute task successfully', async () => {
      const task = await service.createTask({ method: 'test-method' });
      mockExecutor.setResult('success-result');

      const executedTask = await service.executeTaskWithLifecycle(task.id, mockExecutor);

      expect(executedTask.status).toBe(TaskStatus.COMPLETED);
      expect(executedTask.result).toBe('success-result');
      expect(executedTask.error).toBeUndefined();
    });

    it('should handle task execution failure', async () => {
      const task = await service.createTask({ method: 'test-method' });
      mockExecutor.setFailure(true);

      const executedTask = await service.executeTaskWithLifecycle(task.id, mockExecutor);

      expect(executedTask.status).toBe(TaskStatus.FAILED);
      expect(executedTask.error).toBeDefined();
      expect(executedTask.error?.message).toBe('Mock execution failure');
      expect(executedTask.error?.code).toBe(-32603);
    });

    it('should handle task timeout', async () => {
      const task = await service.createTask({ 
        method: 'test-method',
        timeout: 100 // 100ms timeout
      });
      mockExecutor.setDelay(200); // 200ms delay

      const executedTask = await service.executeTaskWithLifecycle(task.id, mockExecutor);

      expect(executedTask.status).toBe(TaskStatus.FAILED);
      expect(executedTask.error?.message).toContain('timeout');
    });

    it('should reject execution of non-existent task', async () => {
      await expect(service.executeTaskWithLifecycle('non-existent', mockExecutor))
        .rejects.toThrow('Task non-existent not found');
    });

    it('should reject execution of non-pending task', async () => {
      const task = await service.createTask({ method: 'test-method' });
      service.updateTaskStatus(task.id, TaskStatus.RUNNING);

      await expect(service.executeTaskWithLifecycle(task.id, mockExecutor))
        .rejects.toThrow('is not in pending status');
    });
  });

  describe('Task Status Management', () => {
    it('should update task status', async () => {
      const task = await service.createTask({ method: 'test-method' });

      const updatedTask = service.updateTaskStatus(task.id, TaskStatus.RUNNING);

      expect(updatedTask?.status).toBe(TaskStatus.RUNNING);
      expect(updatedTask?.updatedAt).toBeInstanceOf(Date);
    });

    it('should return null when updating non-existent task', () => {
      const result = service.updateTaskStatus('non-existent', TaskStatus.RUNNING);
      expect(result).toBeNull();
    });
  });

  describe('Task Retrieval', () => {
    it('should get task by ID', async () => {
      const task = await service.createTask({ method: 'test-method' });

      const retrievedTask = service.getTaskById(task.id);

      expect(retrievedTask).toBeDefined();
      expect(retrievedTask?.id).toBe(task.id);
    });

    it('should return null for non-existent task', () => {
      const result = service.getTaskById('non-existent');
      expect(result).toBeNull();
    });

    it('should get all tasks', async () => {
      await service.createTask({ method: 'test1' });
      await service.createTask({ method: 'test2' });

      const allTasks = service.getAllTasks();

      expect(allTasks).toHaveLength(2);
    });

    it('should get tasks by status', async () => {
      const task1 = await service.createTask({ method: 'test1' });
      const task2 = await service.createTask({ method: 'test2' });
      
      service.updateTaskStatus(task1.id, TaskStatus.RUNNING);
      service.updateTaskStatus(task2.id, TaskStatus.COMPLETED);

      const runningTasks = service.getTasksByStatus(TaskStatus.RUNNING);
      const completedTasks = service.getTasksByStatus(TaskStatus.COMPLETED);

      expect(runningTasks).toHaveLength(1);
      expect(runningTasks[0]?.id).toBe(task1.id);
      expect(completedTasks).toHaveLength(1);
      expect(completedTasks[0]?.id).toBe(task2.id);
    });
  });

  describe('Task Cancellation', () => {
    it('should cancel pending task', async () => {
      const task = await service.createTask({ method: 'test-method' });

      const result = await service.cancelTask(task.id);

      expect(result).toBe(true);
      const cancelledTask = service.getTaskById(task.id);
      expect(cancelledTask).toBeNull(); // Should be cleaned up
    });

    it('should cancel running task', async () => {
      const task = await service.createTask({ method: 'test-method' });
      service.updateTaskStatus(task.id, TaskStatus.RUNNING);

      const result = await service.cancelTask(task.id);

      expect(result).toBe(true);
    });

    it('should not cancel completed task', async () => {
      const task = await service.createTask({ method: 'test-method' });
      service.updateTaskStatus(task.id, TaskStatus.COMPLETED);

      const result = await service.cancelTask(task.id);

      expect(result).toBe(false);
    });

    it('should not cancel failed task', async () => {
      const task = await service.createTask({ method: 'test-method' });
      service.updateTaskStatus(task.id, TaskStatus.FAILED);

      const result = await service.cancelTask(task.id);

      expect(result).toBe(false);
    });

    it('should return false for non-existent task', async () => {
      const result = await service.cancelTask('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('Task Cleanup', () => {
    it('should cleanup completed tasks', async () => {
      const task1 = await service.createTask({ method: 'test1' });
      const task2 = await service.createTask({ method: 'test2' });
      const task3 = await service.createTask({ method: 'test3' });

      service.updateTaskStatus(task1.id, TaskStatus.COMPLETED);
      service.updateTaskStatus(task2.id, TaskStatus.FAILED);
      // task3 remains pending

      const cleanedCount = await service.cleanupTasks();

      expect(cleanedCount).toBe(2);
      expect(service.getAllTasks()).toHaveLength(1);
      expect(service.getTaskById(task3.id)).toBeDefined();
    });

    it('should cleanup tasks older than specified date', async () => {
      const task1 = await service.createTask({ method: 'test1' });
      const task2 = await service.createTask({ method: 'test2' });

      service.updateTaskStatus(task1.id, TaskStatus.COMPLETED);
      service.updateTaskStatus(task2.id, TaskStatus.COMPLETED);

      // Manually set one task to be older
      const olderTask = service.getTaskById(task1.id);
      if (olderTask) {
        olderTask.updatedAt = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      }

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const cleanedCount = await service.cleanupTasks(oneHourAgo);

      expect(cleanedCount).toBe(1);
      expect(service.getAllTasks()).toHaveLength(1);
    });

    it('should identify stuck tasks', async () => {
      const task = await service.createTask({ 
        method: 'test-method',
        timeout: 100
      });
      service.updateTaskStatus(task.id, TaskStatus.RUNNING);

      // Manually set task to be old
      const runningTask = service.getTaskById(task.id);
      if (runningTask) {
        runningTask.updatedAt = new Date(Date.now() - 200); // 200ms ago
      }

      const stuckTasks = service.getStuckTasks();

      expect(stuckTasks).toHaveLength(1);
      expect(stuckTasks[0]?.id).toBe(task.id);
    });

    it('should cleanup stuck tasks', async () => {
      const task = await service.createTask({ 
        method: 'test-method',
        timeout: 100
      });
      service.updateTaskStatus(task.id, TaskStatus.RUNNING);

      // Manually set task to be old
      const runningTask = service.getTaskById(task.id);
      if (runningTask) {
        runningTask.updatedAt = new Date(Date.now() - 200); // 200ms ago
      }

      const cleanedCount = await service.cleanupStuckTasks();

      expect(cleanedCount).toBe(1);
      const failedTask = service.getTaskById(task.id);
      expect(failedTask?.status).toBe(TaskStatus.FAILED);
      expect(failedTask?.error?.message).toContain('stuck');
    });
  });

  describe('Task Metrics', () => {
    it('should calculate basic metrics', async () => {
      const task1 = await service.createTask({ method: 'test1' });
      const task2 = await service.createTask({ method: 'test2' });
      const task3 = await service.createTask({ method: 'test3' });

      service.updateTaskStatus(task1.id, TaskStatus.COMPLETED);
      service.updateTaskStatus(task2.id, TaskStatus.FAILED);
      service.updateTaskStatus(task3.id, TaskStatus.RUNNING);

      const metrics = service.getTaskMetrics();

      expect(metrics.requestCount).toBe(3);
      expect(metrics.errorCount).toBe(1);
      expect(metrics.activeTasks).toBe(1);
      expect(metrics.completedTasks).toBe(1);
      expect(metrics.uptime).toBeGreaterThan(0);
      expect(metrics.timestamp).toBeInstanceOf(Date);
    });

    it('should calculate average response time', async () => {
      const task = await service.createTask({ method: 'test-method' });
      
      // Manually set timing
      const createdTask = service.getTaskById(task.id);
      if (createdTask) {
        createdTask.createdAt = new Date(Date.now() - 1000); // 1 second ago
        createdTask.updatedAt = new Date(); // now
        createdTask.status = TaskStatus.COMPLETED;
        createdTask.result = 'test-result';
      }

      const metrics = service.getTaskMetrics();

      expect(metrics.averageResponseTime).toBeGreaterThan(900); // Should be around 1000ms
      expect(metrics.averageResponseTime).toBeLessThan(1100);
    });
  });

  describe('Task History', () => {
    it('should maintain task history when metrics enabled', async () => {
      service.updateConfig({ enableMetrics: true });
      
      const task = await service.createTask({ method: 'test-method' });
      service.updateTaskStatus(task.id, TaskStatus.COMPLETED);
      
      await service.cleanupTasks();

      const history = service.getTaskHistory();
      expect(history).toHaveLength(1);
      expect(history[0]?.id).toBe(task.id);
    });

    it('should not maintain task history when metrics disabled', async () => {
      service.updateConfig({ enableMetrics: false });
      
      const task = await service.createTask({ method: 'test-method' });
      service.updateTaskStatus(task.id, TaskStatus.COMPLETED);
      
      await service.cleanupTasks();

      const history = service.getTaskHistory();
      expect(history).toHaveLength(0);
    });

    it('should filter task history by agent ID', async () => {
      service.updateConfig({ enableMetrics: true });
      
      const task1 = await service.createTask({ 
        method: 'test1',
        params: { agentId: 'agent-1' }
      });
      const task2 = await service.createTask({ 
        method: 'test2',
        params: { agentId: 'agent-2' }
      });

      service.updateTaskStatus(task1.id, TaskStatus.COMPLETED);
      service.updateTaskStatus(task2.id, TaskStatus.COMPLETED);
      
      await service.cleanupTasks();

      const agent1History = service.getTaskHistory('agent-1');
      const agent2History = service.getTaskHistory('agent-2');

      expect(agent1History).toHaveLength(1);
      expect(agent1History[0]?.params?.agentId).toBe('agent-1');
      expect(agent2History).toHaveLength(1);
      expect(agent2History[0]?.params?.agentId).toBe('agent-2');
    });
  });

  describe('Service Lifecycle', () => {
    it('should cleanup resources on module destroy', async () => {
      const task1 = await service.createTask({ method: 'test1' });
      const task2 = await service.createTask({ method: 'test2' });
      
      service.updateTaskStatus(task1.id, TaskStatus.RUNNING);
      service.updateTaskStatus(task2.id, TaskStatus.PENDING);

      await service.onModuleDestroy();

      expect(service.getAllTasks()).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle task execution with no timeout', async () => {
      const task = await service.createTask({ 
        method: 'test-method',
        timeout: 0 // No timeout
      });

      const executedTask = await service.executeTaskWithLifecycle(task.id, mockExecutor);

      expect(executedTask.status).toBe(TaskStatus.COMPLETED);
    });

    it('should handle task history size limit', async () => {
      service.updateConfig({ enableMetrics: true });

      // Create and complete many tasks to test history limit
      for (let i = 0; i < 1005; i++) {
        const task = await service.createTask({ method: `test-${i}` });
        service.updateTaskStatus(task.id, TaskStatus.COMPLETED);
        await service.cleanupTasks();
      }

      const history = service.getTaskHistory();
      expect(history.length).toBeLessThanOrEqual(1000);
    });

    it('should handle concurrent task execution', async () => {
      const tasks = await Promise.all([
        service.createTask({ method: 'test1' }),
        service.createTask({ method: 'test2' }),
        service.createTask({ method: 'test3' })
      ]);

      const results = await Promise.all(
        tasks.map(task => service.executeTaskWithLifecycle(task.id, mockExecutor))
      );

      results.forEach(result => {
        expect(result.status).toBe(TaskStatus.COMPLETED);
      });
    });
  });
}); 