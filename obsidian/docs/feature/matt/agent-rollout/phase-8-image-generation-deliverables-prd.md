# Phase 5: Image Generation & Deliverables

## Overview
Complete the image generation and deliverable system to enable agents to create, store, and manage visual content and text deliverables with full versioning and editing workflows.

## Goals
- Fully functional image generation agents (OpenAI DALL-E, Gemini Imagen)
- Complete deliverable lifecycle (plan → build → edit → version)
- Image storage with asset management
- Deliverable editing conversations
- Version history and comparison
- Rich deliverables UI

## Prerequisites
- ✅ Phase 0-4 complete (cleanup, context agents, conversation-only, API agents, migration)
- ✅ `deliverables/` module exists (universal deliverable system)
- ✅ `assets/` module exists (universal file storage)
- ✅ `Agent2AgentDeliverablesService` exists (handles text deliverables)

## Architecture Decision

**Consolidate ALL deliverable types into Agent2AgentDeliverablesService:**
- ✅ Text deliverables (already working)
- ✅ Image deliverables (add in Phase 5)
- 🔮 Video deliverables (future)
- 🔮 Audio deliverables (future)

**Why single service pattern:**
- Single source of truth for deliverable creation
- Consistent API across all deliverable types
- Easier to maintain and extend
- Clean separation: providers handle generation, service handles storage/versioning

**Implementation approach:**
```typescript
// Agent2AgentDeliverablesService methods:

// Document deliverables (formatted content)
generateDocumentDeliverable(params: {
  content: string;
  format?: 'markdown' | 'json' | 'yaml' | 'html' | 'plaintext';
  title?: string;
  conversationId: string;
  userId: string;
  agentSlug: string;
  taskId?: string;
}): Promise<{ deliverableId: string }>
→ Type: 'document'
→ Formats: markdown (default), json, yaml, html, plaintext

// Code deliverables (syntax-highlighted code)
generateCodeDeliverable(params: {
  content: string;
  format?: 'typescript' | 'javascript' | 'python' | 'css' | 'sql' | 'xml';
  title?: string;
  conversationId: string;
  userId: string;
  agentSlug: string;
  taskId?: string;
}): Promise<{ deliverableId: string }>
→ Type: 'code'
→ Formats: typescript, javascript, python, css, sql, xml

// Image deliverables
generateImageDeliverable(params: {
  prompt: string;
  conversationId: string;
  userId: string;
  agentSlug: string;
  quality?: 'low' | 'medium' | 'high';  // Default: medium ($0.16)
  referenceImage?: string;  // Future: base64 or asset ID
}): Promise<{ deliverableId: string; images: Asset[] }>
→ Type: 'image'
→ Formats: png
→ Size: 1024x1024 (fixed)
→ Provider: OpenAI gpt-image-1 only
→ Pricing: low=$0.01, medium=$0.16, high=$0.42 per image

// Future: Video deliverables
generateVideoDeliverable(...)
→ Type: 'video'
→ Formats: mp4, webm

// Future: Audio deliverables
generateAudioDeliverable(...)
→ Type: 'audio'
→ Formats: mp3, wav, ogg

// Legacy (refactored to call generateDocumentDeliverable or generateCodeDeliverable)
createFromTaskResult(...)
```

**Image generation providers:**
```
apps/api/src/agent2agent/
├── providers/
│   ├── openai-image.provider.ts    // gpt-image-1 (Phase 5)
│   ├── openai-video.provider.ts    // Future: Sora
│   └── elevenlabs-audio.provider.ts // Future: TTS
└── services/
    └── agent2agent-deliverables.service.ts  // Uses providers + tracks usage
```

**Phase 0 impact:**
- ❌ DELETE `image-agents/` module (consolidate into agent2agent)
- ✅ KEEP `deliverables/` module (universal system)
- ✅ KEEP `assets/` module (universal storage)

## Scope

### In Scope
1. **Image Generation Agents**
   - **OpenAI gpt-image-1 ONLY** (simplified launch)
   - Text prompt support (required)
   - Image input support (reference images - future)
   - Quality selection: low ($0.01), medium ($0.16), high ($0.42)
   - **Fixed size: 1024x1024 only** (square images)
   - Generation history per conversation
   - LLM usage tracking for cost monitoring

