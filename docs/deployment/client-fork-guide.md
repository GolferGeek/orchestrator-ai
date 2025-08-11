# Client Fork and Deployment Guide

## Overview

This guide walks through the complete process of setting up a dedicated Orchestrator-AI server for a small business client. The process involves forking the codebase, customizing it for the client, and deploying it on their dedicated hardware.

## Prerequisites

### Client Hardware Requirements

#### Minimum Configuration
- **RAM**: 16GB
- **CPU**: 4 cores (Intel i5 or AMD Ryzen 5 equivalent)
- **Storage**: 500GB SSD
- **Network**: Broadband connection with static IP
- **OS**: Ubuntu 22.04 LTS or Docker-compatible Linux

#### Recommended Configuration
- **RAM**: 32GB (for local AI models)
- **CPU**: 8 cores (Intel i7 or AMD Ryzen 7 equivalent)
- **Storage**: 1TB NVMe SSD
- **Network**: Business broadband with static IP
- **OS**: Ubuntu 22.04 LTS

#### Optimal Configuration
- **RAM**: 64GB+ (for large AI models)
- **CPU**: 12+ cores (Intel i9 or AMD Ryzen 9 equivalent)
- **Storage**: 2TB+ NVMe SSD
- **Network**: Fiber connection with static IP
- **OS**: Ubuntu 22.04 LTS

### Software Prerequisites
- Docker and Docker Compose
- Git
- Basic Linux/terminal knowledge
- Domain name (for SSL certificates)

## Phase 1: Repository Fork and Customization

### 1.1 Fork the Repository
```bash
# Create a new repository for the client
git clone https://github.com/golfergeek/orchestrator-ai.git client-ai-server
cd client-ai-server

# Update remote origin to client's repository
git remote set-url origin https://github.com/client-org/client-ai-server.git
git push -u origin main
```

### 1.2 Client Customization

#### Environment Configuration
```bash
# Copy production environment template
cp .env.production.template .env

# Edit client-specific values
nano .env
```

Required environment variables:
```bash
# Domain and SSL
DOMAIN=client-domain.com
ADMIN_EMAIL=admin@client-domain.com

# Database
DB_NAME=client_ai
DB_USER=postgres
DB_PASSWORD=generate-secure-password

# Application Branding
COMPANY_NAME="Client Company Name"
COMPANY_LOGO_URL="/assets/client-logo.png"
PRIMARY_COLOR="#1e40af"
SECONDARY_COLOR="#3b82f6"

# AI Services
ANTHROPIC_API_KEY=client-anthropic-key
OPENAI_API_KEY=client-openai-key  # Optional

# Features
ENABLE_OLLAMA=true  # Set false for minimal RAM setups
ENABLE_MONITORING=true
ENABLE_BACKUPS=true
```

#### Branding Customization
```bash
# Replace logo files
cp client-assets/logo.png apps/web/public/assets/logo.png
cp client-assets/favicon.ico apps/web/public/favicon.ico

# Update branding configuration
nano apps/web/src/config/branding.ts
```

#### Agent Customization
```typescript
// apps/web/src/config/branding.ts
export const BRANDING = {
  companyName: process.env.COMPANY_NAME || "Your AI Assistant",
  logoUrl: process.env.COMPANY_LOGO_URL || "/assets/logo.png",
  primaryColor: process.env.PRIMARY_COLOR || "#1e40af",
  secondaryColor: process.env.SECONDARY_COLOR || "#3b82f6",
  welcomeMessage: "Welcome to your personal AI workforce!",
  supportEmail: process.env.ADMIN_EMAIL
};

// Industry-specific agent configurations
export const INDUSTRY_AGENTS = {
  // Add client-specific agent configurations
  legal: {
    enabled: true,
    specializations: ["contract-review", "compliance", "research"]
  },
  marketing: {
    enabled: true,
    specializations: ["content-creation", "social-media", "analytics"]
  }
  // ... more based on client industry
};
```

## Phase 2: Server Setup and Installation

### 2.1 Server Preparation
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Reboot to apply Docker group changes
sudo reboot
```

### 2.2 Application Deployment
```bash
# Clone the customized repository
git clone https://github.com/client-org/client-ai-server.git
cd client-ai-server

# Copy and configure environment
cp .env.production.template .env
nano .env  # Configure client-specific values

# Run the deployment script
./scripts/deploy-production.sh
```

The deployment script performs:
1. **Environment Validation**: Checks all required variables
2. **SSL Certificate Generation**: Uses Let's Encrypt for HTTPS
3. **Database Initialization**: Sets up PostgreSQL with Supabase
4. **Application Build**: Builds Docker images for API and web
5. **Service Startup**: Launches all containers with health checks
6. **Post-Deployment Tests**: Verifies all services are running

### 2.3 Initial Setup Verification
```bash
# Check all containers are running
docker ps

# Verify database connection
docker exec -it client-ai-server-db-1 psql -U postgres -d client_ai -c "\dt"

# Check API health
curl https://client-domain.com/api/health

# Check web application
curl https://client-domain.com
```

## Phase 3: Configuration and Customization

### 3.1 Admin Account Setup
```bash
# Access the running API container
docker exec -it client-ai-server-api-1 npm run create-admin

# Follow prompts to create admin user
# Email: admin@client-domain.com
# Password: (secure generated password)
```

### 3.2 Ollama Model Installation (Optional)
```bash
# If ENABLE_OLLAMA=true, install models
docker exec -it client-ai-server-ollama-1 ollama pull llama3
docker exec -it client-ai-server-ollama-1 ollama pull mistral
docker exec -it client-ai-server-ollama-1 ollama pull codellama

