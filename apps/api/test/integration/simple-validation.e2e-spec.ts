import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Simple Integration Validation (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  }, 120000);

  afterAll(async () => {
    await app.close();
  });

  describe('Basic API Health', () => {
    it('should return healthy status', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
    });

    it('should show local models are connected', async () => {
      const response = await request(app.getHttpServer())
        .get('/llm/local-models/status')
        .expect(200);

      expect(response.body.connected).toBe(true);
      expect(response.body.models.length).toBeGreaterThan(0);
      
      console.log(`✅ Found ${response.body.models.length} local models loaded`);
    });

    it('should provide route recommendations', async () => {
      const response = await request(app.getHttpServer())
        .post('/llm/route-recommendation')
        .send({
          complexity: 'simple',
          dataClassification: 'internal',
          preferLocal: true,
        })
        .expect(200);

      expect(response.body.recommendedProvider).toBeDefined();
      expect(response.body.reasoning).toBeDefined();
      
      console.log(`✅ Routing recommendation: ${response.body.recommendedProvider} - ${response.body.reasoning}`);
    });
  });

  describe('Usage Tracking', () => {
    it('should provide usage statistics', async () => {
      const response = await request(app.getHttpServer())
        .get('/usage/stats')
        .expect(200);

      expect(response.body).toBeDefined();
      expect(typeof response.body.totalRequests).toBe('number');
      expect(typeof response.body.totalCost).toBe('number');
      
      console.log(`✅ Usage stats: ${response.body.totalRequests} requests, $${response.body.totalCost} total cost`);
    });
  });
});