2. **Image Storage & Management**
   - Store generated images as assets
   - Create deliverable records for images
   - Image metadata (prompt, model, parameters)
   - Thumbnail generation
   - Image versioning (regenerate with tweaks)

3. **Deliverable Workflow Completion**
   - **Plan mode**: Generate outline/structure
   - **Build mode**: Create initial deliverable
   - **Edit mode**: Refinement conversations
   - Version creation on edits
   - Version comparison UI

4. **Deliverable Types**
   - Document deliverables (markdown, text)
   - Image deliverables (PNG, JPG)
   - Code deliverables (source code)
   - Mixed deliverables (images + text)

5. **Deliverables UI**
   - Deliverables panel (list all deliverables for conversation)
   - Version history dropdown
   - Edit conversation trigger
   - Download/export deliverable
   - Preview rendering (markdown, images, code)

### Out of Scope
- Video generation (future)
- Audio generation (future)
- PDF rendering (future)
- Collaborative editing (future)
- Public sharing links (future)

## Success Criteria

### Image Generation Working When:
1. ✅ User can create image_generator conversation
2. ✅ User sends prompt → image generates
3. ✅ Image stored as asset
4. ✅ Image displayed in conversation
5. ✅ Image saved as deliverable
6. ✅ Can regenerate with prompt tweaks

### Deliverables Working When:
1. ✅ Context agents create deliverables in build mode
2. ✅ Deliverables panel shows all deliverables
3. ✅ Can trigger edit conversation
4. ✅ Edits create new versions
5. ✅ Version history visible
6. ✅ Can download any version

## Architecture

### Image Generation Flow
```
User → "Generate an image of a sunset"
  ↓
ImageAgentsController.generateImage()
  ↓
ImageAgentsService.generate()
  ↓ (choose provider based on agent config)
OpenAIImageProvider.generate() OR GeminiImageProvider.generate()
  ↓
AssetsService.uploadAsset() (store image)
  ↓
DeliverablesService.create() (create deliverable record)
  ↓
Return: { deliverable_id, asset_url, prompt, metadata }
```

### Deliverable Editing Flow
```
User clicks "Edit" on deliverable
  ↓
Frontend creates new conversation (mode: 'edit')
  ↓
Conversation includes deliverable context
  ↓
Agent makes changes
  ↓
DeliverableVersionsService.createVersion()
  ↓
New version created, linked to original deliverable
```

## Data Models

### DeliverableVersion Table (where format is stored)
```typescript
interface DeliverableVersion {
  id: string;
  deliverable_id: string;
  version_number: number;
  is_current_version: boolean;

  // Content
  content?: string;           // Text content (markdown, json, code, etc.)
  asset_id?: string;          // Reference to asset (for images)

  // Format (CRITICAL - determines how to render)
  format: DeliverableFormat;

  // Metadata
  metadata?: {
    prompt?: string;          // For images
    model?: string;           // e.g., "dall-e-3", "gpt-4"
    parameters?: any;         // Generation parameters
    agentName?: string;
    agentType?: string;
  };

  created_by_type: 'conversation_task' | 'user_edit' | 'ai_response';
  task_id?: string;           // Link to task for LLM rerun

  created_at: timestamp;
  updated_at: timestamp;
}

// Format types
type DeliverableFormat =
  // Text formats
  | 'markdown'
  | 'json'
  | 'yaml'
  | 'plaintext'
  | 'html'
  // Code formats
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'css'
  | 'sql'
  | 'xml'
  // Image formats
  | 'png'
  | 'jpg'
  | 'webp'
  // Future: video/audio
  | 'mp4'
  | 'webm'
  | 'mp3'
  | 'wav';
```

### Deliverables Table (parent record)
```typescript
interface Deliverable {
  id: string;
  title: string;
  type: 'document' | 'image' | 'code' | 'mixed' | 'video' | 'audio';
  conversation_id: string;
  agent_slug: string;
  user_id: string;

  created_at: timestamp;
  updated_at: timestamp;
}
```

