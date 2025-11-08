-- Seed Data Export
-- Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
-- Tables: agents, providers, models

-- Clear existing data
TRUNCATE TABLE public.agents CASCADE;
TRUNCATE TABLE public.providers CASCADE;
TRUNCATE TABLE public.models CASCADE;

--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: agents; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.agents (id, organization_slug, slug, display_name, description, agent_type, mode_profile, version, status, yaml, context, created_at, updated_at, function_code, plan_structure, deliverable_structure, io_schema) VALUES ('9714abb1-e100-4616-a70e-a59c26b32427', 'demo', 'blog_post_writer', 'Blog Post Writer', 'Creates SEO-friendly blog posts in Markdown format with clear structure and helpful tone. Supports plan-build-converse mode architecture.', 'context', 'plan-build-converse', '1.0', 'active', 'name: blog_post_writer
display_name: Blog Post Writer
description: Creates SEO-friendly blog posts in Markdown format with clear structure and helpful tone. Supports plan-build-converse mode architecture.
agent_type: context
mode_profile: plan-build-converse
version: "1.0"
status: active
reports_to: marketing_manager_orchestrator

system_prompt: |
  You are a professional blog post writer specializing in SEO-friendly content.
  
  When creating a plan for a blog post, structure it with:
  - Title & Topic (working title, target topic, unique angle)
  - Audience & Purpose (target audience, primary goal, reader takeaway)
  - Content Strategy (word count, SEO keywords, key points to cover)
  
  When building a deliverable, create:
  - Engaging introduction that hooks the reader
  - Clear section headings (H2, H3) for scanability
  - Actionable content with examples and insights
  - Strong conclusion with clear call-to-action
  
  When conversing, provide helpful suggestions for improving blog content,
  clarify requirements, and answer questions about content strategy.

modes:
  plan:
    enabled: true
    actions:
      - create
      - read
      - list
      - edit
      - set_current
      - delete_version
      - merge_versions
      - copy_version
      - delete

  build:
    enabled: true
    actions:
      - create
      - read
      - list
      - edit
      - rerun
      - set_current
      - delete_version
      - merge_versions
      - copy_version
      - delete

  converse:
    enabled: true

llm:
  provider: ollama
  model: llama3.2:1b
  temperature: 0.7
', '{"input_modes": ["text/plain"], "output_modes": ["text/markdown", "application/json"], "supported_modes": ["plan", "build", "converse"]}', '2025-10-26 22:38:36.474372+00', '2025-10-26 22:38:36.474372+00', NULL, '"# Blog Post Plan\n\n## Title & Topic\n- **Working Title**: [Draft title for the blog post]\n- **Target Topic**: [Main topic or theme]\n- **Unique Angle**: [What makes this post different or interesting]\n\n## Audience & Purpose\n- **Target Audience**: [Description of who will read this]\n- **Primary Goal**: [inform | persuade | entertain | educate]\n- **Reader Takeaway**: [What should readers learn or do after reading]\n\n## Content Strategy\n- **Word Count Target**: [Target number, e.g., 1200 words]\n- **SEO Keywords**: [List 3-5 keywords to optimize for]\n- **Key Points**: [3-5 main ideas to cover]\n\n## Structure & Outline\n- **Introduction**: [Hook and overview]\n- **Main Sections**: \n  - Section 1: [Heading and key points]\n  - Section 2: [Heading and key points]\n  - Section 3: [Heading and key points]\n- **Conclusion**: [Summary and call-to-action]\n\n## Notes\n[Any additional context, requirements, or considerations]"', '{"type": "object", "required": ["title", "content", "metadata", "excerpt"], "properties": {"title": {"type": "string", "description": "Final blog post title"}, "content": {"type": "string", "description": "Full blog post content in Markdown format"}, "excerpt": {"type": "string", "description": "Short excerpt or description (160 chars for SEO)"}, "metadata": {"type": "object", "properties": {"tags": {"type": "array", "items": {"type": "string"}}, "categories": {"type": "array", "items": {"type": "string"}}, "word_count": {"type": "number"}, "seo_keywords": {"type": "array", "items": {"type": "string"}}, "reading_time_minutes": {"type": "number"}}}}}', '{"input": {"type": "object", "required": ["topic"], "properties": {"topic": {"type": "string", "description": "Blog post topic or title"}, "word_count": {"type": "number", "description": "Target word count (default: 1200)"}, "requirements": {"type": "string", "description": "Additional requirements, style guidelines, or constraints"}, "seo_keywords": {"type": "array", "items": {"type": "string"}, "description": "Optional SEO keywords to target"}, "target_audience": {"type": "string", "description": "Description of target audience"}}}, "output": {"type": "object", "required": ["status", "blog_post"], "properties": {"notes": {"type": "string", "description": "Any notes or recommendations for improvement"}, "status": {"enum": ["success", "needs_revision", "failed"], "type": "string"}, "blog_post": {"type": "object", "description": "Blog post based on deliverable_structure"}}}}');
INSERT INTO public.agents (id, organization_slug, slug, display_name, description, agent_type, mode_profile, version, status, yaml, context, created_at, updated_at, function_code, plan_structure, deliverable_structure, io_schema) VALUES ('953cae10-6023-413e-a487-99ee6b03fcc0', 'demo', 'marketing_manager_orchestrator', 'Marketing Manager', 'Marketing orchestrator that coordinates blog writing, SEO optimization, and social media content creation. Delegates work to specialized marketing agents.', 'orchestrator', 'orchestrator_full', '1.0', 'active', 'name: marketing_manager_orchestrator
display_name: Marketing Manager
description: Marketing orchestrator that coordinates blog writing, SEO optimization, and social media content creation. Delegates work to specialized marketing agents.
agent_type: orchestrator
mode_profile: orchestrator_full
version: "1.0"
status: active

system_prompt: |
  You are a Marketing Manager orchestrator responsible for coordinating marketing content creation.
  
  You manage a team of specialized agents:
  - blog_post_writer: Creates SEO-friendly blog posts
  - seo_writer: Optimizes content for search engines (to be added)
  - social_content_writer: Creates social media content (to be added)
  
  When given a marketing task, analyze requirements and delegate appropriately to your team.
  Create plans that coordinate multiple agents when needed.
  Review deliverables and ensure quality before finalizing.

modes:
  orchestrate:
    enabled: true
    actions:
      - create
      - read
      - list
      - edit
      - execute
      - approve
      - reject
      - cancel
      - delete

  plan:
    enabled: true
    actions:
      - create
      - read
      - list
      - edit

  converse:
    enabled: true

llm:
  provider: ollama
  model: llama3.2:3b
  temperature: 0.7
', '{"input_modes": ["text/plain", "application/json"], "output_modes": ["text/markdown", "application/json"], "supported_modes": ["orchestrate", "plan", "converse"]}', '2025-10-26 22:38:38.961042+00', '2025-10-26 22:38:38.961042+00', NULL, '{"type": "object", "required": ["title", "objective", "tasks"], "properties": {"tasks": {"type": "array", "items": {"type": "object", "properties": {"id": {"type": "string"}, "status": {"enum": ["pending", "in_progress", "completed"], "type": "string"}, "assigned_to": {"type": "string"}, "description": {"type": "string"}, "dependencies": {"type": "array", "items": {"type": "string"}}}}}, "title": {"type": "string", "description": "Plan title"}, "strategy": {"type": "object", "properties": {"approach": {"type": "string", "description": "Overall marketing approach"}, "channels": {"type": "array", "items": {"type": "string"}, "description": "Marketing channels to use (blog, social, email, etc.)"}, "timeline": {"type": "string", "description": "Expected timeline"}}}, "objective": {"type": "string", "description": "Marketing objective to accomplish"}}}', '{"type": "object", "required": ["campaign_name", "deliverables", "summary"], "properties": {"summary": {"type": "string", "description": "Summary of the campaign deliverables"}, "deliverables": {"type": "array", "items": {"type": "object", "properties": {"type": {"type": "string", "description": "Type of deliverable (blog_post, social_post, etc.)"}, "content": {"type": "string", "description": "The actual content"}, "metadata": {"type": "object", "description": "Additional metadata"}, "created_by": {"type": "string", "description": "Agent that created this"}}}}, "campaign_name": {"type": "string", "description": "Name of the marketing campaign"}}}', '{"input": {"type": "object", "required": ["task_type", "requirements"], "properties": {"deadline": {"type": "string", "format": "date-time", "description": "Optional deadline"}, "task_type": {"enum": ["blog_campaign", "social_campaign", "content_review", "general_marketing"], "type": "string", "description": "Type of marketing task"}, "requirements": {"type": "string", "description": "Detailed requirements for the marketing task"}, "target_audience": {"type": "string", "description": "Target audience description"}}}, "output": {"type": "object", "required": ["status", "result"], "properties": {"result": {"type": "object", "description": "Result based on deliverable_structure"}, "status": {"enum": ["success", "partial", "failed"], "type": "string"}, "agents_used": {"type": "array", "items": {"type": "string"}, "description": "List of agents that contributed"}}}}');
INSERT INTO public.agents (id, organization_slug, slug, display_name, description, agent_type, mode_profile, version, status, yaml, context, created_at, updated_at, function_code, plan_structure, deliverable_structure, io_schema) VALUES ('3f6e0291-7c63-4078-9ddd-05d1266ebee1', 'demo', 'marketing-swarm-n8n', 'Marketing Swarm N8N', 'API agent that calls n8n webhook for marketing campaign swarm processing', 'api', 'api_full', NULL, 'active', '
{
    "metadata": {
        "name": "marketing-swarm-n8n",
        "displayName": "Marketing Swarm N8N",
        "description": "API agent that calls n8n webhook for marketing campaign swarm processing",
        "version": "0.1.0",
        "type": "api"
    },
    "configuration": {
        "api": {
            "endpoint": "http://localhost:5678/webhook/marketing-swarm-flexible",
            "method": "POST",
            "headers": {
                "Content-Type": "application/json"
            },
            "body": {
                "taskId": "{{taskId}}",
                "conversationId": "{{conversationId}}",
                "userId": "{{userId}}",
                "announcement": "{{userMessage}}",
                "statusWebhook": "http://host.docker.internal:7100/webhooks/status",
                "provider": "{{payload.provider}}",
                "model": "{{payload.model}}"
            },
            "authentication": {
                "type": "none"
            },
            "response_mapping": {
                "status_field": "status",
                "result_field": "payload"
            },
            "timeout": 120000
        },
        "deliverable": {
            "format": "markdown",
            "type": "marketing-campaign"
        },
        "execution_capabilities": {
            "supports_converse": false,
            "supports_plan": false,
            "supports_build": true
        }
    }
}
', '{"input_modes": ["application/json"], "output_modes": ["application/json"], "execution_modes": ["immediate", "polling", "websocket"], "supported_modes": ["build"]}', '2025-10-26 22:38:41.335331+00', '2025-10-26 22:38:41.335331+00', NULL, NULL, NULL, NULL);
INSERT INTO public.agents (id, organization_slug, slug, display_name, description, agent_type, mode_profile, version, status, yaml, context, created_at, updated_at, function_code, plan_structure, deliverable_structure, io_schema) VALUES ('4b0b626c-19bd-41d7-a2bc-03fa0620ff3f', 'demo', 'supabase-agent', 'Supabase Tool Agent', 'Wraps the Supabase MCP to inspect schema, generate SQL, execute queries (read-only), and analyze results.', 'tool', 'tool_full', '0.1.0', 'active', '{
  "metadata": {
    "name": "supabase-agent",
    "displayName": "Supabase Tool Agent",
    "description": "Wraps Supabase MCP for schema, SQL generation, safe execution, and results analysis.",
    "version": "0.1.0",
    "type": "tool"
  },
  "communication": {
    "input_modes": [
      "text/plain",
      "application/json"
    ],
    "output_modes": [
      "application/json",
      "text/markdown"
    ]
  },
  "configuration": {
    "prompt_prefix": "You are a Supabase data specialist. Use MCP tools to safely inspect schema, craft SQL, execute read-only queries, and explain findings.",
    "execution_capabilities": {
      "supports_converse": false,
      "supports_plan": false,
      "supports_build": true
    },
    "mcp": {
      "server": "supabase"
    },
    "tools": [
      "supabase/get-schema",
      "supabase/generate-sql",
      "supabase/execute-sql",
      "supabase/analyze-results"
    ],
    "toolParams": {
      "supabase/generate-sql": {
        "query": "{{userMessage}}",
        "max_rows": 100
      },
      "supabase/execute-sql": {
        "max_rows": 1000
      },
      "supabase/analyze-results": {
        "analysis_prompt": "Summarize for stakeholders"
      }
    },
    "toolExecutionMode": "sequential",
    "stopOnError": true,
    "security": {
      "denied_operations": [
        "DROP",
        "TRUNCATE",
        "ALTER",
        "DELETE",
        "UPDATE"
      ],
      "allowed_tables": [
        "agent_conversations",
        "kpi_data",
        "kpi_metrics",
        "users"
      ]
    },
    "deliverable": {
      "format": "markdown",
      "type": "data-analysis"
    }
  },
  "context": {
    "input_modes": [
      "text/plain",
      "application/json"
    ],
    "output_modes": [
      "application/json",
      "text/markdown"
    ],
    "supported_modes": [
      "build"
    ]
  }
}', '{"input_modes": ["text/plain", "application/json"], "output_modes": ["application/json", "text/markdown"], "supported_modes": ["build"]}', '2025-10-26 22:38:43.880266+00', '2025-10-26 22:38:43.880266+00', NULL, NULL, NULL, NULL);
INSERT INTO public.agents (id, organization_slug, slug, display_name, description, agent_type, mode_profile, version, status, yaml, context, created_at, updated_at, function_code, plan_structure, deliverable_structure, io_schema) VALUES ('2c38abea-df36-48f5-b747-c3b20c9224ae', 'global', 'image-generator-google', 'Google Imagen Generator', 'Generates images via Google Imagen 4 Fast API.', 'function', 'function_full', NULL, 'active', '
{
    "metadata": {
        "name": "image-generator-google",
        "displayName": "Google Imagen Generator",
        "description": "Generates images via Google Imagen 4 Fast API.",
        "version": "0.1.0",
        "type": "function",
        "tags": [
            "image",
            "google",
            "imagen"
        ]
    },
    "communication": {
        "input_modes": [
            "text/plain",
            "application/json"
        ],
        "output_modes": [
            "application/json"
        ]
    },
    "configuration": {
        "function": {
            "language": "javascript",
            "timeout_ms": 20000,
            "code": "async function handler(input, ctx) {\\n  const axios = ctx.require(\\"axios\\");\\n  const crypto = ctx.require(\\"crypto\\");\\n\\n  // Parse input parameters\\n  const source = input || {};\\n  const basePrompt = typeof source.prompt === \\"string\\" ? source.prompt : \\"\\";\\n  const prompt =\\n    basePrompt.trim() ||\\n    (typeof source.userMessage === \\"string\\" ? source.userMessage.trim() : \\"\");\\n  if (!prompt) {\\n    throw new Error(\\"prompt is required\\");\\n  }\\n\\n  // Parse count (1-4 images)\\n  const rawCount = Number(source.count ?? source.n ?? 1);\\n  const count = Math.max(\\n    1,\\n    Math.min(Number.isFinite(rawCount) ? rawCount : 1, 4)\\n  );\\n\\n  // Parse aspect ratio (supports 1:1, 3:4, 4:3, 9:16, 16:9)\\n  const validAspectRatios = [\\"1:1\\", \\"3:4\\", \\"4:3\\", \\"9:16\\", \\"16:9\\"];\\n  const aspectRatio =\\n    typeof source.aspectRatio === \\"string\\" &&\\n    validAspectRatios.includes(source.aspectRatio)\\n      ? source.aspectRatio\\n      : \\"1:1\\";\\n\\n  // Parse safety filter level\\n  const validSafetyLevels = [\\n    \\"BLOCK_LOW_AND_ABOVE\\",\\n    \\"BLOCK_MEDIUM_AND_ABOVE\\",\\n    \\"BLOCK_ONLY_HIGH\\",\\n    \\"BLOCK_NONE\\"\\n  ];\\n  const safetyFilterLevel =\\n    typeof source.safetyFilterLevel === \\"string\\" &&\\n    validSafetyLevels.includes(source.safetyFilterLevel)\\n      ? source.safetyFilterLevel\\n      : \\"BLOCK_MEDIUM_AND_ABOVE\\";\\n\\n  // Parse person generation setting\\n  const validPersonGeneration = [\\"dont_allow\\", \\"allow_adult\\", \\"allow_all\\"];\\n  const personGeneration =\\n    typeof source.personGeneration === \\"string\\" &&\\n    validPersonGeneration.includes(source.personGeneration)\\n      ? source.personGeneration\\n      : \\"allow_adult\\";\\n\\n  // Parse includeSafetyAttributes flag\\n  const includeSafetyAttributes = source.includeSafetyAttributes === true;\\n\\n  // Get environment variables\\n  const projectId = ctx.process.env.GOOGLE_PROJECT_ID;\\n  const accessToken = ctx.process.env.GOOGLE_ACCESS_TOKEN;\\n  const location =\\n    ctx.process.env.GOOGLE_REGION && ctx.process.env.GOOGLE_REGION.trim().length\\n      ? ctx.process.env.GOOGLE_REGION.trim()\\n      : \\"us-central1\\";\\n\\n  if (!projectId || !accessToken) {\\n    throw new Error(\\"GOOGLE_PROJECT_ID and GOOGLE_ACCESS_TOKEN required\\");\\n  }\\n\\n  // Build API endpoint for Imagen 4 Fast\\n  const endpoint = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagen-4.0-fast-generate-001:predict`;\\n\\n  // Build request parameters\\n  const parameters = {\\n    sampleCount: count,\\n    aspectRatio: aspectRatio,\\n    safetyFilterLevel: safetyFilterLevel,\\n    personGeneration: personGeneration,\\n  };\\n\\n  if (includeSafetyAttributes) {\\n    parameters.includeSafetyAttributes = true;\\n  }\\n\\n  // Make API request\\n  const response = await axios.post(\\n    endpoint,\\n    {\\n      instances: [{ prompt }],\\n      parameters: parameters,\\n    },\\n    {\\n      headers: {\\n        Authorization: `Bearer ${accessToken}`,\\n        \\"Content-Type\\": \\"application/json\\",\\n      },\\n      timeout: 120000,\\n    }\\n  );\\n\\n  // Process predictions\\n  const predictions = Array.isArray(response.data?.predictions)\\n    ? response.data.predictions\\n    : [];\\n\\n  if (!predictions.length) {\\n    throw new Error(\\"Google Imagen returned no predictions\\");\\n  }\\n\\n  // Process each generated image\\n  const attachments = [];\\n  for (let index = 0; index < predictions.length; index++) {\\n    const prediction = predictions[index] || {};\\n    const base64 =\\n      prediction.bytesBase64Encoded ||\\n      prediction.imageBytes ||\\n      prediction.data;\\n    if (!base64 || typeof base64 !== \\"string\\") {\\n      continue;\\n    }\\n\\n    const buffer = Buffer.from(base64, \\"base64\\");\\n    if (!buffer.length) {\\n      continue;\\n    }\\n\\n    const mime =\\n      typeof prediction.mimeType === \\"string\\" && prediction.mimeType.length\\n        ? prediction.mimeType\\n        : \\"image/png\\";\\n    const extension = mime.split(\\"/\\")[1] || \\"png\\";\\n    const hash = crypto.createHash(\\"sha256\\").update(buffer).digest(\\"hex\\");\\n\\n    // Save image asset\\n    const asset = await ctx.assets.saveBuffer({\\n      buffer,\\n      mime,\\n      filename: `google-imagen4-${Date.now()}-${index}.${extension}`,\\n      subpath: \\"generated\\",\\n    });\\n\\n    // Build attachment metadata\\n    const attachment = {\\n      assetId: asset.id,\\n      url: `/assets/${asset.id}`,\\n      mime,\\n      size: buffer.length,\\n      hash,\\n      altText: prompt,\\n      provider: \\"google\\",\\n      model: \\"imagen-4.0-fast\\",\\n      index,\\n      aspectRatio,\\n    };\\n\\n    // Include safety attributes if requested\\n    if (includeSafetyAttributes && prediction.safetyAttributes) {\\n      attachment.safetyAttributes = prediction.safetyAttributes;\\n    }\\n\\n    attachments.push(attachment);\\n  }\\n\\n  if (!attachments.length) {\\n    throw new Error(\\"Failed to generate image attachments\\");\\n  }\\n\\n  // Get deliverable title\\n  const title =\\n    typeof source.title === \\"string\\" && source.title.trim().length\\n      ? source.title.trim()\\n      : \\"Google Imagen Set\\";\\n\\n  // Create deliverable\\n  const deliverable = await ctx.deliverables.create({\\n    title,\\n    content: `Generated ${attachments.length} image(s) via Google Imagen 4 Fast (${aspectRatio} aspect ratio)`,\\n    format: attachments[0]?.mime || \\"image/png\\",\\n    type: \\"image\\",\\n    attachments: { images: attachments },\\n    metadata: {\\n      provider: \\"google\\",\\n      model: \\"imagen-4.0-fast-generate-001\\",\\n      sdk: \\"@google/genai\\",\\n      prompt,\\n      count: attachments.length,\\n      location,\\n      aspectRatio,\\n      safetyFilterLevel,\\n      personGeneration,\\n      includeSafetyAttributes,\\n      synthid_watermarked: true,\\n    },\\n  });\\n\\n  // Return structured response\\n  return {\\n    success: true,\\n    provider: \\"google\\",\\n    model: \\"imagen-4.0-fast-generate-001\\",\\n    deliverable,\\n    images: attachments,\\n    metadata: {\\n      prompt,\\n      count: attachments.length,\\n      location,\\n      aspectRatio,\\n      safetyFilterLevel,\\n      personGeneration,\\n      synthid_watermarked: true,\\n    },\\n  };\\n}\\n\\nmodule.exports = handler;"
        },
        "execution_capabilities": {
            "supports_converse": false,
            "supports_plan": false,
            "supports_build": true
        }
    },
    "prompts": {
        "system": "Generate images via Google Imagen 4 Fast. Optimise prompts for business storytelling and keep metadata concise."
    }
}
', '{"models": {"primary": {"name": "imagen-4.0-fast-generate-001", "type": "image-generation", "provider": "google", "description": "Google Imagen 4 Fast - optimized for rapid, high-quality image generation", "max_resolution": "2048x2048", "default_resolution": "1024x1024", "max_images_per_request": 4}, "deprecated": ["imagen-1", "imagen-2"], "alternative": {"name": "gemini-2.5-flash-image", "type": "conversational-image-generation", "provider": "google", "description": "Gemini 2.5 Flash Image - lightweight, conversational image generation"}}, "defaults": {"size": "1024x1024", "count": 1, "aspect_ratio": "1:1", "safety_filter": "BLOCK_MEDIUM_AND_ABOVE", "person_generation": "allow_adult"}, "agent_type": "function", "input_modes": ["text/plain", "application/json"], "performance": {"quality": "High-quality, photorealistic results", "use_case": "Production workflows requiring speed and quality balance", "max_resolution": "1024x1024 (fast), 2048x2048 (standard)", "typical_generation_time": "10-20 seconds"}, "mode_profile": "function_full", "output_modes": ["application/json"], "output_format": {"deliverable_structure": {"images": "Array<ImageAttachment>", "success": "boolean", "metadata": "object", "provider": "google", "deliverable": {"type": "image", "title": "string", "format": "image/png", "content": "string", "metadata": {"count": "number", "model": "imagen-4.0-fast", "prompt": "string", "location": "string", "provider": "google"}, "attachments": {"images": "Array<ImageAttachment>"}}}, "image_attachment_structure": {"url": "Asset access URL path", "hash": "SHA-256 hash for verification", "mime": "MIME type (typically image/png)", "size": "File size in bytes", "index": "Position in generation batch", "altText": "Original prompt for accessibility", "assetId": "Unique asset identifier", "provider": "google"}}, "best_practices": {"example_prompts": {"good": "Modern office workspace with natural lighting, minimalist design, laptop on desk, plants, warm tones", "poor": "office"}, "prompt_optimization": {"be_specific": "Include details about style, composition, lighting, mood", "business_focus": "Optimize for business storytelling and professional imagery", "optimal_length": "10-50 words typically optimal", "avoid_ambiguity": "Clear descriptions produce better results"}}, "supported_modes": ["build"], "asset_management": {"subpath": "generated", "storage_method": "ctx.assets.saveBuffer()", "filename_pattern": "google-{timestamp}-{index}.{extension}", "mime_type_detection": "automatic from API response"}, "input_parameters": {"optional": {"count": {"type": "number", "range": [1, 4], "default": 1, "description": "Number of images to generate", "alternative_fields": ["n"]}, "title": {"type": "string", "default": "Google Imagen Set", "description": "Display title for the deliverable set"}, "aspectRatio": {"type": "string", "default": "1:1", "options": ["1:1", "3:4", "4:3", "9:16", "16:9"], "description": "Image aspect ratio", "resolutions": {"1:1": "1024x1024"}}, "personGeneration": {"type": "string", "default": "allow_adult", "options": ["dont_allow", "allow_adult", "allow_all"], "description": "Control person image generation", "restrictions": {"allow_all": "Prohibited in EU, UK, CH, MENA regions"}}, "safetyFilterLevel": {"type": "string", "default": "BLOCK_MEDIUM_AND_ABOVE", "options": ["BLOCK_LOW_AND_ABOVE", "BLOCK_MEDIUM_AND_ABOVE", "BLOCK_ONLY_HIGH", "BLOCK_NONE"], "description": "Content filtering strictness"}, "includeSafetyAttributes": {"type": "boolean", "default": false, "description": "Include detailed safety scores for 12 categories"}}, "required": {"prompt": {"type": "string", "validation": "non-empty string after trimming", "description": "Text description of the image to generate", "alternative_fields": ["userMessage"]}}}, "safety_compliance": {"safety_categories": ["Death, Harm & Tragedy", "Firearms & Weapons", "Hate & Discrimination", "Health Misinformation", "Illicit Drugs", "Politics & Political Figures", "Pornography & Sexual Content", "Religion & Belief Systems", "Toxic Language", "Violence & Gore", "Vulgarity & Profanity", "War & Conflict"], "synthid_watermarking": {"enabled": true, "removable": false, "description": "Invisible AI-detectable watermarks on all generated images"}, "regional_restrictions": {"CH": "person_generation=allow_all prohibited", "EU": "person_generation=allow_all prohibited", "UK": "person_generation=allow_all prohibited", "MENA": "person_generation=allow_all prohibited"}}, "execution_capabilities": {"supports_plan": false, "supports_build": true, "supports_converse": false}, "technical_requirements": {"sdk": "@google/genai", "timeout_ms": 120000, "api_endpoint": "https://aiplatform.googleapis.com/v1/projects/{projectId}/locations/{location}/publishers/google/models/imagen-4.0-fast-generate-001:predict", "dependencies": ["axios", "crypto"], "environment_variables": {"GOOGLE_REGION": "Regional endpoint (default: us-central1)", "GOOGLE_PROJECT_ID": "Google Cloud project identifier", "GOOGLE_ACCESS_TOKEN": "OAuth 2.0 access token for authentication"}}}', '2025-10-26 22:38:57.528977+00', '2025-10-26 22:38:57.528977+00', NULL, NULL, '{"type": "image", "model": "imagen-4.0-fast-generate-001", "format": "image/png", "multiple": true, "provider": "google", "max_count": 4, "watermarked": true, "includes_metadata": true}', '{"input": {"type": "object", "required": ["prompt"], "properties": {"count": {"type": "number", "default": 1, "maximum": 4, "minimum": 1, "description": "Number of images to generate (1-4)"}, "title": {"type": "string", "default": "Google Imagen Set", "description": "Display title for the deliverable set"}, "prompt": {"type": "string", "example": "Modern office workspace with natural lighting, minimalist design", "description": "Text description of the image to generate"}, "aspectRatio": {"enum": ["1:1", "3:4", "4:3", "9:16", "16:9"], "type": "string", "default": "1:1", "description": "Image aspect ratio"}, "personGeneration": {"enum": ["dont_allow", "allow_adult", "allow_all"], "type": "string", "default": "allow_adult", "description": "Control person image generation"}, "safetyFilterLevel": {"enum": ["BLOCK_LOW_AND_ABOVE", "BLOCK_MEDIUM_AND_ABOVE", "BLOCK_ONLY_HIGH", "BLOCK_NONE"], "type": "string", "default": "BLOCK_MEDIUM_AND_ABOVE", "description": "Content filtering strictness"}, "includeSafetyAttributes": {"type": "boolean", "default": false, "description": "Include detailed safety scores"}}}, "output": {"type": "object", "properties": {"model": {"type": "string", "const": "imagen-4.0-fast-generate-001"}, "images": {"type": "array", "items": {"type": "object"}, "description": "Array of generated image attachments"}, "success": {"type": "boolean", "description": "Whether image generation succeeded"}, "metadata": {"type": "object", "description": "Summary metadata about generation"}, "provider": {"type": "string", "const": "google"}, "deliverable": {"type": "object", "properties": {"type": {"type": "string", "const": "image"}, "title": {"type": "string"}, "format": {"type": "string", "const": "image/png"}, "content": {"type": "string"}, "metadata": {"type": "object", "properties": {"sdk": {"type": "string", "const": "@google/genai"}, "count": {"type": "number"}, "model": {"type": "string"}, "prompt": {"type": "string"}, "location": {"type": "string"}, "provider": {"type": "string", "const": "google"}, "aspectRatio": {"type": "string"}, "personGeneration": {"type": "string"}, "safetyFilterLevel": {"type": "string"}, "synthid_watermarked": {"type": "boolean", "const": true}}}, "attachments": {"type": "object", "properties": {"images": {"type": "array", "items": {"type": "object", "properties": {"url": {"type": "string", "description": "Asset access URL path"}, "hash": {"type": "string", "description": "SHA-256 hash for verification"}, "mime": {"type": "string", "description": "MIME type (image/png)"}, "size": {"type": "number", "description": "File size in bytes"}, "index": {"type": "number", "description": "Position in generation batch"}, "model": {"type": "string", "const": "imagen-4.0-fast"}, "altText": {"type": "string", "description": "Original prompt for accessibility"}, "assetId": {"type": "string", "description": "Unique asset identifier"}, "provider": {"type": "string", "const": "google"}, "aspectRatio": {"type": "string", "description": "Aspect ratio used"}}}}}}}, "description": "Deliverable containing generated images"}}}}');
INSERT INTO public.agents (id, organization_slug, slug, display_name, description, agent_type, mode_profile, version, status, yaml, context, created_at, updated_at, function_code, plan_structure, deliverable_structure, io_schema) VALUES ('9d929552-bf14-4749-9877-c0072d786cc0', 'global', 'image-generator-openai', 'OpenAI Image Generator', 'Generates images via OpenAI GPT-Image-1 with configurable quality tiers.', 'function', 'function_full', NULL, 'active', '
{
    "metadata": {
        "name": "image-generator-openai",
        "displayName": "OpenAI Image Generator",
        "description": "Generates images via OpenAI GPT-Image-1 with configurable quality tiers.",
        "version": "0.1.0",
        "type": "function",
        "tags": [
            "image",
            "openai"
        ]
    },
    "communication": {
        "input_modes": [
            "text/plain",
            "application/json"
        ],
        "output_modes": [
            "application/json"
        ]
    },
    "configuration": {
        "function": {
            "language": "javascript",
            "timeout_ms": 20000,
            "code": "async function handler(input, ctx) {\\n  const axios = ctx.require(\\"axios\\");\\n  const crypto = ctx.require(\\"crypto\\");\\n\\n  const source = input || {};\\n  const basePrompt = typeof source.prompt === \\"string\\" ? source.prompt : \\"\\";\\n  const prompt =\\n    basePrompt.trim() ||\\n    (typeof source.userMessage === \\"string\\" ? source.userMessage.trim() : \\"\");\\n  if (!prompt) {\\n    throw new Error(\\"prompt is required\\");\\n  }\\n\\n  const size =\\n    typeof source.size === \\"string\\" && source.size.trim().length\\n      ? source.size.trim()\\n      : \\"1024x1024\\";\\n  const quality =\\n    typeof source.quality === \\"string\\" &&\\n    source.quality.toLowerCase() === \\"hd\\"\\n      ? \\"hd\\"\\n      : \\"standard\\";\\n  const rawCount = Number(source.count ?? source.n ?? 1);\\n  const count = Math.max(\\n    1,\\n    Math.min(Number.isFinite(rawCount) ? rawCount : 1, 4)\\n  );\\n  const title =\\n    typeof source.title === \\"string\\" && source.title.trim().length\\n      ? source.title.trim()\\n      : \\"OpenAI Image Set\\";\\n  const negativePrompt =\\n    typeof source.negativePrompt === \\"string\\"\\n      ? source.negativePrompt.trim()\\n      : undefined;\\n\\n  const apiKey = ctx.process.env.OPENAI_API_KEY;\\n  if (!apiKey) {\\n    throw new Error(\\"OPENAI_API_KEY not configured\\");\\n  }\\n\\n  const payload = {\\n    model: \\"gpt-image-1\\",\\n    prompt,\\n    size,\\n    quality,\\n    n: count,\\n    response_format: \\"b64_json\\",\\n    user: ctx.userId || undefined,\\n  };\\n\\n  if (negativePrompt) {\\n    payload.negative_prompt = negativePrompt;\\n  }\\n\\n  const response = await axios.post(\\n    \\"https://api.openai.com/v1/images/generations\\",\\n    payload,\\n    {\\n      headers: {\\n        Authorization: `Bearer ${apiKey}`,\\n        \\"Content-Type\\": \\"application/json\\",\\n      },\\n      timeout: 120000,\\n    }\\n  );\\n\\n  const images = Array.isArray(response.data?.data)\\n    ? response.data.data\\n    : [];\\n\\n  if (!images.length) {\\n    throw new Error(\\"OpenAI returned no images\\");\\n  }\\n\\n  const attachments = [];\\n  for (let index = 0; index < images.length; index++) {\\n    const entry = images[index];\\n    const b64 = entry?.b64_json;\\n    if (!b64 || typeof b64 !== \\"string\\") {\\n      continue;\\n    }\\n\\n    const buffer = Buffer.from(b64, \\"base64\\");\\n    if (!buffer.length) {\\n      continue;\\n    }\\n\\n    const hash = crypto.createHash(\\"sha256\\").update(buffer).digest(\\"hex\\");\\n\\n    const asset = await ctx.assets.saveBuffer({\\n      buffer,\\n      mime: \\"image/png\\",\\n      filename: `openai-${Date.now()}-${index}.png`,\\n      subpath: \\"generated\\",\\n    });\\n\\n    attachments.push({\\n      assetId: asset.id,\\n      url: `/assets/${asset.id}`,\\n      mime: \\"image/png\\",\\n      size: buffer.length,\\n      hash,\\n      altText: prompt,\\n      provider: \\"openai\\",\\n      index,\\n    });\\n  }\\n\\n  if (!attachments.length) {\\n    throw new Error(\\"Failed to generate image attachments\\");\\n  }\\n\\n  const deliverable = await ctx.deliverables.create({\\n    title,\\n    content: `Generated ${attachments.length} image(s) via OpenAI GPT-Image-1`,\\n    format: \\"image/png\\",\\n    type: \\"image\\",\\n    attachments: { images: attachments },\\n    metadata: {\\n      provider: \\"openai\\",\\n      model: \\"gpt-image-1\\",\\n      prompt,\\n      size,\\n      quality,\\n      count: attachments.length,\\n      negativePrompt: negativePrompt || null,\\n    },\\n  });\\n\\n  return {\\n    success: true,\\n    provider: \\"openai\\",\\n    deliverable,\\n    images: attachments,\\n    metadata: {\\n      prompt,\\n      size,\\n      quality,\\n      count: attachments.length,\\n    },\\n  };\\n}\\n\\nmodule.exports = handler;"
        },
        "execution_capabilities": {
            "supports_converse": false,
            "supports_plan": false,
            "supports_build": true
        }
    },
    "prompts": {
        "system": "Generate production-ready images using OpenAI GPT-Image-1. Respect safety policies and return structured metadata."
    }
}
', '{"defaults": {"size": "1024x1024", "quality": "standard"}, "input_modes": ["text/plain", "application/json"], "output_modes": ["application/json"], "supported_modes": ["build"]}', '2025-10-26 22:38:59.959375+00', '2025-10-26 22:38:59.959375+00', NULL, NULL, NULL, NULL);
INSERT INTO public.agents (id, organization_slug, slug, display_name, description, agent_type, mode_profile, version, status, yaml, context, created_at, updated_at, function_code, plan_structure, deliverable_structure, io_schema) VALUES ('7df75c0e-1ca3-405f-adf9-2eac27cd3a40', 'global', 'image-orchestrator', 'Image Orchestrator', 'Coordinates image generation across multiple providers and compares outputs.', 'orchestrator', 'orchestrator_full', NULL, 'active', '
{
    "metadata": {
        "name": "image-orchestrator",
        "displayName": "Image Orchestrator",
        "description": "Coordinates image generation across multiple providers and compares outputs.",
        "version": "0.1.0",
        "type": "orchestrator",
        "tags": [
            "image",
            "orchestrator"
        ]
    },
    "communication": {
        "input_modes": [
            "text/plain",
            "application/json"
        ],
        "output_modes": [
            "application/json",
            "text/markdown"
        ]
    },
    "configuration": {
        "orchestration": {
            "available_orchestrations": [
                "image-comparison"
            ],
            "available_agents": [
                "image-generator-openai",
                "image-generator-google"
            ]
        },
        "execution_capabilities": {
            "supports_converse": true,
            "supports_plan": true,
            "supports_build": true,
            "supports_orchestration": true
        }
    },
    "prompts": {
        "system": "Compare image generations across providers, highlight differences, and recommend the best asset for the request.",
        "build": "Summarize the outputs from delegated image generators and provide a recommendation table."
    }
}
', '{"input_modes": ["text/plain", "application/json"], "output_modes": ["application/json", "text/markdown"], "supported_modes": ["converse", "plan", "build"], "available_agents": ["image-generator-openai", "image-generator-google"], "available_orchestrations": ["image-comparison"]}', '2025-10-26 22:39:02.436565+00', '2025-10-26 22:39:02.436565+00', NULL, NULL, NULL, NULL);
INSERT INTO public.agents (id, organization_slug, slug, display_name, description, agent_type, mode_profile, version, status, yaml, context, created_at, updated_at, function_code, plan_structure, deliverable_structure, io_schema) VALUES ('f96136a3-d9f8-42ed-b065-73a7134b8d57', NULL, 'marketing-swarm-langgraph', 'Marketing Swarm (LangGraph)', 'Generate comprehensive marketing content using LangGraph workflow. Creates blog posts, SEO-optimized content, and social media posts for product announcements.', 'api', 'build', '1.0.0', 'active', '{
    "metadata": {
        "name": "marketing-swarm-langgraph",
        "displayName": "Marketing Swarm (LangGraph)",
        "description": "Generate comprehensive marketing content using LangGraph workflow",
        "version": "1.0.0",
        "type": "api",
        "department": "marketing"
    },
    "configuration": {
        "api": {
            "endpoint": "http://localhost:7200/workflows/marketing-swarm",
            "method": "POST",
            "headers": {
                "Content-Type": "application/json"
            },
            "body": {
                "taskId": "{{taskId}}",
                "conversationId": "{{conversationId}}",
                "userId": "{{userId}}",
                "prompt": "{{userMessage}}",
                "provider": "{{llmSelection.providerName}}",
                "model": "{{llmSelection.modelName}}",
                "statusWebhook": "{{env.WEBHOOK_STATUS_URL}}?taskId={{taskId}}"
            },
            "authentication": {
                "type": "none"
            },
            "response_mapping": {
                "status_field": "success",
                "result_field": "data"
            },
            "timeout": 180000
        },
        "deliverable": {
            "format": "json",
            "type": "marketing-campaign"
        },
        "execution_capabilities": {
            "supports_converse": false,
            "supports_plan": false,
            "supports_build": true
        }
    }
}', NULL, '2025-11-04 13:53:04.474445+00', '2025-11-04 13:53:04.474445+00', NULL, NULL, NULL, NULL);
INSERT INTO public.agents (id, organization_slug, slug, display_name, description, agent_type, mode_profile, version, status, yaml, context, created_at, updated_at, function_code, plan_structure, deliverable_structure, io_schema) VALUES ('1b019cd8-b0c3-4ba8-8b1c-5f5c2f19a869', NULL, 'requirements-writer-langgraph', 'Requirements Writer (LangGraph)', 'Transform ideas into professional requirements documents using LangGraph workflow. Creates PRDs, TRDs, API docs, user stories, or architecture documents with AI-powered analysis.', 'api', 'build', '1.0.0', 'active', '{
    "metadata": {
        "name": "requirements-writer-langgraph",
        "displayName": "Requirements Writer (LangGraph)",
        "description": "Transform ideas into professional requirements documents using LangGraph workflow",
        "version": "1.0.0",
        "type": "api",
        "department": "engineering"
    },
    "configuration": {
        "api": {
            "endpoint": "http://localhost:7200/workflows/requirements-writer",
            "method": "POST",
            "headers": {
                "Content-Type": "application/json"
            },
            "body": {
                "taskId": "{{taskId}}",
                "conversationId": "{{conversationId}}",
                "userId": "{{userId}}",
                "prompt": "{{userMessage}}",
                "provider": "{{llmSelection.providerName}}",
                "model": "{{llmSelection.modelName}}",
                "statusWebhook": "{{env.WEBHOOK_STATUS_URL}}?taskId={{taskId}}",
                "metadata": "{{payload.metadata}}"
            },
            "authentication": {
                "type": "none"
            },
            "response_mapping": {
                "status_field": "success",
                "result_field": "data"
            },
            "timeout": 240000
        },
        "deliverable": {
            "format": "markdown",
            "type": "requirements-document"
        },
        "execution_capabilities": {
            "supports_converse": false,
            "supports_plan": false,
            "supports_build": true
        }
    }
}', NULL, '2025-11-04 13:53:04.484357+00', '2025-11-04 13:53:04.484357+00', NULL, NULL, NULL, NULL);
INSERT INTO public.agents (id, organization_slug, slug, display_name, description, agent_type, mode_profile, version, status, yaml, context, created_at, updated_at, function_code, plan_structure, deliverable_structure, io_schema) VALUES ('ded3599d-4713-4b6f-80be-ea11411b0426', NULL, 'metrics-agent-langgraph', 'Metrics Agent (LangGraph)', 'Analyze business metrics and generate data-driven insights using LangGraph workflow. Queries KPI database and creates comprehensive reports with trends and recommendations.', 'api', 'build', '1.0.0', 'active', '{
    "metadata": {
        "name": "metrics-agent-langgraph",
        "displayName": "Metrics Agent (LangGraph)",
        "description": "Analyze business metrics and generate data-driven insights using LangGraph workflow",
        "version": "1.0.0",
        "type": "api",
        "department": "finance"
    },
    "configuration": {
        "api": {
            "endpoint": "http://localhost:7200/workflows/metrics-agent",
            "method": "POST",
            "headers": {
                "Content-Type": "application/json"
            },
            "body": {
                "taskId": "{{taskId}}",
                "conversationId": "{{conversationId}}",
                "userId": "{{userId}}",
                "prompt": "{{userMessage}}",
                "provider": "{{llmSelection.providerName}}",
                "model": "{{llmSelection.modelName}}",
                "statusWebhook": "{{env.WEBHOOK_STATUS_URL}}?taskId={{taskId}}"
            },
            "authentication": {
                "type": "none"
            },
            "response_mapping": {
                "status_field": "success",
                "result_field": "data"
            },
            "timeout": 120000
        },
        "deliverable": {
            "format": "markdown",
            "type": "metrics-report"
        },
        "execution_capabilities": {
            "supports_converse": false,
            "supports_plan": false,
            "supports_build": true
        }
    }
}', NULL, '2025-11-04 13:53:04.485012+00', '2025-11-04 13:53:04.485012+00', NULL, NULL, NULL, NULL);


--
-- PostgreSQL database dump complete
--

