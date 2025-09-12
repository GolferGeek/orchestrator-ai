import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../../src/app.module';
import { LocalModelStatusService } from '../../../../src/llms/local-model-status.service';

describe('Local Model Status (e2e)', () => {
  let app: INestApplication;
  let localModelStatusService: LocalModelStatusService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    localModelStatusService = moduleFixture.get<LocalModelStatusService>(LocalModelStatusService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should detect Ollama connection status', async () => {
    const status = await localModelStatusService.getOllamaStatus();
    
    expect(status).toBeDefined();
    expect(typeof status.connected).toBe('boolean');
    expect(Array.isArray(status.models)).toBe(true);
    
    console.log(`✅ Ollama connected: ${status.connected}, models: ${status.models.length}`);
  });
});
