# 🔄 Development vs Production Environment Comparison

## 📊 **Quick Reference Table**

| Component | Development | Production |
|-----------|-------------|------------|
| **API Port** | 7100 | 9000 |
| **Web Port** | 7101 | 9001 |
| **Supabase Type** | Local Docker | Cloud/Remote |
| **Supabase URL** | http://127.0.0.1:7010 | Your production URL |
| **Database** | Local PostgreSQL | Production database |
| **Data** | Test/dev data | Real production data |
| **Environment File** | `.env` (local) | Production env vars |

## 🏠 **Development Environment (This Setup)**

### **Supabase Local Instance**
- **Type**: Docker containers running locally
- **API**: http://127.0.0.1:7010
- **Database**: postgresql://postgres:postgres@127.0.0.1:7012/postgres
- **Studio**: http://127.0.0.1:7015
- **Email Testing**: http://127.0.0.1:7016
- **Data**: Completely isolated test data
- **Reset**: Can be reset anytime with `npm run dev:supabase:reset`

### **Application Ports**
- **API**: http://localhost:7100
- **Web**: http://localhost:7101

### **Quick Commands**
```bash
# Start everything
npm run dev

# Check ports and status
npm run dev:ports

# Check Supabase status
npm run dev:supabase

# Reset local database (safe - only affects local data)
npm run dev:supabase:reset
```

## 🏭 **Production Environment (Server)**

### **Supabase Production Instance**
- **Type**: Cloud Supabase or your production instance
- **URL**: Your production SUPABASE_URL
- **Database**: Your production database
- **Data**: Real production data
- **Access**: Via your production environment variables

### **Application Ports**
- **API**: http://localhost:9000 (or your production domain)
- **Web**: http://localhost:9001 (or your production domain)

### **Production Commands**
```bash
# Production server management
npm run server:start
npm run server:stop
npm run server:status
```

## 🛡️ **Data Isolation Guarantee**

### **Development Data**
- ✅ Stored in local Docker volumes
- ✅ Never touches production
- ✅ Can be reset/destroyed safely
- ✅ Uses default development keys
- ✅ Completely separate schema migrations

### **Production Data**
- ✅ Stored in your production Supabase instance
- ✅ Never affected by local development
- ✅ Uses production API keys
- ✅ Has its own migration history

## 🔧 **Environment Variables**

### **Development (.env file)**
```bash
# Development ports
API_PORT=7100
WEB_PORT=7101

# Local Supabase
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Development settings
NODE_ENV=development
LOG_LEVEL=debug
```

### **Production (Server Environment)**
```bash
# Production ports
API_PORT=9000
WEB_PORT=9001

# Production Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_production_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_production_service_key

# Production settings
NODE_ENV=production
LOG_LEVEL=info
```

## 🚀 **Switching Between Environments**

### **For Development**
```bash
# Use local environment
cp dev.env.example .env
npm run dev
```

### **For Production Deployment**
```bash
# Use production environment variables
# (Set via your deployment system)
npm run server:start
```

## 🔍 **How to Verify Separation**

### **Check Development**
```bash
npm run dev:ports
# Should show ports 7100/7101 and local Supabase
```

### **Check Production**
```bash
npm run server:status
# Should show ports 9000/9001 and production services
```

## ⚠️ **Important Notes**

1. **Never use production API keys in development**
2. **Local Supabase data is ephemeral** - it can be reset anytime
3. **Production and development databases are completely separate**
4. **Different port ranges prevent conflicts**
5. **Environment files control which instance you connect to**

This setup ensures you can develop safely without any risk to production data!

