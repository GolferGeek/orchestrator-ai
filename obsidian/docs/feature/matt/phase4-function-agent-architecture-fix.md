# Phase 4 - Function Agent Architecture Fix

## Problem Statement

The current Phase 4 implementation violates the core principle of **self-contained function agents**. Function agents should contain ALL their logic in the JavaScript `function_code` column, making direct HTTP calls to external APIs without depending on internal services.

### Current (Incorrect) Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Database: image-generator-openai agent                  │
│                                                          │
│ function_code:                                           │
│   ctx.services.images.generate({ provider: 'openai' })  │ ❌ Service dependency
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ FunctionAgentRunnerService                               │
│   - Restrictive VM sandbox (only console exposed)       │ ❌ No HTTP access
│   - Provides ctx.services.images                        │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ ImageGenerationService                                   │
│   - Provider selection logic                            │ ❌ Business logic in service
│   - OpenAIImageProvider / GoogleImageProvider           │
│   - Asset + deliverable creation                        │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ External APIs (OpenAI, Google)                          │
└─────────────────────────────────────────────────────────┘
```

**Problems:**
1. **Adding new providers requires code changes** - Must modify ImageGenerationService
2. **Function agents aren't self-contained** - Depend on internal service layer
3. **VM sandbox too restrictive** - No `fetch`, `axios`, or `require()` available
4. **Violates extensibility principle** - Can't add `image-generator-midjourney` without backend changes

---

## Correct Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Database: image-generator-openai agent                  │
│                                                          │
│ function_code:                                           │
│   const axios = ctx.require('axios');                   │ ✅ Self-contained
│   const response = await axios.post(                    │
│     'https://api.openai.com/v1/images/generations',    │
│     { model: 'gpt-image-1', prompt, ... },              │
│     { headers: { Authorization: `Bearer ${apiKey}` }}   │
│   );                                                     │
│   // Process response, create deliverable              │
│   return ctx.deliverables.create({ ... });             │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ FunctionAgentRunnerService                               │
│   - Enhanced VM sandbox with axios, Buffer, crypto      │ ✅ HTTP capable
│   - Provides ctx.deliverables (infrastructure only)     │
│   - NO provider-specific business logic                 │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ External APIs (OpenAI, Google, Midjourney, etc.)       │ ✅ Direct calls
└─────────────────────────────────────────────────────────┘
```

**Benefits:**
1. **Zero-code new providers** - Just add new agent row to database
2. **True self-containment** - All logic in `function_code`
3. **Full HTTP capabilities** - Agents can call any API
4. **Extensibility** - New image providers = new database rows, no deployment

---

## Required Changes

### 1. Remove ImageGenerationService

**Files to Delete:**
- `apps/api/src/agent-platform/services/image-generation.service.ts`
- `apps/api/src/agent-platform/services/image-generation.service.spec.ts`
- `apps/api/src/agent-platform/providers/image/openai-image.provider.ts`
- `apps/api/src/agent-platform/providers/image/openai-image.provider.spec.ts`
- `apps/api/src/agent-platform/providers/image/google-image.provider.ts`
- `apps/api/src/agent-platform/providers/image/google-image.provider.spec.ts`

**Module Updates:**
- Remove from `AgentPlatformModule.providers`
- Remove from `FunctionAgentRunnerService` constructor

---

### 2. Enhance VM Sandbox

**File:** `apps/api/src/agent2agent/services/function-agent-runner.service.ts`

**Current Sandbox (Lines 148-151):**
```typescript
const sandbox: any = {
  console: { log: (...a: any[]) => this.logger.log(a.join(' ')) },
};
```

