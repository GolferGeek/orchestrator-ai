# Orchestrator AI Production Deployment Guide

This guide covers deploying Orchestrator AI to production with Docker Compose, ensuring data persistence and reliable operation.

## 🚀 Quick Start

### 1. Start Production Environment
```bash
# Start everything with one command
npm run prod:start

# Or use the management script
./deployment/manage-production.sh start
```

### 2. Check Status
```bash
# View all services
npm run prod:status

# Check health
npm run prod:health
```

### 3. View Logs
```bash
# All services
npm run prod:logs

# Specific service
./deployment/manage-production.sh logs-api
./deployment/manage-production.sh logs-web
./deployment/manage-production.sh logs-db
```

## 📁 File Structure

```
orchestrator-ai/
├── docker-compose.production.yml    # Production Docker Compose
├── .env.production                  # Production environment variables
├── deployment/
│   ├── start-production.sh         # Production startup script
│   ├── manage-production.sh        # Management script
│   ├── nginx/                      # Nginx configurations
│   └── ssl/                        # SSL certificates
├── apps/
│   ├── api/Dockerfile              # API Dockerfile
│   └── web/Dockerfile              # Web app Dockerfile
└── supabase/
    └── supabase/
        ├── config.toml             # Supabase configuration
        └── migrations/             # Database migrations
```

## 🔧 Services Overview

| Service | Port | Description | Data Persistence |
|---------|------|-------------|------------------|
| **API** | 9000 | NestJS backend | ✅ Environment variables |
| **Web** | 9001 | Vue.js frontend | ✅ Environment variables |
| **Database** | 9011 | PostgreSQL | ✅ Docker volume |
| **Supabase API** | 9010 | Kong gateway | ✅ Configuration |
| **Supabase Studio** | 9012 | Database UI | ✅ Configuration |
| **Email Testing** | 9016 | Inbucket | ❌ Temporary |
| **Nginx** | 80/443 | Reverse proxy | ✅ SSL certificates |

## 💾 Data Persistence

### Database Data
- **Location**: Docker volume `supabase_data`
- **Persistence**: ✅ Survives restarts and reboots
- **Backup**: Automatic with `npm run prod:backup`
- **Restore**: `./deployment/manage-production.sh restore <backup_file>`

### Storage Data
- **Location**: Docker volume `storage_data`
- **Persistence**: ✅ Survives restarts and reboots

### Environment Variables
- **Location**: `.env.production`
- **Persistence**: ✅ File-based configuration
- **Security**: ⚠️ Contains sensitive API keys

## 🛠️ Management Commands

### NPM Scripts
```bash
# Start production environment
npm run prod:start

# Check status
npm run prod:status

# View logs
npm run prod:logs

# Stop services
npm run prod:stop

# Restart services
npm run prod:restart

# Create backup
npm run prod:backup

# Check health
npm run prod:health
```

### Management Script
```bash
# Show all commands
./deployment/manage-production.sh help

# Start/stop/restart
./deployment/manage-production.sh start
./deployment/manage-production.sh stop
./deployment/manage-production.sh restart

# Status and logs
./deployment/manage-production.sh status
./deployment/manage-production.sh logs
./deployment/manage-production.sh logs-api
./deployment/manage-production.sh logs-web
./deployment/manage-production.sh logs-db

# Database operations
./deployment/manage-production.sh backup
./deployment/manage-production.sh restore <backup_file>

# Maintenance
./deployment/manage-production.sh update
./deployment/manage-production.sh clean
./deployment/manage-production.sh health

# Debugging
./deployment/manage-production.sh shell
./deployment/manage-production.sh db-shell
```

## 🔄 Auto-Start on Boot

### macOS (using launchd)
```bash
# Copy service file
sudo cp deployment/orchestrator-ai.service /Library/LaunchDaemons/

# Load and start service
sudo launchctl load /Library/LaunchDaemons/orchestrator-ai.service

# Enable auto-start
sudo launchctl enable system/orchestrator-ai
```

### Linux (using systemd)
```bash
# Copy service file
sudo cp deployment/orchestrator-ai.service /etc/systemd/system/

# Enable and start service
sudo systemctl enable orchestrator-ai
sudo systemctl start orchestrator-ai

# Check status
sudo systemctl status orchestrator-ai
```

## 🔒 Security Considerations

### Environment Variables
- Keep `.env.production` secure and never commit to git
- Use environment-specific API keys for production
- Regularly rotate API keys

### Database Security
- Default PostgreSQL password is `postgres` (change for production)
- Database is only accessible from Docker network
- Consider enabling SSL for database connections

### Network Security
- Services communicate via Docker network
- Only necessary ports are exposed
- Nginx handles external access

## 📊 Monitoring and Logs

### Health Checks
All services include health checks:
- **Database**: PostgreSQL readiness check
- **API**: HTTP health endpoint
- **Web**: HTTP availability check

### Log Management
```bash
# View all logs
docker-compose -f docker-compose.production.yml logs -f

# View specific service logs
docker-compose -f docker-compose.production.yml logs -f api
docker-compose -f docker-compose.production.yml logs -f web
docker-compose -f docker-compose.production.yml logs -f supabase-db
```

### Log Rotation
Consider setting up log rotation for production:
```bash
# Add to /etc/logrotate.d/docker
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    size=1M
    missingok
    delaycompress
    copytruncate
}
```

## 🔧 Troubleshooting

### Common Issues

#### Services Won't Start
```bash
# Check Docker status
docker info

# Check available resources
docker system df

# Clean up Docker
./deployment/manage-production.sh clean
```

#### Database Connection Issues
```bash
# Check database health
./deployment/manage-production.sh health

# Check database logs
./deployment/manage-production.sh logs-db

# Access database shell
./deployment/manage-production.sh db-shell
```

#### API/Web App Issues
```bash
# Check service health
./deployment/manage-production.sh health

# Check specific logs
./deployment/manage-production.sh logs-api
./deployment/manage-production.sh logs-web

# Restart services
./deployment/manage-production.sh restart
```

#### Port Conflicts
```bash
# Check what's using ports
lsof -i :9000
lsof -i :9001
lsof -i :9010

# Kill conflicting processes
npm run kill:9000
npm run kill:9001
```

### Recovery Procedures

#### Complete Reset
```bash
# Stop all services
./deployment/manage-production.sh stop

# Remove all containers and volumes
docker-compose -f docker-compose.production.yml down -v

# Start fresh
./deployment/manage-production.sh start
```

#### Database Recovery
```bash
# Create backup before any changes
./deployment/manage-production.sh backup

# Restore from backup if needed
./deployment/manage-production.sh restore backup_YYYYMMDD_HHMMSS.sql
```

## 🚀 Production Checklist

Before going live:

- [ ] Update `.env.production` with production API keys
- [ ] Configure domain DNS to point to server
- [ ] Set up SSL certificates with Let's Encrypt
- [ ] Update nginx configuration for your domain
- [ ] Test all services with `npm run prod:health`
- [ ] Create initial database backup
- [ ] Set up auto-start on boot
- [ ] Configure log rotation
- [ ] Set up monitoring/alerting
- [ ] Test backup and restore procedures

## 📞 Support

For issues or questions:
1. Check logs: `npm run prod:logs`
2. Check health: `npm run prod:health`
3. Review this documentation
4. Check Docker and system resources