### Assets Table (already exists, use as-is)
```typescript
interface Asset {
  id: string;
  user_id: string;
  file_name: string;
  file_path: string;          // Supabase storage path
  file_size: number;
  mime_type: string;

  metadata?: {
    width?: number;
    height?: number;
    thumbnail_path?: string;
  };

  created_at: timestamp;
}
```

### Image Generation Config (agent config)
```typescript
interface ImageAgentConfig {
  agent_type: 'image_generation';

  config: {
    image_generation: {
      provider: 'openai';              // Only OpenAI for Phase 5
      model: 'gpt-image-1';            // Latest model (April 2025)

      default_parameters: {
        quality: 'low' | 'medium' | 'high';  // Default: medium
        size: '1024x1024';  // Fixed for Phase 5
      };

      pricing: {
        low: 0.01;      // $0.01 per image
        medium: 0.16;   // $0.16 per image
        high: 0.42;     // $0.42 per image
      };
    };
  };
}
```

## Implementation Tasks

### Phase 5.1: Document & Code Deliverables - Add Format Types (0.5 days)

**Current State:**
- `createFromTaskResult()` exists but only handles plain text/markdown
- No explicit format typing
- No distinction between documents vs code

**Refactor to Two Explicit Methods:**
```typescript
// agent2agent/services/agent2agent-deliverables.service.ts

/**
 * Generate document deliverable (markdown, JSON, YAML, HTML)
 */
async generateDocumentDeliverable(params: {
  content: string;
  format?: DeliverableFormat;  // Optional - will infer if not provided
  title?: string;
  conversationId: string;
  userId: string;
  agentSlug: string;
  taskId?: string;
  metadata?: Record<string, any>;
}): Promise<{ deliverableId: string }> {
  // Infer format if not provided
  const format = params.format || this.inferFormat(params.content);

  // Determine deliverable type from format
  const type = this.getDeliverableType(format);

  // Extract or generate title
  const title = params.title || this.extractTitleFromContent(params.content) || `${params.agentSlug} Output`;

  // Create deliverable record
  const deliverableId = await this.createDeliverable({
    title,
    type,
    conversationId: params.conversationId,
    agentName: params.agentSlug,
    userId: params.userId,
  });

  // Create version with format
  await this.createDeliverableVersion({
    deliverableId,
    content: params.content,
    format,
    createdByType: 'conversation_task',
    taskId: params.taskId,
    userId: params.userId,
    metadata: {
      agentName: params.agentSlug,
      format,
      ...params.metadata,
    },
  });

  this.logger.log(`📄 Created document deliverable ${deliverableId} (format: ${format})`);

  return { deliverableId };
}

/**
 * Generate code deliverable (TypeScript, Python, SQL, etc.)
 */
async generateCodeDeliverable(params: {
  content: string;
  format?: 'typescript' | 'javascript' | 'python' | 'css' | 'sql' | 'xml';
  title?: string;
  conversationId: string;
  userId: string;
  agentSlug: string;
  taskId?: string;
  metadata?: Record<string, any>;
}): Promise<{ deliverableId: string }> {
  // Infer format if not provided
  const format = params.format || this.inferCodeFormat(params.content);

  // Extract or generate title
  const title = params.title || this.extractTitleFromContent(params.content) || `${params.agentSlug} Code`;

  // Create deliverable record (type: 'code')
  const deliverableId = await this.createDeliverable({
    title,
    type: 'code',
    conversationId: params.conversationId,
    agentName: params.agentSlug,
    userId: params.userId,
  });

  // Create version with format
  await this.createDeliverableVersion({
    deliverableId,
    content: params.content,
    format,
    createdByType: 'conversation_task',
    taskId: params.taskId,
    userId: params.userId,
    metadata: {
      agentName: params.agentSlug,
      format,
      language: format,  // Alias for code preview
      ...params.metadata,
    },
  });

  this.logger.log(`💻 Created code deliverable ${deliverableId} (format: ${format})`);

  return { deliverableId };
}

/**
 * Legacy method - intelligently routes to document or code deliverable
 */
async createFromTaskResult(
  result: any,
  userId: string,
  taskId: string,
  agentSlug: string,
  conversationId: string,
  mode: string,
): Promise<string | null> {
  if (mode !== 'build') return null;
  if (!result?.payload?.content?.output) return null;

  const content = result.payload.content.output;
  const format = result.payload.format || this.inferFormat(content);

  // Route to code or document based on format
  const codeFormats = ['typescript', 'javascript', 'python', 'css', 'sql', 'xml'];
  const isCode = codeFormats.includes(format);

  const { deliverableId } = isCode
    ? await this.generateCodeDeliverable({
        content,
        format: format as any,
        title: result.payload.title,
        conversationId,
        userId,
        agentSlug,
        taskId,
        metadata: { mode, source: 'agent2agent' },
      })
    : await this.generateDocumentDeliverable({
        content,
        format: format as any,
        title: result.payload.title,
        conversationId,
        userId,
        agentSlug,
        taskId,
        metadata: { mode, source: 'agent2agent' },
      });

  return deliverableId;
}

// Helper: Infer format from content
private inferFormat(content: string): DeliverableFormat {
  // Check for code block languages
  if (content.startsWith('```typescript') || content.includes('interface ') || content.includes('type ')) {
    return 'typescript';
  }
  if (content.startsWith('```javascript') || content.startsWith('```js')) {
    return 'javascript';
  }
  if (content.startsWith('```python') || content.startsWith('def ') || content.startsWith('class ')) {
    return 'python';
  }
  if (content.startsWith('```sql') || content.toUpperCase().includes('SELECT ')) {
    return 'sql';
  }

  // Check for structured formats
  const trimmed = content.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(content);
      return 'json';
    } catch {}
  }
  if (content.includes('---\n') && /^[\w-]+:\s+/m.test(content)) {
    return 'yaml';
  }
  if (content.includes('<html') || content.includes('<!DOCTYPE') || content.includes('<div')) {
    return 'html';
  }
  if (content.includes('<') && content.includes('/>')) {
    return 'xml';
  }

  // Default to markdown (most common)
  return 'markdown';
}

