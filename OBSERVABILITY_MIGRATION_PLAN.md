# Observability Integration Migration Plan

## Overview
Migrating the claude-code-hooks-multi-agent-observability project into `apps/observability` in the orchestrator-ai monorepo.

**Source**: https://github.com/disler/claude-code-hooks-multi-agent-observability
**Target**: `apps/observability/` in orchestrator-ai monorepo
**Branch**: `feature/observability-integration`

## Source Project Analysis

### Backend (Bun Server)
- **Runtime**: Bun
- **Port**: 4000 (configurable via `SERVER_PORT`)
- **Database**: SQLite
- **Dependencies**: `sqlite`, `sqlite3`
- **Key Files**:
  - `apps/server/src/index.ts` - Main server with HTTP/WebSocket support
  - `apps/server/src/db.ts` - Database operations
  - `apps/server/src/theme.ts` - Theme management
  - `apps/server/src/types.ts` - TypeScript types

### Frontend (Vue 3 Client)
- **Framework**: Vue 3 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Port**: 5173 (Vite default)
- **Dependencies**: vue, chart.js (implied), tailwindcss
- **Key Components**:
  - Event timeline visualization
  - Filtering and search
  - Real-time WebSocket updates
  - HITL (Human-in-the-Loop) response UI
  - Theme management UI

### Hooks (Python Scripts)
Located in `.claude/hooks/`:
- `send_event.py` - Core event sender
- `post_tool_use.py` - Post tool execution hook
- `pre_tool_use.py` - Pre tool execution hook
- `notification.py` - Notification events
- `session_start.py` / `session_end.py` - Session lifecycle
- `user_prompt_submit.py` - User prompt events
- `stop.py` / `subagent_stop.py` - Stop events
- Utils in `utils/` directory

## Migration Strategy

### Phase 1: Directory Structure Setup
```
apps/observability/
├── server/                    # Backend (Node/Express)
│   ├── src/
│   │   ├── index.ts          # Main server
│   │   ├── db.ts             # Database layer (Supabase client)
│   │   ├── theme.ts          # Theme management
│   │   └── types.ts          # Type definitions
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── client/                    # Frontend (Vue 3)
│   ├── src/
│   │   ├── App.vue
│   │   ├── components/
│   │   ├── composables/
│   │   └── types/
│   ├── public/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── .env.example
├── hooks/                     # TypeScript hooks (converted from Python)
│   ├── send-event.ts
│   ├── post-tool-use.ts
│   ├── pre-tool-use.ts
│   └── utils/
└── README.md

apps/api/supabase/migrations/
└── 20251026000000_create_observability_schema.sql  # New migration for observability tables
```

### Phase 2: Backend Migration (Bun → Node.js)

#### Changes Required:
1. **Replace Bun.serve with Express + ws library**
   - Use `express` for HTTP routes
   - Use `ws` (WebSocket) library for WebSocket support
   - Port all route handlers

2. **Supabase Integration (PostgreSQL)**
   - Replace SQLite with Supabase Postgres client
   - Create new `observability` schema in Supabase
   - Port database queries to use Supabase client
   - Convert table schemas to PostgreSQL
   - Use Supabase real-time subscriptions (optional enhancement)

3. **WebSocket Handling**
   - Convert Bun's built-in WebSocket to `ws` library
   - Maintain client set for broadcasting
   - Keep upgrade logic
   - Could leverage Supabase real-time later

4. **Dependencies**:
```json
{
  "express": "^4.18.2",
  "ws": "^8.14.2",
  "cors": "^2.8.5",
  "@supabase/supabase-js": "^2.57.0"
}
```

#### Port Assignment:
- Server: **4100** (to avoid conflicts with existing 7100, 9000, etc.)
- Client: **4101** (Vite dev server)

### Phase 3: Frontend Migration

#### Minimal Changes Needed:
1. **Update API URLs** - Point to new server port (4100)
2. **Keep Existing Structure** - Vue 3 + Vite already compatible
3. **Tailwind Configuration** - Maintain existing setup
4. **Dependencies** - Add any missing libraries (chart.js, etc.)

### Phase 4: Python → TypeScript Hook Conversion

#### Conversion Strategy:
1. **Use Node.js fetch/axios** instead of `urllib.request`
2. **Read stdin** using Node.js streams
3. **Process JSON** using native JSON.parse/stringify
4. **Command-line args** using `commander` or `yargs`

#### Example Hook Structure:
```typescript
#!/usr/bin/env node
import { sendEventToServer } from './utils/send-event';

async function main() {
  const input = await readStdin();
  const eventData = {
    source_app: 'orchestrator-ai',
    session_id: input.session_id || 'unknown',
    hook_event_type: 'PostToolUse',
    payload: input,
    timestamp: Date.now()
  };

  await sendEventToServer(eventData);
  process.exit(0);
}

main();
```

### Phase 5: Monorepo Integration

#### 1. Update Root package.json
Add workspace and scripts:
```json
{
  "workspaces": [
    "apps/api",
    "apps/web",
    "apps/observability/server",
    "apps/observability/client"
  ],
  "scripts": {
    "observability:server": "cd apps/observability/server && npm run dev",
    "observability:client": "cd apps/observability/client && npm run dev",
    "observability:dev": "concurrently \"npm run observability:server\" \"npm run observability:client\"",
    "observability:setup": "cd apps/observability/server && npm install && cd ../client && npm install"
  }
}
```

#### 2. Create Startup Scripts
- `apps/observability/start.sh` - Start both server and client
- Add to main `start-dev-local.sh` if desired

### Phase 6: Configuration & Environment

