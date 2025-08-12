# Residential Internet Server Setup Guide

This guide covers setting up your Orchestrator AI server to be accessible through `orchestratorai.io` from a residential internet connection.

## Overview

The goal is to make your local server accessible via `orchestratorai.io` while handling the challenges of residential internet:
- Dynamic IP addresses
- ISP restrictions
- Router configuration
- DNS management

## Prerequisites

- Residential internet connection
- Router with admin access
- Domain name (orchestratorai.io)
- Server running Orchestrator AI

## Step 1: Dynamic DNS Setup

Since residential IPs change frequently, we'll use a dynamic DNS service.

### Option A: Cloudflare Dynamic DNS (Recommended)

1. **Sign up for Cloudflare** (free tier available)
2. **Add your domain** `orchestratorai.io` to Cloudflare
3. **Update nameservers** at your domain registrar to use Cloudflare's
4. **Create an API token** with DNS edit permissions
5. **Set up dynamic DNS client** on your server

```bash
# Install ddclient for dynamic DNS updates
sudo apt-get install ddclient

# Configure ddclient for Cloudflare
sudo nano /etc/ddclient.conf
```

Add this configuration:
```conf
protocol=cloudflare
use=web
server=www.cloudflare.com
login=your-email@example.com
password=your-api-token
zone=orchestratorai.io
your-subdomain.orchestratorai.io
```

### Option B: No-IP Dynamic DNS (Alternative)

1. **Sign up for No-IP** (free tier available)
2. **Create a hostname** like `yourserver.no-ip.org`
3. **Install No-IP client** on your server
4. **Update your domain's CNAME** to point to the No-IP hostname

## Step 2: Router Configuration

### Port Forwarding Setup

Configure your router to forward these ports to your server:

| Port | Protocol | Service | Description |
|------|----------|---------|-------------|
| 80   | TCP      | HTTP    | Web traffic (redirects to HTTPS) |
| 443  | TCP      | HTTPS   | Secure web traffic |
| 9000 | TCP      | API     | Orchestrator AI API |
| 9001 | TCP      | Web     | Orchestrator AI Web App |

### Router Configuration Steps

1. **Access router admin panel** (usually `192.168.1.1` or `192.168.0.1`)
2. **Find Port Forwarding section** (may be called "Virtual Server" or "Port Mapping")
3. **Add port forwarding rules** for each port above
4. **Set internal IP** to your server's local IP (e.g., `192.168.1.100`)
5. **Enable UPnP** if available (can auto-configure some ports)

### Example Router Configuration

```
Rule 1:
- External Port: 80
- Internal Port: 80
- Protocol: TCP
- Internal IP: 192.168.1.100

Rule 2:
- External Port: 443
- Internal Port: 443
- Protocol: TCP
- Internal IP: 192.168.1.100

Rule 3:
- External Port: 9000
- Internal Port: 9000
- Protocol: TCP
- Internal IP: 192.168.1.100

Rule 4:
- External Port: 9001
- Internal Port: 9001
- Protocol: TCP
- Internal IP: 192.168.1.100
```

## Step 3: Server Configuration

### Static Local IP Assignment

Assign a static IP to your server to prevent router reassignment:

```bash
# Edit network configuration
sudo nano /etc/netplan/01-netcfg.yaml
```

Add configuration:
```yaml
network:
  version: 2
  renderer: networkd
  ethernets:
    eth0:
      dhcp4: no
      addresses:
        - 192.168.1.100/24
      gateway4: 192.168.1.1
      nameservers:
          addresses: [8.8.8.8, 8.8.4.4]
```

Apply changes:
```bash
sudo netplan apply
```

### Firewall Configuration

Configure UFW firewall to allow necessary ports:

```bash
# Enable UFW
sudo ufw enable

# Allow SSH (change port if needed)
sudo ufw allow 22

# Allow web traffic
sudo ufw allow 80
sudo ufw allow 443

# Allow Orchestrator AI ports
sudo ufw allow 9000
sudo ufw allow 9001

# Check status
sudo ufw status
```

## Step 4: SSL Certificate Setup

### Let's Encrypt with Certbot

Install and configure SSL certificates:

```bash
# Install Certbot
sudo apt-get install certbot

# Get SSL certificate
sudo certbot certonly --standalone -d orchestratorai.io -d www.orchestratorai.io

# Set up auto-renewal
sudo crontab -e
```

Add this line for auto-renewal:
```
0 12 * * * /usr/bin/certbot renew --quiet
```

### Nginx SSL Configuration

Update your nginx configuration to use SSL:

```nginx
server {
    listen 80;
    server_name orchestratorai.io www.orchestratorai.io;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name orchestratorai.io www.orchestratorai.io;
    
    ssl_certificate /etc/letsencrypt/live/orchestratorai.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/orchestratorai.io/privkey.pem;
    
    # Frontend
    location / {
        proxy_pass http://localhost:9001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # API
    location /api/ {
        proxy_pass http://localhost:9000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Step 5: DNS Configuration

### Cloudflare DNS Records

Set up these DNS records in Cloudflare:

| Type | Name | Content | TTL | Proxy Status |
|------|------|---------|-----|--------------|
| A | @ | [Your Dynamic IP] | Auto | Proxied |
| A | www | [Your Dynamic IP] | Auto | Proxied |
| CNAME | api | orchestratorai.io | Auto | Proxied |

### Dynamic IP Update Script

Create a script to update DNS when IP changes:

```bash
#!/bin/bash
# /usr/local/bin/update-dns.sh

