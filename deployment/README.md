# Production Deployment Guide

This guide explains how to deploy the Orchestrator AI application to production using the build/dist approach with PM2 process manager.

## Prerequisites

- Node.js and npm installed
- PM2 installed globally: `npm install -g pm2`
- serve installed globally: `npm install -g serve`
- nginx installed and configured
- `.env.production` file configured with production settings

## Important: Environment Variables

**The `.env.production` file MUST be used for both web and API builds.** This file contains:
- API endpoints (VITE_API_BASE_URL, etc.)
- Database connections (Supabase)
- API keys for various services
- Port configurations

## Quick Start

```bash
# 1. Test the deployment pipeline
./deployment/test-deployment.sh

# 2. Build both applications
./deployment/build-production.sh

# 3. Deploy with PM2
./deployment/deploy-with-pm2.sh

# 4. Setup nginx (first time only)
./deployment/setup-nginx.sh

# 5. Setup auto-restart on reboot (first time only)
./deployment/setup-pm2-startup.sh
```

## Architecture

### Current Setup (Phase 1)
```
Internet → CloudFlare → Nginx → PM2 Processes
                                 ├── API (NestJS on port 9000)
                                 └── Web (Vue/Vite static on port 9001)
```

### Services
- **API**: NestJS application running on port 9000
- **Web**: Vue/Vite built static files served on port 9001
- **PM2**: Process manager handling both services
- **Nginx**: Reverse proxy routing domains to services

## File Structure

```
deployment/
├── build-production.sh        # Builds both apps with .env.production
├── deploy-with-pm2.sh         # Deploys built apps with PM2
├── setup-nginx.sh             # Configures nginx
├── setup-pm2-startup.sh       # Sets up auto-restart on reboot
├── test-deployment.sh         # Tests deployment pipeline
├── restart-production.sh      # Quick restart script
└── nginx/
    └── orchestratorai-production.conf  # Nginx configuration
```

## Build Process

The build process (`build-production.sh`):
1. Loads `.env.production` environment variables
2. Cleans previous builds
3. Builds API with TypeScript compilation
4. Builds Web with Vite production build
5. Creates deployment info file

## PM2 Management

### Ecosystem Configuration
The `ecosystem.config.js` file defines:
- Process names and scripts
- Environment variables (loads from `.env.production`)
- Restart policies
- Memory limits
- Log file locations

### PM2 Commands
```bash
# View status
pm2 status

# View logs
pm2 logs

# Restart all
pm2 restart all

# Stop all
pm2 stop all

# Monitor
pm2 monit

# Save current process list
pm2 save

# Restore saved processes
pm2 resurrect
```

## Nginx Configuration

The nginx configuration handles:
- `api.orchestratorai.io` → localhost:9000
- `app.orchestratorai.io` → localhost:9001
- WebSocket proxying for real-time features
- Static asset caching
- Security headers

## Auto-Restart on Reboot

The PM2 startup script configures:
- System service for automatic PM2 start
- Process restoration after reboot
- Platform-specific setup (systemd/launchd)

## Updating Production

After code changes:
```bash
# Rebuild and restart
./deployment/build-production.sh
pm2 restart all

# Or use the combined command
./deployment/build-production.sh && pm2 restart all
```

## Monitoring

### Check Service Health
```bash
# PM2 status
pm2 status

# API health check
curl http://localhost:9000/health

# Web app check
curl http://localhost:9001

# Nginx status
nginx -t
```

### View Logs
```bash
# PM2 logs
pm2 logs

# Specific service logs
pm2 logs orchestrator-api
pm2 logs orchestrator-web

# Nginx logs
tail -f /var/log/nginx/*.log
```

## Troubleshooting

### Build Failures
- Ensure `.env.production` exists and is properly configured
- Check Node.js and npm versions
- Clear node_modules and reinstall: `npm install`

### PM2 Issues
- Check PM2 logs: `pm2 logs`
- Restart PM2 daemon: `pm2 kill && pm2 start ecosystem.config.js --env production`
- Verify process memory: `pm2 monit`

### Nginx Issues
- Test configuration: `nginx -t`
- Check error logs: `tail -f /var/log/nginx/error.log`
- Verify upstream servers are running: `pm2 status`

### WebSocket Issues
- Ensure nginx configuration includes WebSocket headers
- Check CloudFlare WebSocket support is enabled
- Verify API WebSocket endpoint is accessible

## Future Enhancements (Phase 2)

Docker deployment is planned for the future:
- Containerized builds for consistency
- Docker Compose for orchestration
- Easier scaling and deployment
- Development will remain local for fast iteration

## Security Considerations

1. **Environment Variables**: Never commit `.env.production` to git
2. **API Keys**: Rotate keys regularly
3. **Nginx**: Keep security headers updated
4. **PM2**: Use memory limits to prevent DoS
5. **Logs**: Implement log rotation

## Support

For issues or questions:
- Check PM2 status and logs first
- Verify nginx configuration
- Ensure `.env.production` is properly configured
- Test individual services independently