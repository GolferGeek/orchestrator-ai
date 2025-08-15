# Deployment Scripts Guide

## 🚀 Primary Server Management (Use These!)

### `start-server.sh` ⭐
**Purpose:** Start everything after server restart  
**Usage:** `npm run server:start`  
- Starts PM2 processes (API & Web)
- Starts CloudFlare Tunnel
- Verifies health of all services
- Tests external connectivity

### `stop-server.sh` 
**Purpose:** Stop all services cleanly  
**Usage:** `npm run server:stop`  
- Stops PM2 processes
- Stops CloudFlare Tunnel

## 🔧 Setup & Configuration Scripts

### `build-production.sh`
**Purpose:** Build both apps for production  
- Loads `.env.production`
- Builds API with NestJS
- Builds Web with Vite
- Creates `dist` folders

### `deploy-with-pm2.sh`
**Purpose:** Deploy apps using PM2  
- Builds production versions
- Configures PM2 ecosystem
- Starts services with PM2

### `setup-cloudflare-tunnel.sh`
**Purpose:** Initial CloudFlare Tunnel setup  
- Installs cloudflared
- Creates tunnel
- Configures DNS routing
- Sets up auto-start service

### `setup-pm2-startup.sh`
**Purpose:** Configure PM2 to start on boot  
- Sets up system startup scripts
- Saves PM2 process list
- Configures auto-restart

## 🧪 Testing & Utility Scripts

### `test-deployment.sh`
**Purpose:** Test production deployment  
- Checks service health
- Verifies connectivity
- Tests API endpoints

### `fix-typescript-errors.sh`
**Purpose:** Documentation of TypeScript fixes  
- Not executable - just notes
- Documents workarounds for TS errors

## 🔧 Configuration Files

### `tunnel-config.yml`
CloudFlare Tunnel configuration
- Routes for api.orchestratorai.io
- Routes for app.orchestratorai.io
- WebSocket support

### `cloudflared-config.yml`
Template for CloudFlare Tunnel setup

### `build-info.json`
Build metadata and timestamps

## ⚠️ Deprecated Scripts (Removed)

- ~~`start-production.sh`~~ → Use `start-server.sh`
- ~~`manage-production.sh`~~ → Use `start-server.sh`
- ~~`serve-production.sh`~~ → PM2 handles serving

## 📝 Quick Commands Reference

```bash
# After server restart
npm run server:start

# Check status
npm run server:status

# View logs
npm run server:logs

# Stop everything
npm run server:stop

# Restart everything
npm run server:restart
```

## 🏗️ nginx Configuration (Optional)

The `nginx/` folder contains nginx configurations that are **not currently used** since we're using CloudFlare Tunnel directly. They're kept for reference if you ever need to switch back to a traditional nginx proxy setup.