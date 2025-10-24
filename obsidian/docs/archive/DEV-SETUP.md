# 🚀 Local Development Setup

This guide will help you set up the Orchestrator AI development environment with local ports 7100/7101 and a local Supabase instance.

## 📋 Prerequisites

- Node.js (v18 or higher)
- npm or pnpm
- Docker (for Supabase)
- Supabase CLI (`npm install -g supabase`)

## 🔧 Quick Start

1. **Clone and Install Dependencies**
   ```bash
   git clone <repository>
   cd orchestrator-ai-dev
   npm install
   ```

2. **Set up Environment Variables**
   ```bash
   # Copy the development environment template
   cp dev.env.example .env
   
   # Edit .env and add your API keys
   nano .env  # or use your preferred editor
   ```

3. **Start Development Environment**
   ```bash
   # This will start everything: Supabase, API (port 7100), and Web (port 7101)
   ./start-dev-local.sh
   ```

## 🌐 Access Points

Once everything is running, you can access:

- **Web Application**: http://localhost:7101
- **API Server**: http://localhost:7100
- **Supabase Studio**: http://127.0.0.1:7015
- **Email Testing (Inbucket)**: http://127.0.0.1:7016

## 🗄️ Database Setup

The local Supabase instance includes:
- **Database**: PostgreSQL on port 7012
- **API**: REST and GraphQL APIs on port 7010
- **Auth**: Built-in authentication system
- **Storage**: File storage system
- **Realtime**: WebSocket connections

### Database Connection Details
```
Host: 127.0.0.1
Port: 7012
Database: postgres
Username: postgres
Password: postgres
```

## 🔑 Environment Variables

Key environment variables for development:

```bash
# Ports
API_PORT=7100
WEB_PORT=7101

# Supabase Local
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# API Keys (add your own)
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
PERPLEXITY_API_KEY=your_key_here
```

## 🛠️ Manual Setup (Alternative)

If you prefer to start services manually:

1. **Start Supabase**
   ```bash
   cd apps/api
   supabase start
   ```

2. **Start API Server**
   ```bash
   cd apps/api
   npm run start:dev
   ```

3. **Start Web Server**
   ```bash
   cd apps/web
   npm run dev:http
   ```

## 🔄 Port Changes from Server Version

This development version uses different ports from the server version:

| Service | Server Version | Dev Version |
|---------|---------------|-------------|
| API     | 9000          | 7100        |
| Web     | 9001          | 7101        |
| HTTPS   | 9443          | 7543        |

## 🐛 Troubleshooting

### Supabase Issues
```bash
# Reset Supabase if needed
cd apps/api
supabase stop
supabase start
```

### Port Conflicts
```bash
# Check what's using the ports
lsof -i :7100
lsof -i :7101
```

### Environment Issues
```bash
# Make sure .env exists and has correct values
cat .env | grep -E "(API_PORT|WEB_PORT|SUPABASE_URL)"
```

## 📝 Development Notes

- The local Supabase instance persists data in Docker volumes
- Migrations are automatically applied when Supabase starts
- The development environment includes debug logging
- Hot reload is enabled for both API and Web servers

## 🔒 Security Notes

- Local Supabase uses default development keys (safe for local dev only)
- Never commit real API keys to version control
- The .env file is gitignored for security

## 📚 Additional Resources

- [Supabase Local Development](https://supabase.com/docs/guides/local-development)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Vue.js Documentation](https://vuejs.org/guide/)
- [Ionic Vue Documentation](https://ionicframework.com/docs/vue/overview)
