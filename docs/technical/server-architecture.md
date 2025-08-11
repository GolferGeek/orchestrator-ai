# Small Business Server - Technical Architecture

## Overview

This document outlines the technical architecture for transforming Orchestrator-AI into a self-contained small business server solution. The architecture supports a hybrid deployment model: development via npm scripts, production via Docker containers.

## Architecture Principles

### 1. Hybrid Deployment Strategy
- **Development**: npm scripts for hot reloading and debugging
- **Production**: Docker containers for reliability and isolation
- **Infrastructure**: Shared services (Supabase, Ollama) in Docker

### 2. Database Strategy
- **Local Development**: Single Supabase instance, multiple databases
- **Client Production**: Dedicated Supabase instance per client
- **Migration**: Clean export/import from SaaS to local

### 3. Resource Optimization
- **Development Server**: 128GB RAM, shared Ollama instance
- **Client Minimum**: 16GB RAM, optional local models
- **Scalability**: Performance profiles based on available resources

## System Architecture

### Development Environment (Your Mac Studio)

```
┌─────────────────────────────────────────────────────────────┐
│ Mac Studio - Development Server (128GB RAM)                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐│
│ │ Docker Services │ │ npm Services    │ │ External Access ││
│ │                 │ │                 │ │                 ││
│ │ ┌─────────────┐ │ │ ┌─────────────┐ │ │ ┌─────────────┐ ││
│ │ │ Supabase    │ │ │ │ NestJS API  │ │ │ │ Nginx       │ ││
│ │ │ - orchestrator│ │ │ │ :4000      │ │ │ │ :80/:443    │ ││
│ │ │ - hierarchy  │ │ │ │ (hot reload)│ │ │ │ SSL + Proxy │ ││
│ │ │ - demos      │ │ │ └─────────────┘ │ │ └─────────────┘ ││
│ │ └─────────────┘ │ │                 │ │                 ││
│ │                 │ │ ┌─────────────┐ │ │                 ││
│ │ ┌─────────────┐ │ │ │ Vue Web     │ │ │                 ││
│ │ │ Ollama      │ │ │ │ :3000       │ │ │                 ││
│ │ │ - llama3    │ │ │ │ (hot reload)│ │ │                 ││
│ │ │ - mistral   │ │ │ └─────────────┘ │ │                 ││
│ │ │ - codellama │ │ │                 │ │                 ││
│ │ └─────────────┘ │ │                 │ │                 ││
│ └─────────────────┘ └─────────────────┘ └─────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Client Production Environment

```
┌─────────────────────────────────────────────────────────────┐
│ Client Server (16-64GB RAM)                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Docker Compose Stack                                    │ │
│ │                                                         │ │
│ │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │ │
│ │ │ PostgreSQL  │ │ NestJS App  │ │ Vue Web App │       │ │
│ │ │ :5432       │ │ :4000       │ │ :3000       │       │ │
│ │ │             │ │             │ │             │       │ │
│ │ │ Supabase DB │ │ Production  │ │ Production  │       │ │
│ │ └─────────────┘ └─────────────┘ └─────────────┘       │ │
│ │                                                         │ │
│ │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │ │
│ │ │ Auth Server │ │ Ollama      │ │ Nginx       │       │ │
│ │ │ :9999       │ │ :11434      │ │ :80/:443    │       │ │
│ │ │             │ │ (optional)  │ │             │       │ │
│ │ │ Supabase    │ │ Local Models│ │ SSL + Proxy │       │ │
│ │ └─────────────┘ └─────────────┘ └─────────────┘       │ │
│ │                                                         │ │
│ │ ┌─────────────┐ ┌─────────────┐                       │ │
│ │ │ Monitoring  │ │ Backup      │                       │ │
│ │ │ Grafana     │ │ Automated   │                       │ │
│ │ │ Prometheus  │ │ S3/Local    │                       │ │
│ │ └─────────────┘ └─────────────┘                       │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Component Specifications

### 1. Supabase Configuration

#### Development Configuration
```typescript
// supabase.config.ts
export default registerAs('supabase', () => ({
  mode: process.env.SUPABASE_MODE || 'cloud',
  local: {
    url: process.env.SUPABASE_LOCAL_URL || 'http://localhost:8000',
    anonKey: process.env.SUPABASE_LOCAL_ANON_KEY,
    serviceKey: process.env.SUPABASE_LOCAL_SERVICE_KEY,
    database: process.env.SUPABASE_LOCAL_DB || 'orchestrator_ai'
  },
  cloud: {
    url: process.env.SUPABASE_CLOUD_URL,
    anonKey: process.env.SUPABASE_CLOUD_ANON_KEY,
    serviceKey: process.env.SUPABASE_CLOUD_SERVICE_KEY
  }
}));
```

