# 🔒 HTTPS Development Setup

This project now supports seamless HTTPS development with automatic certificate management.

## 🚀 Quick Start

### Default Development (Smart HTTPS)
```bash
npm run dev
```
- **Behavior**: Automatically sets up HTTPS if environment suggests it
- **First run**: Generates SSL certificates (one-time, ~10 seconds)
- **Subsequent runs**: Reuses existing certificates (instant startup)
- **Fallback**: Gracefully falls back to HTTP if HTTPS setup fails

### Explicit HTTPS Development
```bash
npm run dev:https
```
- **Behavior**: Forces HTTPS mode
- **URL**: https://localhost:9443
- **Certificates**: Auto-generated if missing

### HTTP Only Development
```bash
npm run dev:http
```
- **Behavior**: Traditional HTTP development
- **URL**: http://localhost:9001
- **Use case**: Debugging, testing, or preference

## 🔧 Environment Variables

Control HTTPS behavior with these environment variables in your `.env` file:

```bash
# Force HTTPS (required for production)
VITE_ENFORCE_HTTPS=true

# Prefer HTTPS in development (optional)
VITE_PREFER_HTTPS=true

# Custom HTTPS port (default: 9443)
VITE_HTTPS_PORT=9443

# Custom API base URL
VITE_API_BASE_URL=https://localhost:9443
```

## 📋 Development Workflows

### First-Time Setup
1. Run `npm run dev` or `npm run dev:https`
2. Certificates are automatically generated
3. Browser will show security warning (expected for self-signed certificates)
4. Click "Advanced" → "Proceed to localhost (unsafe)"
5. Development server starts normally

### Daily Development
1. Run `npm run dev`
2. Certificates are reused (instant startup)
3. No browser warnings after first acceptance
4. Full HTTPS development experience

### Certificate Management
```bash
# Manually generate/regenerate certificates
npm run setup-https

# Check certificate status
openssl x509 -in certs/localhost-cert.pem -noout -dates
```

## 🔐 Security Features

### Automatic Certificate Management
- **Generation**: Self-signed certificates for localhost
- **Validation**: Checks expiry and regenerates as needed
- **Security**: Secure file permissions set automatically
- **Validity**: 365-day certificate lifetime

### HTTPS Enforcement
- **URL Rewriting**: Automatic HTTP → HTTPS conversion
- **Protocol Validation**: Ensures secure protocols only
- **Host Validation**: Whitelist of allowed development hosts
- **Context Validation**: Secure context requirements

### API Security
- **Secure Headers**: Additional security headers for API requests
- **HTTPS Endpoints**: All API calls enforced to use HTTPS
- **Retry Logic**: Enhanced retry logic with secure fallbacks

## 🌐 Browser Trust (Optional)

For a seamless development experience without browser warnings:

### macOS
```bash
# Add certificate to system keychain
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain certs/localhost-cert.pem
```

### Windows
1. Double-click `certs/localhost-cert.pem`
2. Click "Install Certificate"
3. Select "Local Machine" → "Trusted Root Certification Authorities"

### Linux
```bash
# Copy certificate to system trust store
sudo cp certs/localhost-cert.pem /usr/local/share/ca-certificates/localhost.crt
sudo update-ca-certificates
```

## 🔍 Troubleshooting

### Certificate Issues
```bash
# Regenerate certificates
rm -rf certs/
npm run setup-https
```

### Port Conflicts
```bash
# Check if port is in use
lsof -i :9443

# Kill process using port
kill -9 $(lsof -t -i:9443)
```

### Environment Issues
```bash
# Check environment variables
node -e "console.log(process.env)" | grep VITE
```

## 📝 Notes

- **Self-Signed Certificates**: For development only, not for production
- **Browser Warnings**: Expected on first visit, can be bypassed safely
- **Certificate Renewal**: Automatic after 365 days
- **Performance**: No impact on development server performance
- **Compatibility**: Works with all major browsers and development tools

## 🚀 Production Deployment

For production, ensure:
1. Use proper SSL certificates from a trusted CA
2. Set `VITE_ENFORCE_HTTPS=true`
3. Configure your web server (nginx/Apache) for HTTPS
4. Update `VITE_API_BASE_URL` to production HTTPS endpoint