CURRENT_IP=$(curl -s https://ipinfo.io/ip)
RECORDED_IP=$(dig +short orchestratorai.io)

if [ "$CURRENT_IP" != "$RECORDED_IP" ]; then
    echo "IP changed from $RECORDED_IP to $CURRENT_IP"
    
    # Update Cloudflare DNS
    curl -X PUT "https://api.cloudflare.com/client/v4/zones/[ZONE_ID]/dns_records/[RECORD_ID]" \
        -H "Authorization: Bearer [API_TOKEN]" \
        -H "Content-Type: application/json" \
        --data "{
            \"type\": \"A\",
            \"name\": \"orchestratorai.io\",
            \"content\": \"$CURRENT_IP\",
            \"ttl\": 1,
            \"proxied\": true
        }"
    
    echo "DNS updated successfully"
else
    echo "IP unchanged: $CURRENT_IP"
fi
```

Make it executable and add to crontab:
```bash
chmod +x /usr/local/bin/update-dns.sh
crontab -e
```

Add this line to check every 5 minutes:
```
*/5 * * * * /usr/local/bin/update-dns.sh
```

## Step 6: ISP Considerations

### Common Residential ISP Issues

1. **Port 25 blocking**: Most ISPs block SMTP traffic
2. **Dynamic IP changes**: Can happen every 24-48 hours
3. **Rate limiting**: Some ISPs limit server traffic
4. **Terms of Service**: Check if running servers violates TOS

### Solutions

- **Use port 587** for SMTP instead of 25
- **Set up monitoring** for IP changes
- **Implement rate limiting** in your application
- **Consider business internet** for production use

## Step 7: Monitoring and Maintenance

### Health Check Script

Create a monitoring script:

```bash
#!/bin/bash
# /usr/local/bin/health-check.sh

# Check if services are running
if ! curl -f http://localhost:9000/health > /dev/null 2>&1; then
    echo "API is down, restarting..."
    npm run prod:restart
fi

if ! curl -f http://localhost:9001 > /dev/null 2>&1; then
    echo "Web app is down, restarting..."
    npm run prod:restart
fi

# Check SSL certificate expiry
if [ $(date -d "$(openssl x509 -enddate -noout -in /etc/letsencrypt/live/orchestratorai.io/cert.pem | cut -d= -f2)" +%s) -lt $(date -d "+30 days" +%s) ]; then
    echo "SSL certificate expiring soon, renewing..."
    certbot renew
fi
```

Add to crontab for hourly checks:
```
0 * * * * /usr/local/bin/health-check.sh
```

### Log Monitoring

Set up log rotation and monitoring:

```bash
# Install logrotate
sudo apt-get install logrotate

# Configure log rotation for your app
sudo nano /etc/logrotate.d/orchestrator-ai
```

Add configuration:
```
/var/log/orchestrator-ai/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
}
```

## Step 8: Testing

### Local Testing

```bash
# Test local services
curl http://localhost:9000/health
curl http://localhost:9001

# Test SSL locally
curl -k https://localhost:443
```

### External Testing

```bash
# Test from external network
curl https://orchestratorai.io/health
curl https://orchestratorai.io

# Test DNS resolution
nslookup orchestratorai.io
dig orchestratorai.io
```

## Troubleshooting

### Common Issues

1. **Port forwarding not working**
   - Check router configuration
   - Verify server firewall settings
   - Test with `telnet external-ip port`

2. **SSL certificate issues**
   - Ensure port 80 is open for verification
   - Check certificate paths in nginx config
   - Verify domain ownership

3. **Dynamic DNS not updating**
   - Check ddclient logs: `tail -f /var/log/ddclient.log`
   - Verify API credentials
   - Test manual DNS update

4. **Services not accessible**
   - Check if services are running: `npm run prod:status`
   - Verify port forwarding
   - Check firewall rules

### Useful Commands

```bash
# Check current external IP
curl -s https://ipinfo.io/ip

# Test port forwarding
telnet your-external-ip 80

# Check service status
npm run prod:status

# View logs
npm run prod:logs

# Restart services
npm run prod:restart
```

## Security Considerations

1. **Keep system updated**: Regular security updates
2. **Use strong passwords**: For all services
3. **Monitor logs**: Check for suspicious activity
4. **Backup regularly**: Database and configuration files
5. **Limit access**: Only necessary ports open

## Next Steps

1. **Set up monitoring**: Implement comprehensive monitoring
2. **Backup strategy**: Regular automated backups
3. **Performance tuning**: Optimize for your hardware
4. **Scaling plan**: Consider load balancing for growth

This setup provides a robust foundation for running Orchestrator AI on residential internet while handling the challenges of dynamic IPs and ISP restrictions.