#### Database Schema Strategy
```sql
-- Local Supabase Instance Structure
-- Database: orchestrator_ai (main development)
-- Database: hierarchy_ai (your other project)
-- Database: client_demo_1 (demo scenarios)
-- Database: client_demo_2 (industry-specific demos)

-- Each database has identical schema but isolated data
-- Shared auth system across databases
```

### 2. Docker Infrastructure

#### Development Services (docker/development/)
```yaml
# supabase.yml - Your shared development infrastructure
version: '3.8'
services:
  supabase-db:
    image: supabase/postgres:15.1.0.117
    ports:
      - "5432:5432"
    environment:
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init:/docker-entrypoint-initdb.d/
    
  supabase-auth:
    image: supabase/gotrue:v2.132.3
    ports:
      - "9999:9999"
    environment:
      GOTRUE_API_HOST: 0.0.0.0
      GOTRUE_API_PORT: 9999
      GOTRUE_DB_DRIVER: postgres
      DATABASE_URL: postgresql://postgres:postgres@supabase-db:5432/postgres
    depends_on:
      - supabase-db

  supabase-kong:
    image: kong:2.8-alpine
    ports:
      - "8000:8000"
      - "8443:8443"
    environment:
      KONG_DATABASE: "off"
      KONG_DECLARATIVE_CONFIG: /var/lib/kong/kong.yml
    volumes:
      - ./kong.yml:/var/lib/kong/kong.yml
    depends_on:
      - supabase-auth

  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    environment:
      OLLAMA_HOST: 0.0.0.0:11434
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]

volumes:
  postgres_data:
  ollama_data:
```

#### Production Deployment (docker/production/)
```yaml
# docker-compose.yml - Client production deployment
version: '3.8'
services:
  app-db:
    image: supabase/postgres:15.1.0.117
    environment:
      POSTGRES_DB: ${DB_NAME:-orchestrator_ai}
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./migrations:/docker-entrypoint-initdb.d/
    restart: unless-stopped

  app-auth:
    image: supabase/gotrue:v2.132.3
    environment:
      GOTRUE_API_HOST: 0.0.0.0
      GOTRUE_API_PORT: 9999
      DATABASE_URL: postgresql://${DB_USER:-postgres}:${DB_PASSWORD}@app-db:5432/${DB_NAME:-orchestrator_ai}
      GOTRUE_JWT_SECRET: ${JWT_SECRET}
      GOTRUE_SITE_URL: https://${DOMAIN}
    depends_on:
      - app-db
    restart: unless-stopped

  app-api:
    build: 
      context: .
      dockerfile: Dockerfile.api
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${DB_USER:-postgres}:${DB_PASSWORD}@app-db:5432/${DB_NAME:-orchestrator_ai}
      SUPABASE_URL: http://app-kong:8000
      SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    depends_on:
      - app-auth
      - app-kong
    restart: unless-stopped

  app-web:
    build:
      context: .
      dockerfile: Dockerfile.web
    environment:
      VITE_API_URL: https://${DOMAIN}/api
    restart: unless-stopped

  app-kong:
    image: kong:2.8-alpine
    environment:
      KONG_DATABASE: "off"
      KONG_DECLARATIVE_CONFIG: /var/lib/kong/kong.yml
    volumes:
      - ./kong.prod.yml:/var/lib/kong/kong.yml
    depends_on:
      - app-auth
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
      - certbot_data:/var/www/certbot
    depends_on:
      - app-web
      - app-api
    restart: unless-stopped

  certbot:
    image: certbot/certbot
    volumes:
      - ./ssl:/etc/letsencrypt
      - certbot_data:/var/www/certbot
    command: certonly --webroot --webroot-path=/var/www/certbot --email ${ADMIN_EMAIL} --agree-tos --no-eff-email -d ${DOMAIN}

  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    environment:
      OLLAMA_HOST: 0.0.0.0:11434
    profiles:
      - gpu
    restart: unless-stopped

  monitoring:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana.ini:/etc/grafana/grafana.ini
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
    profiles:
      - monitoring
    restart: unless-stopped

volumes:
  postgres_data:
  ollama_data:
  grafana_data:
  certbot_data:
```

### 3. Environment Configuration

#### Development (.env.development)
```bash
# Supabase Configuration
SUPABASE_MODE=local
SUPABASE_LOCAL_URL=http://localhost:8000
SUPABASE_LOCAL_ANON_KEY=your-local-anon-key
SUPABASE_LOCAL_SERVICE_KEY=your-local-service-key
SUPABASE_LOCAL_DB=orchestrator_ai

# Application Ports
API_PORT=4000
WEB_PORT=3000

# AI Services
ANTHROPIC_API_KEY=your-api-key
OLLAMA_URL=http://localhost:11434

# Development Settings
NODE_ENV=development
DEBUG=true
```

