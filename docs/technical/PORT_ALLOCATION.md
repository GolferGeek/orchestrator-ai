# Orchestrator AI Port Allocation

## Reserved Port Range: 9000-9020

We use a dedicated port range (9000-9020) for all Orchestrator AI services to avoid conflicts with other applications and make the system easy to manage.

## Port Assignments

### Core Applications
| Port | Service | Description |
|------|---------|-------------|
| 9000 | API Server | NestJS backend API |
| 9001 | Web App | Vue.js frontend application |
| 9002 | *Reserved* | API Documentation/Swagger UI |

### Supabase Services
| Port | Service | Description |
|------|---------|-------------|
| 9010 | Supabase API | Kong API Gateway (main Supabase endpoint) |
| 9011 | PostgreSQL | Database server |
| 9012 | Supabase Studio | Database management UI |
| 9013 | *Reserved* | Supabase Auth service |
| 9014 | *Reserved* | Supabase Realtime |
| 9015 | Analytics | Supabase Analytics backend |
| 9016 | Inbucket | Email testing web interface |
| 9017 | *Reserved* | SMTP port for email testing |
| 9018 | *Reserved* | POP3 port for email testing |
| 9019 | Shadow DB | Database shadow port for migrations |
| 9020 | Pooler | Connection pooler (when enabled) |

### Future Services (Reserved)
| Port | Planned Service |
|------|-----------------|
| 9003-9009 | Additional microservices |
| 9083 | Edge Functions Inspector |

## Environment Variables

Add these to your `.env` file:

```env
# Core Services
API_PORT=9000
WEB_PORT=9001

# Supabase Local
SUPABASE_LOCAL_URL=http://localhost:9010
```

## Quick Start

1. Start Supabase: `cd supabase && supabase start`
2. Start API: `cd apps/api && npm run dev` (runs on port 9000)
3. Start Web: `cd apps/web && npm run dev` (runs on port 9001)

## Access Points

- **API**: http://localhost:9000
- **Web App**: http://localhost:9001
- **Supabase API**: http://localhost:9010
- **Supabase Studio**: http://localhost:9012
- **Email Testing**: http://localhost:9016

## Benefits

- **No Conflicts**: Avoids common ports used by other development tools
- **Easy to Remember**: Sequential numbering in the 9000 range
- **Room for Growth**: 20 ports allocated with room for expansion
- **Clear Organization**: Grouped by service type