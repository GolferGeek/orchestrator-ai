// Continuation of remaining plan tests - to be merged

  it('should LIST plan versions via API (action: list)', async () => {
    const strictRequest = createPlanRequest('list', {});

    const response = await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(strictRequest)
      .expect(201);

    const body = response.body as PlanListResponse;

    expect(body.jsonrpc).toBe('2.0');
    expect(body.result.success).toBe(true);
    expect(body.result.mode).toBe('plan');
    expect(body.result.payload.content.plan).toBeDefined();
    expect(body.result.payload.content.versions).toBeInstanceOf(Array);
  });

  it('should EDIT the plan via API (action: edit)', async () => {
    const strictRequest = createPlanRequest(
      'edit',
      {
        content: '# Updated Plan\n\n1. Research deeply\n2. Write outline\n3. Get feedback',
      },
    );

    const response = await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(strictRequest)
      .expect(201);

    const body = response.body as PlanEditResponse;

    expect(body.jsonrpc).toBe('2.0');
    expect(body.result.success).toBe(true);
    expect(body.result.mode).toBe('plan');
    expect(body.result.payload.content.version.content).toContain('Updated Plan');
    expect(body.result.payload.content.version.createdByType).toBe('user');
  });

  it('should REFINE the plan via API (action: create again)', async () => {
    const strictRequest = createPlanRequest(
      'create',
      {
        title: 'AI Blog Post Plan',
        content: '# AI Blog Post Plan v2\n\n1. Research AI trends deeply\n2. Draft detailed outline\n3. Write comprehensive content\n4. Review and edit',
        format: 'markdown',
        llmSelection: {
          provider: 'ollama',
          model: 'llama3.2:1b',
        },
      },
      'Refine the plan with more details',
    );

    const response = await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(strictRequest)
      .expect(201);

    const body = response.body as PlanCreateResponse;

    expect(body.jsonrpc).toBe('2.0');
    expect(body.result.success).toBe(true);
    expect(body.result.mode).toBe('plan');
    expect(body.result.payload.content.version.versionNumber).toBe(2);
    expect(body.result.payload.content.version.content).toContain('deeply');

    versionId2 = body.result.payload.content.version.id;
  });

  it('should SET_CURRENT version via API (action: set_current)', async () => {
    const strictRequest = createPlanRequest('set_current', {
      versionId: versionId,
    });

    const response = await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(strictRequest)
      .expect(201);

    const body = response.body as PlanSetCurrentResponse;

    expect(body.jsonrpc).toBe('2.0');
    expect(body.result.success).toBe(true);
    expect(body.result.mode).toBe('plan');
    expect(body.result.payload.content.version.id).toBe(versionId);
    expect(body.result.payload.content.version.isCurrentVersion).toBe(true);
  });

  it('should COPY a version via API (action: copy_version)', async () => {
    const strictRequest = createPlanRequest('copy_version', {
      versionId: versionId2,
    });

    const response = await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(strictRequest)
      .expect(201);

    const body = response.body as PlanCopyVersionResponse;

    expect(body.jsonrpc).toBe('2.0');
    expect(body.result.success).toBe(true);
    expect(body.result.mode).toBe('plan');
    expect(body.result.payload.content.copiedVersion.content).toContain('deeply');
    expect(body.result.payload.content.copiedVersion.metadata?.copiedFromVersionId).toBe(versionId2);
  });

  it('should DELETE a specific version via API (action: delete_version)', async () => {
    const strictRequest = createPlanRequest('delete_version', {
      versionId: versionId2,
    });

    const response = await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(strictRequest)
      .expect(201);

    const body = response.body as PlanDeleteVersionResponse;

    expect(body.jsonrpc).toBe('2.0');
    expect(body.result.success).toBe(true);
    expect(body.result.mode).toBe('plan');
    expect(body.result.payload.content.message).toContain('deleted successfully');
  });

  it('should MERGE versions via API (action: merge_versions)', async () => {
    // First create another version to merge
    const editRequest = createPlanRequest('edit', {
      content: '# Merge Test Plan\n\nSome new content',
    });

    const editResponse = await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(editRequest)
      .expect(201);

    const editBody = editResponse.body as PlanEditResponse;
    const newVersionId = editBody.result.payload.content.version.id;

    const mergeRequest = createPlanRequest('merge_versions', {
      versionIds: [versionId, newVersionId],
      llmSelection: {
        provider: 'ollama',
        model: 'llama3.2:1b',
      },
    });

    const response = await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(mergeRequest)
      .expect(201);

    const body = response.body as PlanMergeVersionsResponse;

    expect(body.jsonrpc).toBe('2.0');
    expect(body.result.success).toBe(true);
    expect(body.result.mode).toBe('plan');
    expect(body.result.payload.content.mergedVersion.content).toBeDefined();
    expect(body.result.payload.content.mergedVersion.metadata?.mergedFromVersionIds).toBeDefined();
  });

  it('should DELETE the plan via API (action: delete)', async () => {
    const strictRequest = createPlanRequest('delete', {});

    const response = await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(strictRequest)
      .expect(201);

    const body = response.body as PlanDeleteResponse;

    expect(body.jsonrpc).toBe('2.0');
    expect(body.result.success).toBe(true);
    expect(body.result.mode).toBe('plan');
    expect(body.result.payload.content.message).toContain('deleted successfully');

    // Verify plan is gone - this should return error
    const readRequest = createPlanRequest('read', {});
    const readResponse = await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(readRequest);

    const errorBody = readResponse.body as StrictA2AErrorResponse;
    expect(errorBody.error).toBeDefined();
    expect(errorBody.error.code).toBeDefined();
  });

  it('should reject requests without auth token', async () => {
    const strictRequest = createPlanRequest('read', {});

    await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .send(strictRequest)
      .expect(401);
  });
