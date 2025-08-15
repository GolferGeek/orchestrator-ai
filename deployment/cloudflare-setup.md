# CloudFlare SSL/TLS Configuration

## Current Setup
Your services are running on:
- Web: http://localhost:9001
- API: http://localhost:9000

## CloudFlare Configuration Steps

### 1. SSL/TLS Setting (in CloudFlare Dashboard)
Go to your domain in CloudFlare → SSL/TLS → Overview

Choose one of these modes:

#### Option A: Flexible (Easiest - Start Here)
- Set to "Flexible"
- CloudFlare handles SSL with visitors
- CloudFlare connects to your origin server over HTTP
- No certificates needed on your server

#### Option B: Full (More Secure)
- Set to "Full" 
- You'll need to create a self-signed certificate on your server
- CloudFlare will accept any certificate (even self-signed)

#### Option C: Full (Strict) - Most Secure
- Requires a valid certificate from CloudFlare or a CA
- Most secure but more complex to set up

### 2. DNS Settings (in CloudFlare Dashboard)
Make sure you have these DNS records:

```
Type  Name    Content           Proxy
A     app     YOUR_SERVER_IP    ✓ Proxied
A     api     YOUR_SERVER_IP    ✓ Proxied
```

### 3. Page Rules (Optional but Recommended)
Create these page rules:

For API:
- URL: `api.orchestratorai.io/*`
- Settings:
  - SSL: Flexible (or your chosen mode)
  - Cache Level: Bypass
  - Always Use HTTPS: On

For App:
- URL: `app.orchestratorai.io/*`
- Settings:
  - SSL: Flexible (or your chosen mode)
  - Browser Cache TTL: 4 hours
  - Always Use HTTPS: On

### 4. CloudFlare Settings to Check
- **SSL/TLS → Edge Certificates**: 
  - Always Use HTTPS: ON
  - Automatic HTTPS Rewrites: ON
  
- **SSL/TLS → Origin Server**:
  - For "Flexible" mode: Nothing needed
  - For "Full" mode: Can create origin certificate here

### 5. Firewall Rules
Make sure ports 9000 and 9001 are:
- Open in your server's firewall
- Port forwarded if behind a router
- Allowed in CloudFlare's firewall rules

## Testing

After configuration, test:
```bash
# From outside your network
curl https://app.orchestratorai.io
curl https://api.orchestratorai.io/health
```

## Troubleshooting

If you get SSL errors:
1. Check CloudFlare SSL mode (try Flexible first)
2. Wait 5-10 minutes for changes to propagate
3. Clear browser cache
4. Check CloudFlare is proxying (orange cloud) in DNS

If you get connection errors:
1. Verify services are running: `pm2 status`
2. Check ports locally: `curl http://localhost:9001`
3. Check firewall rules
4. Verify CloudFlare DNS points to correct IP