# Verify models are available
docker exec -it client-ai-server-ollama-1 ollama list
```

### 3.3 Monitoring Setup
```bash
# Access Grafana dashboard
# URL: https://client-domain.com:3001
# Login: admin / (password from .env)

# Import pre-configured dashboards
docker exec -it client-ai-server-monitoring-1 \
  grafana-cli admin import-dashboard \
  /etc/grafana/dashboards/ai-server-overview.json
```

## Phase 4: Client Onboarding

### 4.1 Access Credentials
Provide the client with:
```
Application URL: https://client-domain.com
Admin Email: admin@client-domain.com
Admin Password: [generated secure password]

Grafana Monitoring: https://client-domain.com:3001
Grafana Login: admin / [grafana password]

Database Access (if needed):
Host: client-domain.com:5432
Database: client_ai
Username: postgres
Password: [database password]
```

### 4.2 Basic Usage Training
Create client-specific documentation:
1. **Getting Started Guide**: First login and basic navigation
2. **Agent Configuration**: How to customize agents for their business
3. **Task Management**: Creating and managing AI tasks
4. **Integration Setup**: Connecting to their existing tools
5. **Support Contacts**: How to get help when needed

### 4.3 Backup Configuration
```bash
# Set up automated daily backups
crontab -e

# Add backup job (runs daily at 2 AM)
0 2 * * * /home/client/client-ai-server/scripts/backup-daily.sh
```

The backup script creates:
- Database dumps
- Application data backups
- Configuration backups
- Uploads to configured cloud storage (S3, Google Drive, etc.)

## Phase 5: Ongoing Maintenance

### 5.1 Update Procedures
```bash
# Regular updates (monthly recommended)
cd client-ai-server
git pull origin main
./scripts/update-production.sh
```

The update script:
1. Backs up current installation
2. Pulls latest code changes
3. Rebuilds Docker images
4. Performs rolling update with zero downtime
5. Runs health checks
6. Rolls back if issues detected

### 5.2 Monitoring and Alerts
Set up monitoring alerts for:
- **System Resources**: CPU, RAM, disk usage > 80%
- **Application Health**: API response times > 5 seconds
- **Database Performance**: Query times > 1 second
- **SSL Certificates**: Expiring within 30 days
- **Backup Status**: Failed backups

### 5.3 Support Channels
Establish support procedures:
- **Level 1**: Client admin handles basic user issues
- **Level 2**: Your team handles technical/configuration issues
- **Level 3**: Core development team handles bugs/features

## Security Best Practices

### 5.1 Network Security
```bash
# Configure firewall
sudo ufw enable
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw allow 3001  # Monitoring (optional)

# Disable root SSH access
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
sudo systemctl reload sshd
```

### 5.2 Application Security
- **Regular Updates**: Monthly security updates
- **Strong Passwords**: Enforce password policy
- **2FA**: Enable two-factor authentication for admin accounts
- **API Keys**: Rotate API keys quarterly
- **Audit Logs**: Monitor access and changes

### 5.3 Data Protection
- **Encryption**: All data encrypted at rest and in transit
- **Backups**: Daily encrypted backups with tested restore procedures
- **Access Control**: Role-based permissions for different user types
- **Compliance**: GDPR/SOX compliance if required

## Troubleshooting Guide

### Common Issues

#### Container Won't Start
```bash
# Check logs
docker logs client-ai-server-api-1

# Common fixes:
# 1. Environment variable missing
# 2. Port already in use
# 3. Insufficient memory
```

#### SSL Certificate Issues
```bash
# Regenerate SSL certificate
docker exec -it client-ai-server-certbot-1 \
  certbot renew --force-renewal

# Restart nginx
docker restart client-ai-server-nginx-1
```

#### Database Connection Errors
```bash
# Check database container
docker logs client-ai-server-db-1

# Reset database if needed
docker exec -it client-ai-server-db-1 psql -U postgres -c "\l"
```

#### High Memory Usage
```bash
# Check resource usage
docker stats

# Reduce Ollama models if memory constrained
docker exec -it client-ai-server-ollama-1 ollama rm large-model
```

### Performance Optimization

#### For 16GB RAM Systems
```yaml
# In docker-compose.yml, add memory limits
services:
  app-api:
    deploy:
      resources:
        limits:
          memory: 2G
  ollama:
    profiles:
      - disabled  # Disable local models
```

#### For 32GB+ RAM Systems
```yaml
services:
  ollama:
    deploy:
      resources:
        limits:
          memory: 16G  # Allow Ollama to use more RAM
```

## Success Metrics

Track these metrics to ensure successful deployment:
- **Uptime**: > 99.5% availability
- **Response Time**: < 2 seconds average API response
- **User Adoption**: > 80% of client team using within 30 days
- **Support Tickets**: < 2 per month after initial 30 days
- **Performance**: CPU < 70%, RAM < 80% during normal operations

## Next Steps After Deployment

1. **User Training**: Schedule training sessions for client team
2. **Integration Planning**: Identify and configure integrations with client tools
3. **Customization**: Implement client-specific agent workflows
4. **Optimization**: Fine-tune performance based on usage patterns
5. **Expansion**: Plan for additional features or scaling

## Support and Maintenance Contract

### Included Services
- **Monthly Updates**: Security patches and feature updates
- **24/7 Monitoring**: Automated health checks and alerts
- **Backup Management**: Daily backups with tested restore procedures
- **Technical Support**: Email/chat support during business hours
- **Performance Optimization**: Monthly performance reviews

### Optional Services
- **Custom Development**: Client-specific features and integrations
- **On-site Training**: In-person training for client teams
- **Priority Support**: Phone support and faster response times
- **Advanced Analytics**: Custom reporting and business intelligence
- **Disaster Recovery**: Advanced backup and failover procedures

Contact: support@your-ai-company.com for ongoing support needs.