// Helper: Get deliverable type from format
private getDeliverableType(format: DeliverableFormat): 'document' | 'code' | 'image' {
  const codeFormats = ['typescript', 'javascript', 'python', 'css', 'sql'];
  if (codeFormats.includes(format)) return 'code';

  const imageFormats = ['png', 'jpg', 'webp'];
  if (imageFormats.includes(format)) return 'image';

  return 'document';
}
```

### Phase 5.2: Image Generation - Move into Agent2Agent (1 day)

1. **Create OpenAI Image Provider**
   ```typescript
   // agent2agent/providers/openai-image.provider.ts
   - gpt-image-1 API integration
   - Support quality: low/medium/high (maps to pricing)
   - Fixed size: 1024x1024 (square only for Phase 5)
   - Handle API errors gracefully
   - Return base64 encoded images
   - Token-based pricing calculation
   ```

2. **Add Image Methods to Agent2AgentDeliverablesService**
   ```typescript
   // agent2agent/services/agent2agent-deliverables.service.ts

   async generateImageDeliverable(params: {
     prompt: string;
     conversationId: string;
     userId: string;
     agentSlug: string;
     quality?: 'low' | 'medium' | 'high';  // Default: medium
   }): Promise<{ deliverableId: string; images: Asset[] }> {
     const startTime = Date.now();

     // 1. Call OpenAI gpt-image-1 provider (fixed 1024x1024)
     const provider = new OpenAIImageProvider();
     const images = await provider.generate({
       prompt: params.prompt,
       quality: params.quality || 'medium'
     });

     // 2. Track LLM usage via RunMetadataService
     const cost = this.calculateImageCost(params.quality || 'medium');
     await this.runMetadataService.insertCompletedUsage({
       provider: 'openai',
       model: 'gpt-image-1',
       isLocal: false,
       userId: params.userId,
       callerType: 'agent',
       callerName: params.agentSlug,
       conversationId: params.conversationId,
       inputTokens: this.estimatePromptTokens(params.prompt),
       outputTokens: 0,
       totalCost: cost,
       startTime,
       endTime: Date.now(),
       status: 'completed',
     });

     // 3. Store as assets via AssetsService
     // 4. Create deliverable record (type: 'image', format: 'png')
     // 5. Create version with image references
     // 6. Return deliverable ID and asset URLs
   }

   private calculateImageCost(quality: 'low' | 'medium' | 'high'): number {
     const pricing = { low: 0.01, medium: 0.16, high: 0.42 };
     return pricing[quality];
   }
   ```

3. **Delete image-agents Module**
   ```bash
   # Phase 0 cleanup - delete entire directory
   rm -rf apps/api/src/image-agents/
   ```

4. **Update Agent2AgentModule**
   ```typescript
   // Add AssetsModule import
   imports: [AssetsModule, ...]
   ```

### Phase 5.3: Deliverables Backend (2 days)

5. **Complete DeliverablesService**
   ```typescript
   // deliverables/deliverables.service.ts
   - create() - Create new deliverable
   - findByConversation() - List all for conversation
   - findById() - Get single deliverable
   - update() - Update deliverable
   - delete() - Soft delete
   ```

6. **Complete DeliverableVersionsService**
   ```typescript
   // deliverables/deliverable-versions.service.ts
   - createVersion() - Create new version
   - getVersionHistory() - List all versions
   - compareVersions() - Diff between versions
   - rollbackToVersion() - Restore old version
   ```

7. **Update DeliverablesController**
   ```typescript
   // deliverables/deliverables.controller.ts
   - GET /deliverables/conversation/:id
   - GET /deliverables/:id
   - POST /deliverables/:id/versions
   - GET /deliverables/:id/versions
   - PUT /deliverables/:id
   - DELETE /deliverables/:id
   ```

8. **Enhance Agent2AgentDeliverablesService**
   ```typescript
   // agent2agent/services/agent2agent-deliverables.service.ts
   - Handle all deliverable types (document, image, code)
   - Extract metadata from task results
   - Link to assets for images
   - Auto-create versions on edit mode
   ```

### Phase 5.4: Frontend - Deliverables UI (2 days)

9. **Create Deliverables Panel Component**
   ```typescript
   // apps/web/src/components/agent-chat/DeliverablesPanel.vue
   - List deliverables for current conversation
   - Show deliverable type icons
   - Version number display
   - Edit button → creates edit conversation
   - Download button
   - Preview rendering
   ```

10. **Add Deliverable Preview Renderers**
    ```typescript
    // apps/web/src/components/deliverables/
    - MarkdownPreview.vue (render markdown)
    - ImagePreview.vue (display images)
    - CodePreview.vue (syntax-highlighted code)
    ```

11. **Version History Dropdown**
    ```typescript
    // apps/web/src/components/deliverables/VersionHistory.vue
    - Dropdown showing all versions
    - Select version to preview
    - Compare versions side-by-side
    - Rollback button
    ```

12. **Edit Conversation Trigger**
    ```typescript
    // Update agentChatStore to support edit mode
    - createEditConversation(deliverableId)
    - Include deliverable context in first message
    - Agent knows it's editing existing deliverable
    ```

### Phase 5.5: Frontend - Image Generation (1 day)

13. **Image Generation UI**
    ```typescript
    // Enhance message input for image agents
    - Detect image_generator agent
    - Show image parameter controls (size, style, quality)
    - Display generated images in message
    - Show generation progress indicator
    ```

14. **Image Agent Service**
    ```typescript
    // apps/web/src/services/imageAgentsService.ts
    - generateImage(agentSlug, prompt, params)
    - getGenerationHistory(agentSlug, conversationId)
    ```

### Phase 5.6: Testing & Polish (0.5 days)

15. **E2E Tests**
    ```bash
    # Add to smoke tests or create comprehensive tests
    - Generate image end-to-end
    - Create deliverable from context agent
    - Create edit conversation
    - Create new version
    ```

16. **Documentation**
    - Image generation guide
    - Deliverables workflow guide
    - API documentation

## API Endpoints

### Image Generation
```
POST   /api/image-agents/:agent_slug/generate
GET    /api/image-agents/:agent_slug/history/:conversation_id
```

### Deliverables
```
GET    /api/deliverables/conversation/:conversation_id
GET    /api/deliverables/:id
POST   /api/deliverables
PUT    /api/deliverables/:id
DELETE /api/deliverables/:id

