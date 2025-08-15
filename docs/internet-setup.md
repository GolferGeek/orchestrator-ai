# Cloudflare Tunnel Setup Guide (Residential Internet Friendly)

This guide explains, in plain language, how to expose your local Orchestrator AI server securely over the internet using Cloudflare Tunnel. No port forwarding, no dynamic DNS clients, and no certificates to manage.

## What you get
- A secure public URL for your app and API: `app.yourdomain.com` and `api.yourdomain.com`
- Works behind any home router/NAT (no port forwarding)
- Automatic TLS/SSL from Cloudflare
- DDoS protection and edge caching from Cloudflare

## Prerequisites
- A domain managed in Cloudflare (nameservers set to Cloudflare)
- A machine running Orchestrator AI:
  - API on `http://localhost:9000`
  - Web app on `http://localhost:9001`
- Basic terminal access on that machine

## Quick start (10–15 minutes)
1) Install Cloudflare Tunnel client
```bash
brew install cloudflared || brew upgrade cloudflared
cloudflared --version
```

2) Authenticate and create a tunnel
```bash
cloudflared tunnel login   # opens a browser to authorize your Cloudflare account
cloudflared tunnel create orchestrator-ai
cloudflared tunnel list    # copy the Tunnel ID (a UUID)
```

3) Configure the tunnel
Create `~/.cloudflared/config.yml` with this content, replacing `<TUNNEL_ID>` and your domain:
```yaml
tunnel: <TUNNEL_ID>
credentials-file: ~/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: api.yourdomain.com
    service: http://localhost:9000

  - hostname: app.yourdomain.com
    service: http://localhost:9001

  - service: http_status:404
```

Tip: In this repo, see `deployment/tunnel-config.yml` as a reference. Your actual config file must live in `~/.cloudflared/config.yml`.

4) Connect your hostnames (DNS) to the tunnel
```bash
# These commands create proxied CNAMEs that point to your tunnel automatically
cloudflared tunnel route dns orchestrator-ai api.yourdomain.com
cloudflared tunnel route dns orchestrator-ai app.yourdomain.com
```

5) Run the tunnel (foreground test)
```bash
cloudflared tunnel run orchestrator-ai
```
Open your browser to `https://api.yourdomain.com` and `https://app.yourdomain.com`.

6) Run the tunnel as a service (autostart)
```bash
sudo cloudflared service install
# To check status
sudo launchctl list | grep cloudflared || true
```

## How we map your services
- `api.yourdomain.com` → `http://localhost:9000`
- `app.yourdomain.com` → `http://localhost:9001`

These mappings are defined in the `ingress:` section of your Cloudflare config.

## Daily operations
- Start/stop Orchestrator services with PM2 or the provided scripts
- Check everything with:
```bash
npm run server:status
```
This shows PM2 status, verifies DNS points to Cloudflare, and confirms HTTPS is served by Cloudflare.

## Do NOT do these (they break tunnels)
- Do not run dynamic DNS updaters (e.g., `ddclient`, custom `update-dns.sh` cron jobs)
- Do not create A/AAAA records for `api`/`app` that point to your home IP
  - Use the proxied CNAME that Cloudflare Tunnel sets up via `tunnel route dns`

## Troubleshooting
- “It still resolves to my home IP”
  - Flush DNS cache and ensure your Mac uses public DNS (1.1.1.1):
  ```bash
  sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
  dig +short api.yourdomain.com
  dig @1.1.1.1 +short api.yourdomain.com
  ```
  - Authoritative check:
  ```bash
  dig @quinton.ns.cloudflare.com +short A api.yourdomain.com
  ```
- “Cloudflare record keeps flipping back to my IP”
  - Remove any cron scripts or services that update DNS (ddclient, custom curl scripts)
  - Revoke old API tokens used for DNS edits (Cloudflare Dashboard → Profile → API Tokens)

## Security notes
- Cloudflare handles TLS certificates at the edge; no Certbot/Let’s Encrypt needed on your box
- Keep `~/.cloudflared/<TUNNEL_ID>.json` safe; it’s your tunnel credential
- Use least-privileged Cloudflare API tokens only when necessary

## Appendix: Commands you’ll use
```bash
# Create/login/list tunnels
cloudflared tunnel login
cloudflared tunnel create orchestrator-ai
cloudflared tunnel list

# Route hostnames to the tunnel
cloudflared tunnel route dns orchestrator-ai api.yourdomain.com
cloudflared tunnel route dns orchestrator-ai app.yourdomain.com

# Run/inspect the tunnel
cloudflared tunnel run orchestrator-ai
sudo cloudflared service install

# Verify
npm run server:status
```

That’s it. With Cloudflare Tunnel, your app and API are safely reachable on residential internet without opening ports or managing certificates.