**Enhanced Sandbox:**
```typescript
const sandbox: any = {
  console: {
    log: (...a: any[]) => this.logger.log(a.join(' ')),
    warn: (...a: any[]) => this.logger.warn(a.join(' ')),
    error: (...a: any[]) => this.logger.error(a.join(' ')),
  },
  Buffer: Buffer,
  require: (moduleName: string) => {
    // Whitelist safe modules
    const allowed = ['axios', 'crypto', 'url'];
    if (!allowed.includes(moduleName)) {
      throw new Error(`Module '${moduleName}' is not allowed in function sandbox`);
    }
    return require(moduleName);
  },
  process: {
    env: {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      GOOGLE_ACCESS_TOKEN: process.env.GOOGLE_ACCESS_TOKEN,
      GOOGLE_PROJECT_ID: process.env.GOOGLE_PROJECT_ID,
      // Add other safe env vars as needed
    },
  },
};
```

**Security Notes:**
- **Whitelist approach** - Only explicitly allowed modules accessible
- **Environment variable filtering** - Only expose necessary API keys
- **No filesystem access** - No `fs`, `path`, or `child_process`
- **Timeout protection** - Existing timeout mechanism remains (line 171-173)

---

### 3. Provide Infrastructure Services Only

**Update ctx object (Lines 162-169):**
```typescript
const ctx = {
  // Infrastructure services (not business logic)
  deliverables: {
    create: async (args: {
      title: string;
      content: string;
      format: string;
      type: string;
      attachments?: any[];
      metadata?: any;
    }) => {
      // Create deliverable with assets
      const deliverable = await this.deliverablesService.create({
        title: args.title,
        type: args.type as any,
        conversationId,
        agentName: definition.slug,
        initialContent: args.content,
        initialFormat: args.format as any,
        initialCreationType: DeliverableVersionCreationType.AI_RESPONSE,
        initialTaskId: (request.payload as any)?.taskId ?? undefined,
        initialMetadata: args.metadata || {},
        initialFileAttachments: args.attachments || {},
      }, userId);

      return deliverable;
    },
  },
  assets: {
    saveBuffer: async (args: {
      buffer: Buffer;
      mime: string;
      filename: string;
      subpath?: string;
    }) => {
      return this.assetsService.saveBuffer({
        organizationSlug,
        conversationId,
        userId,
        buffer: args.buffer,
        mime: args.mime,
        filename: args.filename,
        subpath: args.subpath || 'generated',
      });
    },
  },
  organizationSlug,
  conversationId,
  userId,
  agent: { slug: definition.slug },
  config: definition.config,
};
```

**Key Principle:**
- `ctx` provides **infrastructure** (deliverables, assets, db access)
- `ctx` does NOT provide **business logic** (provider selection, API calls)
- Function code handles all domain-specific logic

---

### 4. Update Agent Definitions

**File:** `apps/api/supabase/migrations/202510130010_seed_phase4_core_agents.sql`

**Example: OpenAI Image Generator (Lines 505-650)**

Replace the current simplified code with full implementation:

```javascript
async function handler(input, ctx) {
  const axios = ctx.require('axios');
  const crypto = ctx.require('crypto');

  // Parse input
  const prompt = input.prompt || input.userMessage || '';
  if (!prompt.trim()) {
    throw new Error('prompt is required');
  }

  const size = input.size || '1024x1024';
  const quality = input.quality === 'hd' ? 'hd' : 'standard';
  const count = Math.max(1, Math.min(input.count || 1, 4));
  const title = input.title || 'OpenAI Image Set';

  // Call OpenAI API
  const apiKey = ctx.process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const response = await axios.post(
    'https://api.openai.com/v1/images/generations',
    {
      model: 'gpt-image-1',
      prompt,
      size,
      quality,
      n: count,
      response_format: 'b64_json',
      user: ctx.userId,
    },
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 120000,
    }
  );

  const images = response.data?.data || [];
  if (!images.length) {
    throw new Error('OpenAI returned no images');
  }

  // Process images and create assets
  const attachments = [];
  for (let i = 0; i < images.length; i++) {
    const b64 = images[i].b64_json;
    if (!b64) continue;

    const buffer = Buffer.from(b64, 'base64');
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');

    const asset = await ctx.assets.saveBuffer({
      buffer,
      mime: 'image/png',
      filename: `openai-${Date.now()}-${i}.png`,
      subpath: 'generated',
    });

    attachments.push({
      assetId: asset.id,
      url: `/assets/${asset.id}`,
      mime: 'image/png',
      size: buffer.length,
      hash,
      altText: prompt,
      provider: 'openai',
    });
  }

  // Create deliverable
  const deliverable = await ctx.deliverables.create({
    title,
    content: `Generated ${attachments.length} image(s) via OpenAI GPT-Image-1`,
    format: 'image/png',
    type: 'image',
    attachments: { images: attachments },
    metadata: {
      provider: 'openai',
      model: 'gpt-image-1',
      prompt,
      size,
      quality,
      count,
    },
  });

  return {
    success: true,
    deliverable,
    images: attachments,
  };
}

module.exports = handler;
```

