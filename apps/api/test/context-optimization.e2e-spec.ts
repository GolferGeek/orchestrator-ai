import * as request from 'supertest';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Utility to build a long conversation history for optimization
function buildHistory(count: number) {
  const items = [] as Array<{ role: string; content: string; timestamp: string }>;
  for (let i = 0; i < count; i++) {
    items.push({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message number ${i} about quarterly plan and deliverables for feature X ${'x'.repeat(200)}`,
      timestamp: new Date(Date.now() - (count - i) * 1000).toISOString(),
    });
  }
  return items;
}

describe('Context Optimization (e2e via external API on :4000)', () => {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:4000';
  let authToken: string | null = null;

  beforeAll(async () => {
    // Load env from multiple possible locations without importing 'path'
    // Try root.env, then .env at various parents
    const tryPaths = [
      '../../../root.env',
      '../../../.env',
      '../../.env',
      '../.env',
      '.env',
    ];
    for (const p of tryPaths) {
      dotenv.config({ path: p as any });
    }

    const testEmail = process.env.SUPABASE_TEST_EMAIL || process.env.TEST_EMAIL || '';
    const testPassword = process.env.SUPABASE_TEST_PASSWORD || process.env.TEST_PASSWORD || '';

    if (testEmail && testPassword) {
      try {
        const loginRes = await request(baseUrl)
          .post('/auth/login')
          .send({ email: testEmail, password: testPassword });
        if (loginRes.status === 200) {
          authToken = loginRes.body?.access_token || loginRes.body?.accessToken || null;
        }
      } catch (e) {
        const supabaseUrl = process.env.SUPABASE_URL as string;
        const supabaseAnonKey = process.env.SUPABASE_ANON_KEY as string;
        if (supabaseUrl && supabaseAnonKey) {
          const client = createClient(supabaseUrl, supabaseAnonKey);
          const { data } = await client.auth.signInWithPassword({ email: testEmail, password: testPassword });
          authToken = data.session?.access_token || null;
        }
      }
    }
  });

  it('optimizes long conversation history and emits metrics', async () => {
    // Ensure optimization is enabled for the test
    process.env.CONTEXT_OPTIMIZATION_ENABLED = 'true';

    const longHistory = buildHistory(2000); // Much larger to exceed 80% of 80k token budget

    const agentType = 'orchestrator';
    const agentName = 'ceo_orchestrator';

    const body = {
      method: 'processTask',
      prompt: 'Please help me plan the next steps.',
      conversationHistory: longHistory,
      params: {
        workProduct: { type: 'deliverable', id: '00000000-0000-0000-0000-000000000001' },
      },
      executionMode: 'immediate',
    };

    // Call dynamic agent endpoint
    const agentReq = request(baseUrl)
      .post(`/agents/${agentType}/${agentName}/tasks`)
      .send(body);
    if (authToken) agentReq.set('Authorization', `Bearer ${authToken}`);
    const res = await agentReq;
    if (res.status !== 200) {
      // eslint-disable-next-line no-console
      console.error('Agent task response:', res.status, res.text);
    }
    expect(res.status).toBe(200);

    // Validate response shape
    expect(res.body).toHaveProperty('taskId');
    expect(res.body).toHaveProperty('status');

    // Fetch rollup metrics
    const metrics = await request(baseUrl).get('/metrics/context/rollup');
    if (metrics.status !== 200) {
      // eslint-disable-next-line no-console
      console.error('Metrics response:', metrics.status, metrics.text);
    }
    expect(metrics.status).toBe(200);

    expect(metrics.body).toHaveProperty('events');
    expect(metrics.body.events).toBeGreaterThanOrEqual(1);
    expect(metrics.body).toHaveProperty('optimizationRate');
  }, 15000);
});


