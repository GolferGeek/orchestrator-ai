-- Seed Phase 4 core agents (summarizer, marketing-swarm, supabase-agent)
BEGIN;

DO $$
DECLARE
  payload jsonb;
  ctx jsonb;
  cfg jsonb;
BEGIN
  -- Summarizer agent
  payload := jsonb_build_object(
    'metadata',
    jsonb_build_object(
      'name', 'summarizer',
      'displayName', 'Data Summarizer',
      'description', 'Analyzes structured data and produces executive-ready summaries.',
      'version', '0.1.0',
      'type', 'context',
      'tags', jsonb_build_array('analysis', 'reporting', 'finance')
    ),
    'communication',
    jsonb_build_object(
      'input_modes', jsonb_build_array('application/json', 'text/markdown', 'text/plain'),
      'output_modes', jsonb_build_array('text/markdown', 'application/json')
    ),
    'configuration',
    jsonb_build_object(
      'prompt_prefix',
      'You are a business analyst creating clear, actionable summaries. Highlight trends, risks, and recommendations grounded in the provided data.',
      'execution_capabilities',
      jsonb_build_object(
        'supports_converse', true,
        'supports_plan', false,
        'supports_build', true
      ),
      'deliverables',
      jsonb_build_object(
        'type', 'report',
        'format', 'markdown'
      )
    ),
    'prompts',
    jsonb_build_object(
      'system',
      'Synthesize the provided data into an executive summary. Call out key metrics, notable movements, and actionable recommendations.',
      'build',
      'Produce a markdown report with sections for Key Metrics, Insights, and Recommendations. Include bullet points and concise explanations.',
      'human',
      'List any clarifications or missing data required to complete the summary.'
    )
  );

  ctx := jsonb_build_object(
    'supported_modes', jsonb_build_array('converse', 'build'),
    'input_modes', jsonb_build_array('application/json', 'text/markdown'),
    'output_modes', jsonb_build_array('text/markdown', 'application/json'),
    'sections', jsonb_build_array('Key Metrics', 'Insights', 'Recommendations')
  );

  cfg := jsonb_build_object(
    'supported_modes', jsonb_build_array('converse', 'build'),
    'input_modes', jsonb_build_array('application/json', 'text/markdown'),
    'output_modes', jsonb_build_array('text/markdown', 'application/json'),
    'deliverable',
    jsonb_build_object(
      'type', 'report',
      'format', 'markdown',
      'titleTemplate', 'Summary Report - {{metadata.conversationId}}'
    ),
    'llm',
    jsonb_build_object(
      'provider', 'anthropic',
      'model', 'claude-3-5-sonnet-20241022',
      'temperature', 0.2
    ),
    'transforms',
    jsonb_build_object(
      'expected',
      jsonb_build_object(
        'input',
        jsonb_build_object(
          'content_type', 'application/json',
          'strict', false
        )
      ),
      'adapters',
      jsonb_build_object(
        'json_to_markdown',
        jsonb_build_object(
          'template', E'### Structured Input\n```json\n{{ json }}\n```'
        )
      )
    )
  );

  INSERT INTO public.agents (
    organization_slug,
    slug,
    display_name,
    description,
    agent_type,
    mode_profile,
    status,
    yaml,
    context,
    config
  )
  VALUES (
    'global',
    'summarizer',
    'Data Summarizer',
    'Analyzes structured inputs and produces executive-ready summaries.',
    'context',
    'context_full',
    'active',
    payload::text,
    ctx,
    cfg
  )
  ON CONFLICT (organization_slug, slug) DO UPDATE
  SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    agent_type = EXCLUDED.agent_type,
    mode_profile = EXCLUDED.mode_profile,
    status = EXCLUDED.status,
    yaml = payload::text,
    context = ctx,
    config = cfg,
    updated_at = NOW();

  -- Marketing Swarm agent
  payload := jsonb_build_object(
    'metadata',
    jsonb_build_object(
      'name', 'marketing-swarm',
      'displayName', 'Marketing Swarm',
      'description', 'Executes the marketing swarm n8n workflow to produce multi-channel campaign assets.',
      'version', '0.1.0',
      'type', 'api',
      'tags', jsonb_build_array('marketing', 'workflow', 'n8n')
    ),
    'communication',
    jsonb_build_object(
      'input_modes', jsonb_build_array('application/json', 'text/plain'),
      'output_modes', jsonb_build_array('application/json')
    ),
    'configuration',
    jsonb_build_object(
      'api',
      jsonb_build_object(
        'endpoint', 'http://localhost:5678/webhook/marketing-swarm',
        'method', 'POST',
        'headers', jsonb_build_object('Content-Type', 'application/json'),
        'authentication', jsonb_build_object('type', 'none'),
        'response_mapping',
        jsonb_build_object(
          'status_field', 'status',
          'result_field', 'results'
        )
      ),
      'execution_capabilities',
      jsonb_build_object(
        'supports_converse', false,
        'supports_plan', false,
        'supports_build', true
      ),
      'observability',
      jsonb_build_object(
        'redact_headers', jsonb_build_array('Authorization', 'X-Api-Key')
      )
    ),
    'prompts',
    jsonb_build_object(
      'system',
      'You trigger the marketing swarm n8n workflow. Ensure requests include campaign goals, personas, and CTA details.',
      'build',
      'Return a structured JSON payload containing blog, email, and social deliverables with messaging tuned to provided personas.'
    )
  );

  ctx := jsonb_build_object(
    'supported_modes', jsonb_build_array('build'),
    'input_modes', jsonb_build_array('application/json', 'text/plain'),
    'output_modes', jsonb_build_array('application/json'),
    'examples',
    jsonb_build_object(
      'payload',
      jsonb_build_object(
        'campaignName', 'Product Hunt Launch',
        'channels', jsonb_build_array('blog', 'email', 'social')
      )
    )
  );

  cfg := jsonb_build_object(
    'supported_modes', jsonb_build_array('build'),
    'input_modes', jsonb_build_array('application/json', 'text/plain'),
    'output_modes', jsonb_build_array('application/json'),
    'api',
    jsonb_build_object(
      'url', 'http://localhost:5678/webhook/marketing-swarm',
      'method', 'POST',
      'headers', jsonb_build_object('Content-Type', 'application/json'),
      'timeout', 60000,
      'failOnError', true,
      'responseMapping',
      jsonb_build_object(
        'statusField', 'status',
        'resultField', 'results'
      )
    ),
    'deliverable',
    jsonb_build_object(
      'type', 'marketing_bundle',
      'format', 'json'
    ),
    'retries',
    jsonb_build_object(
      'max', 2,
      'backoffMs', 2000
    ),
    'telemetry',
    jsonb_build_object(
      'redactHeaders', jsonb_build_array('Authorization', 'X-Api-Key')
    )
  );

  INSERT INTO public.agents (
    organization_slug,
    slug,
    display_name,
    description,
    agent_type,
    mode_profile,
    status,
    yaml,
    context,
    config
  )
  VALUES (
    'global',
    'marketing-swarm',
    'Marketing Swarm',
    'Executes the n8n marketing swarm workflow and returns campaign assets.',
    'api',
    'api_full',
    'active',
    payload::text,
    ctx,
    cfg
  )
  ON CONFLICT (organization_slug, slug) DO UPDATE
  SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    agent_type = EXCLUDED.agent_type,
    mode_profile = EXCLUDED.mode_profile,
    status = EXCLUDED.status,
    yaml = payload::text,
    context = ctx,
    config = cfg,
    updated_at = NOW();

  -- Supabase agent
  payload := jsonb_build_object(
    'metadata',
    jsonb_build_object(
      'name', 'supabase-agent',
      'displayName', 'Supabase Database Agent',
      'description', 'Interacts with Supabase via MCP tools to introspect schema, generate SQL, and analyze results.',
      'version', '0.1.0',
      'type', 'tool',
      'tags', jsonb_build_array('database', 'supabase', 'analytics')
    ),
    'communication',
    jsonb_build_object(
      'input_modes', jsonb_build_array('text/plain', 'application/json'),
      'output_modes', jsonb_build_array('application/json', 'text/markdown')
    ),
    'configuration',
    jsonb_build_object(
      'prompt_prefix',
      'You are a Supabase data specialist. Safely inspect schema, craft SQL, execute queries, and explain findings with clear business context.',
      'execution_capabilities',
      jsonb_build_object(
        'supports_converse', true,
        'supports_plan', false,
        'supports_build', true
      ),
      'mcp',
      jsonb_build_object(
        'server', 'supabase',
        'tools', jsonb_build_array('get-schema', 'generate-sql', 'execute-sql', 'analyze-results')
      ),
      'security',
      jsonb_build_object(
        'allowed_tables', jsonb_build_array('revenue', 'expenses', 'kpis', 'metrics'),
        'denied_operations', jsonb_build_array('DROP', 'TRUNCATE', 'ALTER')
      )
    ),
    'prompts',
    jsonb_build_object(
      'system',
      'You answer analytics questions about the Supabase warehouse. Validate assumptions, include SQL, and highlight anomalies.',
      'build',
      'Return an object with keys sql, rows, and summary. Use analyze-results to provide narrative insights for stakeholders.',
      'human',
      'List additional clarifications or approvals required before running potentially destructive operations.'
    ),
    'context',
    jsonb_build_object(
      'templates',
      jsonb_build_object(
        'analysis',
        jsonb_build_object(
          'sql', 'SELECT ...',
          'summary', 'Explain what the query returns and why it matters.',
          'next_steps', 'Recommend follow-up investigations.'
        )
      )
    )
  );

  ctx := jsonb_build_object(
    'supported_modes', jsonb_build_array('converse', 'build'),
    'input_modes', jsonb_build_array('text/plain', 'application/json'),
    'output_modes', jsonb_build_array('application/json', 'text/markdown'),
    'security',
    jsonb_build_object(
      'allowed_tables', jsonb_build_array('revenue', 'expenses', 'kpis', 'metrics'),
      'denied_operations', jsonb_build_array('DROP', 'TRUNCATE', 'ALTER')
    )
  );

  cfg := jsonb_build_object(
    'supported_modes', jsonb_build_array('converse', 'build'),
    'input_modes', jsonb_build_array('text/plain', 'application/json'),
    'output_modes', jsonb_build_array('application/json', 'text/markdown'),
    'tools',
    jsonb_build_array(
      'supabase/get-schema',
      'supabase/generate-sql',
      'supabase/execute-sql',
      'supabase/analyze-results'
    ),
    'toolParams',
    jsonb_build_object(
      'supabase/execute-sql',
      jsonb_build_object('max_rows', 500),
      'supabase/analyze-results',
      jsonb_build_object('provider', 'anthropic')
    ),
    'toolExecutionMode', 'sequential',
    'stopOnError', true,
    'deliverable',
    jsonb_build_object(
      'type', 'analysis',
      'format', 'json'
    ),
    'tooling',
    jsonb_build_object(
      'server', 'supabase',
      'allowedTables', jsonb_build_array('revenue', 'expenses', 'kpis', 'metrics'),
      'deniedOperations', jsonb_build_array('DROP', 'TRUNCATE', 'ALTER')
    )
  );

  INSERT INTO public.agents (
    organization_slug,
    slug,
    display_name,
    description,
    agent_type,
    mode_profile,
    status,
    yaml,
    context,
    config
  )
  VALUES (
    'global',
    'supabase-agent',
    'Supabase Database Agent',
    'Interacts with Supabase via MCP tools to introspect schema, generate SQL, and analyze results.',
    'tool',
    'tool_full',
    'active',
    payload::text,
    ctx,
    cfg
  )
  ON CONFLICT (organization_slug, slug) DO UPDATE
  SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    agent_type = EXCLUDED.agent_type,
    mode_profile = EXCLUDED.mode_profile,
    status = EXCLUDED.status,
    yaml = payload::text,
    context = ctx,
    config = cfg,
    updated_at = NOW();

  -- OpenAI image generator function agent
  payload := jsonb_build_object(
    'metadata',
    jsonb_build_object(
      'name', 'image-generator-openai',
      'displayName', 'OpenAI Image Generator',
      'description',
      'Generates images via OpenAI GPT-Image-1 with configurable quality tiers.',
      'version', '0.1.0',
      'type', 'function',
      'tags', jsonb_build_array('image', 'openai')
    ),
    'communication',
    jsonb_build_object(
      'input_modes', jsonb_build_array('text/plain', 'application/json'),
      'output_modes', jsonb_build_array('application/json')
    ),
    'configuration',
    jsonb_build_object(
      'function',
      jsonb_build_object(
        'language', 'javascript',
        'timeout_ms', 20000,
        'code',
        E'async function handler(input, ctx) {\n  const axios = ctx.require("axios");\n  const crypto = ctx.require("crypto");\n\n  const source = input || {};\n  const basePrompt = typeof source.prompt === "string" ? source.prompt : "";\n  const prompt =\n    basePrompt.trim() ||\n    (typeof source.userMessage === "string" ? source.userMessage.trim() : "");\n  if (!prompt) {\n    throw new Error("prompt is required");\n  }\n\n  const size =\n    typeof source.size === "string" && source.size.trim().length\n      ? source.size.trim()\n      : "1024x1024";\n  const quality =\n    typeof source.quality === "string" &&\n    source.quality.toLowerCase() === "hd"\n      ? "hd"\n      : "standard";\n  const rawCount = Number(source.count ?? source.n ?? 1);\n  const count = Math.max(\n    1,\n    Math.min(Number.isFinite(rawCount) ? rawCount : 1, 4)\n  );\n  const title =\n    typeof source.title === "string" && source.title.trim().length\n      ? source.title.trim()\n      : "OpenAI Image Set";\n  const negativePrompt =\n    typeof source.negativePrompt === "string"\n      ? source.negativePrompt.trim()\n      : undefined;\n\n  const apiKey = ctx.process.env.OPENAI_API_KEY;\n  if (!apiKey) {\n    throw new Error("OPENAI_API_KEY not configured");\n  }\n\n  const payload = {\n    model: "gpt-image-1",\n    prompt,\n    size,\n    quality,\n    n: count,\n    response_format: "b64_json",\n    user: ctx.userId || undefined,\n  };\n\n  if (negativePrompt) {\n    payload.negative_prompt = negativePrompt;\n  }\n\n  const response = await axios.post(\n    "https://api.openai.com/v1/images/generations",\n    payload,\n    {\n      headers: {\n        Authorization: `Bearer ${apiKey}`,\n        "Content-Type": "application/json",\n      },\n      timeout: 120000,\n    }\n  );\n\n  const images = Array.isArray(response.data?.data)\n    ? response.data.data\n    : [];\n\n  if (!images.length) {\n    throw new Error("OpenAI returned no images");\n  }\n\n  const attachments = [];\n  for (let index = 0; index < images.length; index++) {\n    const entry = images[index];\n    const b64 = entry?.b64_json;\n    if (!b64 || typeof b64 !== "string") {\n      continue;\n    }\n\n    const buffer = Buffer.from(b64, "base64");\n    if (!buffer.length) {\n      continue;\n    }\n\n    const hash = crypto.createHash("sha256").update(buffer).digest("hex");\n\n    const asset = await ctx.assets.saveBuffer({\n      buffer,\n      mime: "image/png",\n      filename: `openai-${Date.now()}-${index}.png`,\n      subpath: "generated",\n    });\n\n    attachments.push({\n      assetId: asset.id,\n      url: `/assets/${asset.id}`,\n      mime: "image/png",\n      size: buffer.length,\n      hash,\n      altText: prompt,\n      provider: "openai",\n      index,\n    });\n  }\n\n  if (!attachments.length) {\n    throw new Error("Failed to generate image attachments");\n  }\n\n  const deliverable = await ctx.deliverables.create({\n    title,\n    content: `Generated ${attachments.length} image(s) via OpenAI GPT-Image-1`,\n    format: "image/png",\n    type: "image",\n    attachments: { images: attachments },\n    metadata: {\n      provider: "openai",\n      model: "gpt-image-1",\n      prompt,\n      size,\n      quality,\n      count: attachments.length,\n      negativePrompt: negativePrompt || null,\n    },\n  });\n\n  return {\n    success: true,\n    provider: "openai",\n    deliverable,\n    images: attachments,\n    metadata: {\n      prompt,\n      size,\n      quality,\n      count: attachments.length,\n    },\n  };\n}\n\nmodule.exports = handler;'
      ),
      'execution_capabilities',
      jsonb_build_object(
        'supports_converse', false,
        'supports_plan', false,
        'supports_build', true
      )
    ),
    'prompts',
    jsonb_build_object(
      'system',
      'Generate production-ready images using OpenAI GPT-Image-1. Respect safety policies and return structured metadata.'
    )
  );

  ctx := jsonb_build_object(
    'supported_modes', jsonb_build_array('build'),
    'input_modes', jsonb_build_array('text/plain', 'application/json'),
    'output_modes', jsonb_build_array('application/json'),
    'defaults', jsonb_build_object('size', '1024x1024', 'quality', 'standard')
  );

  cfg := jsonb_build_object(
    'supported_modes', jsonb_build_array('build'),
    'input_modes', jsonb_build_array('text/plain', 'application/json'),
    'output_modes', jsonb_build_array('application/json'),
    'function', jsonb_build_object('provider', 'openai', 'timeout_ms', 20000),
    'deliverable', jsonb_build_object('type', 'image', 'format', 'image/png')
  );

  INSERT INTO public.agents (
    organization_slug,
    slug,
    display_name,
    description,
    agent_type,
    mode_profile,
    status,
    yaml,
    context,
    config
  )
  VALUES (
    'global',
    'image-generator-openai',
    'OpenAI Image Generator',
    'Generates images via OpenAI GPT-Image-1 with configurable quality tiers.',
    'function',
    'function_full',
    'active',
    payload::text,
    ctx,
    cfg
  )
  ON CONFLICT (organization_slug, slug) DO UPDATE
  SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    agent_type = EXCLUDED.agent_type,
    mode_profile = EXCLUDED.mode_profile,
    status = EXCLUDED.status,
    yaml = payload::text,
    context = ctx,
    config = cfg,
    updated_at = NOW();

  -- Google image generator function agent
  payload := jsonb_build_object(
    'metadata',
    jsonb_build_object(
      'name', 'image-generator-google',
      'displayName', 'Google Imagen Generator',
      'description', 'Generates images via Google Imagen 4 Fast API.',
      'version', '0.1.0',
      'type', 'function',
      'tags', jsonb_build_array('image', 'google', 'imagen')
    ),
    'communication',
    jsonb_build_object(
      'input_modes', jsonb_build_array('text/plain', 'application/json'),
      'output_modes', jsonb_build_array('application/json')
    ),
    'configuration',
    jsonb_build_object(
      'function',
      jsonb_build_object(
        'language', 'javascript',
        'timeout_ms', 20000,
        'code',
        E'async function handler(input, ctx) {\n  const axios = ctx.require("axios");\n  const crypto = ctx.require("crypto");\n\n  const source = input || {};\n  const basePrompt = typeof source.prompt === "string" ? source.prompt : "";\n  const prompt =\n    basePrompt.trim() ||\n    (typeof source.userMessage === "string" ? source.userMessage.trim() : "");\n  if (!prompt) {\n    throw new Error("prompt is required");\n  }\n\n  const rawCount = Number(source.count ?? source.n ?? 1);\n  const count = Math.max(\n    1,\n    Math.min(Number.isFinite(rawCount) ? rawCount : 1, 4)\n  );\n\n  const projectId = ctx.process.env.GOOGLE_PROJECT_ID;\n  const accessToken = ctx.process.env.GOOGLE_ACCESS_TOKEN;\n  const location =\n    ctx.process.env.GOOGLE_REGION && ctx.process.env.GOOGLE_REGION.trim().length\n      ? ctx.process.env.GOOGLE_REGION.trim()\n      : "us-central1";\n\n  if (!projectId || !accessToken) {\n    throw new Error("GOOGLE_PROJECT_ID and GOOGLE_ACCESS_TOKEN required");\n  }\n\n  const endpoint = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagen-4.0-fast-generate-001:predict`;\n\n  const response = await axios.post(\n    endpoint,\n    {\n      instances: [{ prompt }],\n      parameters: { sampleCount: count },\n    },\n    {\n      headers: {\n        Authorization: `Bearer ${accessToken}`,\n        "Content-Type": "application/json",\n      },\n      timeout: 120000,\n    }\n  );\n\n  const predictions = Array.isArray(response.data?.predictions)\n    ? response.data.predictions\n    : [];\n\n  if (!predictions.length) {\n    throw new Error("Google Imagen returned no predictions");\n  }\n\n  const attachments = [];\n  for (let index = 0; index < predictions.length; index++) {\n    const prediction = predictions[index] || {};\n    const base64 =\n      prediction.bytesBase64Encoded ||\n      prediction.imageBytes ||\n      prediction.data;\n    if (!base64 || typeof base64 !== "string") {\n      continue;\n    }\n\n    const buffer = Buffer.from(base64, "base64");\n    if (!buffer.length) {\n      continue;\n    }\n\n    const mime =\n      typeof prediction.mimeType === "string" && prediction.mimeType.length\n        ? prediction.mimeType\n        : "image/png";\n    const extension = mime.split("/")[1] || "png";\n    const hash = crypto.createHash("sha256").update(buffer).digest("hex");\n\n    const asset = await ctx.assets.saveBuffer({\n      buffer,\n      mime,\n      filename: `google-${Date.now()}-${index}.${extension}`,\n      subpath: "generated",\n    });\n\n    attachments.push({\n      assetId: asset.id,\n      url: `/assets/${asset.id}`,\n      mime,\n      size: buffer.length,\n      hash,\n      altText: prompt,\n      provider: "google",\n      index,\n    });\n  }\n\n  if (!attachments.length) {\n    throw new Error("Failed to generate image attachments");\n  }\n\n  const title =\n    typeof source.title === "string" && source.title.trim().length\n      ? source.title.trim()\n      : "Google Imagen Set";\n\n  const deliverable = await ctx.deliverables.create({\n    title,\n    content: `Generated ${attachments.length} image(s) via Google Imagen 4`,\n    format: attachments[0]?.mime || "image/png",\n    type: "image",\n    attachments: { images: attachments },\n    metadata: {\n      provider: "google",\n      model: "imagen-4.0-fast",\n      prompt,\n      count: attachments.length,\n      location,\n    },\n  });\n\n  return {\n    success: true,\n    provider: "google",\n    deliverable,\n    images: attachments,\n    metadata: {\n      prompt,\n      count: attachments.length,\n      location,\n    },\n  };\n}\n\nmodule.exports = handler;'
      ),
      'execution_capabilities',
      jsonb_build_object(
        'supports_converse', false,
        'supports_plan', false,
        'supports_build', true
      )
    ),
    'prompts',
    jsonb_build_object(
      'system',
      'Generate images via Google Imagen 4 Fast. Optimise prompts for business storytelling and keep metadata concise.'
    )
  );

  ctx := jsonb_build_object(
    'supported_modes', jsonb_build_array('build'),
    'input_modes', jsonb_build_array('text/plain', 'application/json'),
    'output_modes', jsonb_build_array('application/json'),
    'defaults', jsonb_build_object('size', '1024x1024')
  );

  cfg := jsonb_build_object(
    'supported_modes', jsonb_build_array('build'),
    'input_modes', jsonb_build_array('text/plain', 'application/json'),
    'output_modes', jsonb_build_array('application/json'),
    'function', jsonb_build_object('provider', 'google', 'timeout_ms', 20000),
    'deliverable', jsonb_build_object('type', 'image', 'format', 'image/png')
  );

  INSERT INTO public.agents (
    organization_slug,
    slug,
    display_name,
    description,
    agent_type,
    mode_profile,
    status,
    yaml,
    context,
    config
  )
  VALUES (
    'global',
    'image-generator-google',
    'Google Imagen Generator',
    'Generates images via Google Imagen 4 Fast API.',
    'function',
    'function_full',
    'active',
    payload::text,
    ctx,
    cfg
  )
  ON CONFLICT (organization_slug, slug) DO UPDATE
  SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    agent_type = EXCLUDED.agent_type,
    mode_profile = EXCLUDED.mode_profile,
    status = EXCLUDED.status,
    yaml = payload::text,
    context = ctx,
    config = cfg,
    updated_at = NOW();

  -- Image orchestrator agent
  payload := jsonb_build_object(
    'metadata',
    jsonb_build_object(
      'name', 'image-orchestrator',
      'displayName', 'Image Orchestrator',
      'description', 'Coordinates image generation across multiple providers and compares outputs.',
      'version', '0.1.0',
      'type', 'orchestrator',
      'tags', jsonb_build_array('image', 'orchestrator')
    ),
    'communication',
    jsonb_build_object(
      'input_modes', jsonb_build_array('text/plain', 'application/json'),
      'output_modes', jsonb_build_array('application/json', 'text/markdown')
    ),
    'configuration',
    jsonb_build_object(
      'orchestration',
      jsonb_build_object(
        'available_orchestrations', jsonb_build_array('image-comparison'),
        'available_agents', jsonb_build_array('image-generator-openai', 'image-generator-google')
      ),
      'execution_capabilities',
      jsonb_build_object(
        'supports_converse', true,
        'supports_plan', true,
        'supports_build', true,
        'supports_orchestration', true
      )
    ),
    'prompts',
    jsonb_build_object(
      'system',
      'Compare image generations across providers, highlight differences, and recommend the best asset for the request.',
      'build',
      'Summarize the outputs from delegated image generators and provide a recommendation table.'
    )
  );

  ctx := jsonb_build_object(
    'supported_modes', jsonb_build_array('converse', 'plan', 'build'),
    'input_modes', jsonb_build_array('text/plain', 'application/json'),
    'output_modes', jsonb_build_array('application/json', 'text/markdown'),
    'available_orchestrations', jsonb_build_array('image-comparison'),
    'available_agents', jsonb_build_array('image-generator-openai', 'image-generator-google')
  );

  cfg := jsonb_build_object(
    'supported_modes', jsonb_build_array('converse', 'plan', 'build'),
    'orchestration',
    jsonb_build_object(
      'available_orchestrations', jsonb_build_array('image-comparison'),
      'available_agents', jsonb_build_array('image-generator-openai', 'image-generator-google')
    )
  );

  INSERT INTO public.agents (
    organization_slug,
    slug,
    display_name,
    description,
    agent_type,
    mode_profile,
    status,
    yaml,
    context,
    config
  )
  VALUES (
    'global',
    'image-orchestrator',
    'Image Orchestrator',
    'Coordinates image generation across multiple providers and compares outputs.',
    'orchestrator',
    'orchestrator_full',
    'active',
    payload::text,
    ctx,
    cfg
  )
  ON CONFLICT (organization_slug, slug) DO UPDATE
  SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    agent_type = EXCLUDED.agent_type,
    mode_profile = EXCLUDED.mode_profile,
    status = EXCLUDED.status,
    yaml = payload::text,
    context = ctx,
    config = cfg,
    updated_at = NOW();

  -- Finance manager orchestrator agent
  payload := jsonb_build_object(
    'metadata',
    jsonb_build_object(
      'name', 'finance-manager',
      'displayName', 'Finance Manager',
      'description', 'Coordinates financial analysis orchestrations and aggregates results.',
      'version', '0.1.0',
      'type', 'orchestrator',
      'tags', jsonb_build_array('finance', 'analytics')
    ),
    'communication',
    jsonb_build_object(
      'input_modes', jsonb_build_array('text/plain', 'application/json'),
      'output_modes', jsonb_build_array('application/json', 'text/markdown')
    ),
    'configuration',
    jsonb_build_object(
      'orchestration',
      jsonb_build_object(
        'available_orchestrations', jsonb_build_array('kpi-tracking', 'revenue-analysis', 'expense-report'),
        'available_agents', jsonb_build_array('supabase-agent', 'summarizer')
      ),
      'execution_capabilities',
      jsonb_build_object(
        'supports_converse', true,
        'supports_plan', true,
        'supports_build', true,
        'supports_orchestration', true
      )
    ),
    'prompts',
    jsonb_build_object(
      'system',
      'Coordinate financial orchestrations, validate database queries via Supabase Agent, and synthesize findings with the Summarizer agent.',
      'build',
      'Aggregate outputs from delegated steps and present an executive-ready financial brief.'
    )
  );

  ctx := jsonb_build_object(
    'supported_modes', jsonb_build_array('converse', 'plan', 'build'),
    'input_modes', jsonb_build_array('text/plain', 'application/json'),
    'output_modes', jsonb_build_array('application/json', 'text/markdown'),
    'available_orchestrations',
    jsonb_build_array('kpi-tracking', 'revenue-analysis', 'expense-report'),
    'available_agents', jsonb_build_array('supabase-agent', 'summarizer')
  );

  cfg := jsonb_build_object(
    'supported_modes', jsonb_build_array('converse', 'plan', 'build'),
    'orchestration',
    jsonb_build_object(
      'available_orchestrations',
      jsonb_build_array('kpi-tracking', 'revenue-analysis', 'expense-report'),
      'available_agents', jsonb_build_array('supabase-agent', 'summarizer')
    )
  );

  INSERT INTO public.agents (
    organization_slug,
    slug,
    display_name,
    description,
    agent_type,
    mode_profile,
    status,
    yaml,
    context,
    config
  )
  VALUES (
    'global',
    'finance-manager',
    'Finance Manager',
    'Coordinates financial analysis orchestrations and aggregates results.',
    'orchestrator',
    'orchestrator_full',
    'active',
    payload::text,
    ctx,
    cfg
  )
  ON CONFLICT (organization_slug, slug) DO UPDATE
  SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    agent_type = EXCLUDED.agent_type,
    mode_profile = EXCLUDED.mode_profile,
    status = EXCLUDED.status,
    yaml = payload::text,
    context = ctx,
    config = cfg,
    updated_at = NOW();
END$$;

COMMIT;