POST   /api/deliverables/:id/versions
GET    /api/deliverables/:id/versions
GET    /api/deliverables/:id/versions/:version_id
POST   /api/deliverables/:id/rollback/:version_id
```

## Example Agent Configurations

### OpenAI Image Generator (Phase 5)
```yaml
slug: image_generator
name: "Image Generator"
agent_type: image_generation

config:
  image_generation:
    provider: openai
    model: gpt-image-1
    default_parameters:
      quality: medium  # low=$0.01, medium=$0.16, high=$0.42
      size: "1024x1024"  # Fixed for Phase 5

execution_profile: conversation_only

system_prompt: |
  You are an AI image generation assistant.
  When users provide a prompt, generate an image using gpt-image-1.

  Available quality levels:
  - low: Fast, lower quality ($0.01/image)
  - medium: Balanced quality and speed ($0.16/image) [DEFAULT]
  - high: Best quality, slower ($0.42/image)

  All images are 1024x1024 pixels (square).

  Let users know they can specify quality by saying "high quality" or "low quality" in their prompt.
```

## Testing Strategy

### Backend Tests
```typescript
// image-agents/image-agents.service.spec.ts
describe('ImageAgentsService', () => {
  it('should generate image with OpenAI provider');
  it('should generate image with Gemini provider');
  it('should store image as asset');
  it('should create deliverable record');
  it('should enhance prompts when enabled');
});

