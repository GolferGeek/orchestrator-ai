it('should handle task processing for agents', async () => {
  // Wait for agent discovery
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const taskRequest = {
    jsonrpc: '2.0',
    method: 'handle_request',
    params: { prompt: 'Write a short blog post about artificial intelligence' },
    id: 1
  };

  const response = await request(app.getHttpServer())
    .post('/agents/specialists/blog_post/tasks')
    .send(taskRequest)
    .expect(200);

  expect(response.body).toBeDefined();
  expect(response.body.success).toBe(true);
  expect(response.body.response).toBeDefined();
  expect(typeof response.body.response).toBe('string');
  expect(response.body.response.length).toBeGreaterThan(50);
}, 15000); // Increased timeout to 15 seconds 