#### Server .env
```env
SERVER_PORT=4100
NODE_ENV=development
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=<from-local-supabase>
```

#### Client .env
```env
VITE_API_URL=http://localhost:4100
VITE_WS_URL=ws://localhost:4100/stream
```

#### Supabase Migration
Create `apps/api/supabase/migrations/20251026000000_create_observability_schema.sql`:
- Schema: `observability` (separate from `public`)
- Tables: `events`, `themes`, `theme_shares`, `theme_ratings`
- Indexes for performance
- RLS policies for security

## Key Technical Decisions

### 1. Backend Runtime: Node.js (not Bun)
**Rationale**:
- Consistency with existing NestJS API
- Better compatibility with npm workspaces
- More mature WebSocket libraries

### 2. Database: Use Supabase (PostgreSQL)
**Rationale**:
- Consistency with existing orchestrator-ai infrastructure
- Better integration with the monorepo
- Real-time subscriptions available (can leverage later)
- Easier to manage and backup
- Can leverage existing Supabase setup
- New `observability` schema for clean separation from `public` schema
- Better for production use

### 3. Standalone vs Integrated
**Decision**: Standalone apps in monorepo
- Separate server from main NestJS API
- Independent scaling and deployment
- Clear separation of concerns
- Can be optionally run

### 4. Hook Language: TypeScript
**Rationale**:
- Consistency with monorepo
- Better type safety
- Easier integration with existing tooling
- Node.js readily available in dev environments

## Implementation Order

1. ✅ Create feature branch
2. ✅ Clone and analyze source
3. ✅ Update migration plan for Supabase
4. 🔄 Create Supabase migration for observability schema
5. Create directory structure
6. Create backend package.json and dependencies
7. Port server code (Bun → Node/Express)
8. Port database layer (SQLite → Supabase)
9. Port types and theme management
10. Set up frontend project
11. Copy Vue components and adapt
12. Convert Python hooks to TypeScript
13. Update workspace configuration
14. Update start-dev-local.sh to include observability servers
15. Create startup scripts
16. Test end-to-end
17. Documentation

## Testing Plan

1. **Backend**: Test all HTTP endpoints and WebSocket connection
2. **Frontend**: Verify UI loads and connects to WebSocket
3. **Hooks**: Test event sending from TypeScript hooks
4. **Integration**: Run full flow with Claude Code hooks
5. **Performance**: Verify real-time updates work smoothly

## Success Criteria

- [x] Feature branch created
- [x] Migration plan updated for Supabase
- [ ] Supabase migration created and applied
- [ ] Backend server running on Node.js (port 4100)
- [ ] Backend connected to Supabase
- [ ] Frontend client running (port 4101)
- [ ] TypeScript hooks can send events successfully
- [ ] Real-time WebSocket updates working
- [ ] HITL functionality operational
- [ ] Theme management working
- [ ] Integrated into monorepo workspace
- [ ] Start scripts updated in start-dev-local.sh
- [ ] Documentation complete
- [ ] All components started via npm scripts

## Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| WebSocket compatibility issues | Use well-tested `ws` library, maintain same protocol |
| Port conflicts | Use unique ports (4100, 4101) |
| Supabase connection issues | Use existing Supabase setup, proper error handling |
| Schema conflicts | Use dedicated `observability` schema |
| Hook execution permissions | Ensure shebang and execute permissions set correctly |
| TypeScript hook debugging | Add verbose logging and error handling |

## Next Steps

1. Create Supabase migration for observability schema
2. Create the directory structure
3. Set up backend package.json with Node dependencies (including Supabase client)
4. Convert the Bun server to Express + ws
5. Port database layer to use Supabase instead of SQLite
6. Test basic HTTP/WebSocket functionality with Supabase
7. Move to frontend migration
8. Convert hooks last (after backend is stable)
9. Update start-dev-local.sh to start observability servers

## Database Schema Notes

The observability schema will include:

### Events Table
- `id`: bigserial primary key
- `source_app`: text (e.g., 'orchestrator-ai', 'claude-code')
- `session_id`: text
- `hook_event_type`: text (e.g., 'PreToolUse', 'PostToolUse')
- `payload`: jsonb (flexible event data)
- `chat`: jsonb nullable (chat transcript)
- `summary`: text nullable (AI-generated summary)
- `timestamp`: bigint (milliseconds since epoch)
- `human_in_the_loop`: jsonb nullable (HITL data)
- `human_in_the_loop_status`: jsonb nullable (HITL response status)
- `model_name`: text nullable
- `created_at`: timestamptz default now()

### Themes Table
- `id`: text primary key (uuid)
- `name`: text unique
- `display_name`: text
- `description`: text nullable
- `colors`: jsonb (color configuration)
- `is_public`: boolean default false
- `author_id`: text nullable
- `author_name`: text nullable
- `created_at`: timestamptz
- `updated_at`: timestamptz
- `tags`: jsonb (array of tags)
- `download_count`: integer default 0
- `rating`: decimal nullable
- `rating_count`: integer default 0

### Theme Shares Table
- `id`: text primary key (uuid)
- `theme_id`: text (foreign key to themes)
- `share_token`: text unique
- `expires_at`: timestamptz nullable
- `is_public`: boolean default false
- `allowed_users`: jsonb nullable (array of user IDs)
- `created_at`: timestamptz
- `access_count`: integer default 0

### Theme Ratings Table
- `id`: text primary key (uuid)
- `theme_id`: text (foreign key to themes)
- `user_id`: text
- `rating`: integer (1-5)
- `comment`: text nullable
- `created_at`: timestamptz
- Unique constraint on (theme_id, user_id)