#### Production (.env.production)
```bash
# Domain and SSL
DOMAIN=client-domain.com
ADMIN_EMAIL=admin@client-domain.com

# Database
DB_NAME=orchestrator_ai
DB_USER=postgres
DB_PASSWORD=secure-random-password

# Supabase
SUPABASE_ANON_KEY=production-anon-key
JWT_SECRET=secure-jwt-secret

# AI Services
ANTHROPIC_API_KEY=client-api-key

# Security
GRAFANA_PASSWORD=secure-grafana-password

# Optional Features
COMPOSE_PROFILES=gpu,monitoring  # Enable GPU and monitoring
```

### 4. Nginx Configuration

#### Development Proxy
```nginx
# nginx/dev.conf
upstream api {
    server localhost:4000;
}

upstream web {
    server localhost:3000;
}

server {
    listen 80;
    server_name localhost;

    # API proxy
    location /api {
        proxy_pass http://api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Web app
    location / {
        proxy_pass http://web;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support for hot reload
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

#### Production Configuration
```nginx
# nginx.conf - Production with SSL
events {
    worker_connections 1024;
}

http {
    upstream api {
        server app-api:4000;
    }

    upstream web {
        server app-web:3000;
    }

    # Redirect HTTP to HTTPS
    server {
        listen 80;
        server_name ${DOMAIN};
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        location / {
            return 301 https://$server_name$request_uri;
        }
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name ${DOMAIN};

        ssl_certificate /etc/nginx/ssl/live/${DOMAIN}/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/live/${DOMAIN}/privkey.pem;

        # Security headers
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Frame-Options DENY always;
        add_header X-Content-Type-Options nosniff always;

        # API proxy
        location /api {
            proxy_pass http://api;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Increase timeouts for AI processing
            proxy_read_timeout 300s;
            proxy_connect_timeout 10s;
        }

        # Web application
        location / {
            proxy_pass http://web;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Static assets caching
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            proxy_pass http://web;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

### 5. Migration Strategy

#### From SaaS to Local Supabase
```bash
#!/bin/bash
# migrate-to-local.sh

echo "🔄 Migrating from Supabase SaaS to local instance..."

# 1. Export schema from SaaS
supabase db dump --db-url "$SUPABASE_CLOUD_URL" --schema public > schema.sql

# 2. Export data (selective)
pg_dump "$SUPABASE_CLOUD_CONNECTION" \
    --table=agent_conversations \
    --table=tasks \
    --table=deliverables \
    --data-only > data.sql

# 3. Start local Supabase
docker-compose -f docker/development/supabase.yml up -d

# 4. Wait for services to be ready
sleep 30

# 5. Apply schema to local
psql "$SUPABASE_LOCAL_CONNECTION" < schema.sql

# 6. Apply data to local
psql "$SUPABASE_LOCAL_CONNECTION" < data.sql

echo "✅ Migration complete!"
```

## Performance Optimization

### Resource Profiles

#### Minimum (16GB RAM)
- No local Ollama (API fallback)
- Basic monitoring
- Single worker processes

#### Recommended (32GB RAM)
- Small Ollama models (7B parameters)
- Full monitoring stack
- Multi-worker processes

#### Optimal (64GB+ RAM)
- Large Ollama models (13B+ parameters)
- Advanced monitoring and logging
- High-performance configurations

### Scaling Strategies

#### Horizontal Scaling
- Load balancer in front of multiple app instances
- Shared database with connection pooling
- Redis for session management

#### Vertical Scaling
- Auto-scaling Docker containers
- Dynamic resource allocation
- Performance monitoring triggers

## Security Architecture

### Network Security
- All external traffic through Nginx reverse proxy
- Internal service communication on private network
- Firewall rules limiting exposed ports

### Data Security
- Database encryption at rest
- SSL/TLS for all external communication
- Environment variable secret management
- Regular automated backups

### Access Control
- Supabase Row Level Security (RLS)
- JWT-based authentication
- Role-based permissions
- API rate limiting

## Monitoring and Observability

### Health Checks
- Docker container health checks
- Database connection monitoring
- API endpoint health checks
- Ollama model availability checks

### Metrics Collection
- Application performance metrics
- Resource usage monitoring
- Error rate tracking
- User activity analytics

### Alerting
- System resource thresholds
- Application error rates
- Database performance issues
- SSL certificate expiration

## Deployment Pipeline

### Development Workflow
```bash
# Start development environment
./scripts/dev-start.sh

# Runs:
# 1. docker-compose -f docker/development/supabase.yml up -d
# 2. npm run dev:api
# 3. npm run dev:web
```

### Client Deployment
```bash
# One-command client deployment
./scripts/deploy-client.sh

# Runs:
# 1. Environment validation
# 2. Docker image builds
# 3. SSL certificate generation
# 4. docker-compose up -d
# 5. Health checks
# 6. Post-deployment verification
```

## Next Steps

1. Implement dual Supabase configuration
2. Create Docker Compose templates
3. Build migration scripts
4. Develop deployment automation
5. Create monitoring dashboards
6. Test end-to-end deployment process