// deliverables/deliverables.service.spec.ts
describe('DeliverablesService', () => {
  it('should create deliverable');
  it('should find deliverables by conversation');
  it('should create new version on edit');
  it('should maintain version history');
});
```

### E2E Tests
```bash
# Add to Phase 5 E2E suite
1. Generate image via image_generator agent
2. Verify image stored as asset
3. Verify deliverable created
4. Create edit conversation
5. Verify new version created
```

## Risks & Mitigations

### Risk: Image generation API costs
**Mitigation:** Rate limiting per user, cost tracking, quota system

### Risk: Large image storage costs
**Mitigation:** Thumbnail generation, compression, storage limits per user

### Risk: Deliverable versioning gets complex
**Mitigation:** Simple linear versioning first, branch versioning later if needed

### Risk: Preview rendering security (XSS)
**Mitigation:** Sanitize markdown, sandbox code preview, validate image sources

## Timeline Estimate
- Phase 5.1 (Text Format Types): 0.5 days
- Phase 5.2 (Image Generation): 1 day
- Phase 5.3 (Deliverables Backend): 2 days
- Phase 5.4 (Deliverables UI): 2 days
- Phase 5.5 (Image UI): 1 day
- Phase 5.6 (Testing): 0.5 days
- **Total: 7 days**

## Dependencies
- Phases 0-4 complete ✅
- OpenAI API key configured
- Google Gemini API key configured
- Supabase storage bucket configured
- Assets module working

## Definition of Done
- [ ] Image generation works with OpenAI DALL-E
- [ ] Image generation works with Gemini Imagen
- [ ] Images stored as assets
- [ ] Image deliverables created automatically
- [ ] Deliverables panel displays all deliverables
- [ ] Can create edit conversation
- [ ] Edit creates new version
- [ ] Version history visible
- [ ] Can download deliverables
- [ ] Preview rendering works (markdown, images, code)
- [ ] E2E tests pass
- [ ] Documentation complete
- [ ] Ready for Phase 6 (Orchestration)

## Future Enhancements (Post-Phase 5)
- Video generation (Sora, Runway)
- Audio generation (ElevenLabs, OpenAI TTS)
- PDF export
- Collaborative editing
- Public sharing links
- Deliverable templates
- Bulk export