**Similar updates needed for:**
- `image-generator-google` - Full Imagen API implementation
- Future agents (Midjourney, Stability, etc.) - Just add new database rows

---

## Testing Strategy

### Unit Tests (Claude)

**No longer needed (DELETE):**
- ❌ `image-generation.service.spec.ts`
- ❌ `openai-image.provider.spec.ts`
- ❌ `google-image.provider.spec.ts`

**New tests needed:**
- ✅ `function-agent-runner.service.spec.ts` - Enhanced sandbox tests
  - Test `require()` whitelist enforcement
  - Test environment variable filtering
  - Test `ctx.deliverables.create()` calls
  - Test `ctx.assets.saveBuffer()` calls
  - Test timeout enforcement

### Integration Tests (Claude)

**Agent contract tests:**
- ✅ `image-generator-openai.contract.spec.ts`
  - Mock axios to return fake base64 images
  - Verify deliverable creation
  - Verify asset creation
  - Test error handling (API failures, missing API key)

- ✅ `image-generator-google.contract.spec.ts`
  - Mock axios for Google Imagen API
  - Verify deliverable creation with correct metadata
  - Test multi-image generation
  - Test error handling

**Sandbox security tests:**
- ✅ Attempt to `require('fs')` - should throw
- ✅ Attempt to access `process.exit` - should be undefined
- ✅ Verify only whitelisted env vars accessible

---

## Migration Path

### Phase 4 Revised Scope

**Codex tasks:**
1. Delete ImageGenerationService and provider classes
2. Enhance FunctionAgentRunnerService sandbox
3. Update agent definitions with full JavaScript implementations
4. Update module imports/providers

**Claude tasks:**
1. Delete service/provider tests
2. Write enhanced sandbox security tests
3. Write agent contract tests with mocked HTTP
4. Verify all tests passing
5. Create verification report

**Timeline:** +1 day to Phase 4 (architectural refactor)

---

## Future Extensibility Examples

### Adding Midjourney Support

**No code changes needed** - just add to database:

```sql
INSERT INTO public.agents (
  organization_slug, slug, display_name, agent_type,
  function_code
) VALUES (
  'global',
  'image-generator-midjourney',
  'Midjourney Image Generator',
  'function',
  -- Full Midjourney API implementation in JavaScript
  $MIDJOURNEY_CODE$
);
```

### Adding Stability AI

```sql
INSERT INTO public.agents (...) VALUES (
  'global',
  'image-generator-stability',
  'Stability AI Image Generator',
  'function',
  $STABILITY_CODE$
);
```

### Custom User Agents

Users can create their own function agents pointing to custom APIs without any backend deployment.

---

## Approval Required

**Codex**: Review and approve architectural changes
**Claude**: Confirm testing strategy is comprehensive
**Human**: Approve additional day to Phase 4 timeline

Once approved, Codex will implement the architectural fix, Claude will write new tests, and Phase 4 will be complete with the correct self-contained function agent architecture.
