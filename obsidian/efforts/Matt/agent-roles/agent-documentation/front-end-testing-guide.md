# Front-End Testing Guide

**For**: Claude (Front-End Tester) and future front-end testing agents

---

## 🎯 **Overview**

This guide provides comprehensive knowledge for testing the Orchestrator-AI front-end application. It covers architecture, testing methodologies, common patterns, and troubleshooting approaches.

---

## 🏗️ **Application Architecture**

### **Technology Stack**
- **Frontend**: Vue 3 + Ionic + Vite
- **Backend**: NestJS (TypeScript) 
- **Database**: Supabase (PostgreSQL)
- **State Management**: Pinia
- **Build Tool**: Vite with hot reload
- **Testing**: Playwright for browser automation

### **Key Directories**
```
apps/web/src/
├── components/          # Vue components
├── services/           # API clients and utilities
├── stores/            # Pinia state management
├── views/             # Page components
└── assets/            # Static assets
```

### **Core Services**
- **`apiService.ts`** - Main API client with authentication
- **`tasksService.ts`** - Agent task execution
- **`conversationService.ts`** - Chat/conversation management
- **`authService.ts`** - Authentication handling

---

## 🧪 **Testing Environment Setup**

### **Required Services**
1. **Web Server**: `npm run dev` (port 7102 for testing)
2. **API Server**: `npm run start:dev` (port 7100)
3. **Browser**: Single Chrome instance with Playwright
4. **Logs**: Real-time monitoring for both servers

**Note**: User runs on port 7101, Tester runs on port 7102

### **Standard Starting Procedure**
```bash
# 1. Start Web Server on port 7102 (Terminal 1)
cd apps/web && PORT=7102 npm run dev > ../../web-server.log 2>&1 &

# 2. Start API Server (Terminal 2)  
cd apps/api && npm run start:dev > ../../api-server.log 2>&1 &

# 3. Wait for servers to start
sleep 5

# 4. Verify servers are running
lsof -i :7102 -i :7100

# 5. Check startup logs
tail -20 web-server.log
tail -20 api-server.log

# 6. Set up log monitoring
tail -f api-server.log &
tail -f web-server.log &
```

### **Browser Setup**
```bash
# Open single Chrome browser instance
# Navigate to: http://localhost:7102 (Tester port)
# Keep browser open for all tests
# Use Playwright for automation within same instance
```

### **Health Checks**
- **Web (Tester)**: `http://localhost:7102`
- **Web (User)**: `http://localhost:7101`
- **API**: `http://localhost:7100/health`
- **Logs**: Check both `web-server.log` and `api-server.log`
- **Browser**: Single Chrome instance ready for testing

### **Environment Configuration**

#### Root .env File
The project uses a root-level `.env` file with the following key configurations:

```bash
# Port Configuration
API_PORT=7100
WEB_PORT=7101
VITE_WEB_PORT=7101

# Supabase Configuration
SUPABASE_URL=http://127.0.0.1:7010
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Test Credentials
SUPABASE_TEST_USER=demo.user@orchestratorai.io
SUPABASE_TEST_PASSWORD=DemoUser123!
SUPABASE_TEST_USERID=b29a590e-b07f-49df-a25b-574c956b5035
```

#### Database Management
- **Backup Location**: `storage/backups/` directory
- **Latest Backup**: `golfergeek_supabase_backup_20251013_164353.sql.gz`
- **Restore Command**: `gunzip -c storage/backups/golfergeek_supabase_backup_20251013_164353.sql.gz | psql postgresql://postgres:postgres@127.0.0.1:7012/postgres`
- **Important**: Never reset the database without explicit permission from the user

#### Agent Configuration
- **Blog Post Writer Agent**: Configured with Ollama provider and `llama3.2:1b` model
- **LLM Configuration**: Stored in `config.llm_defaults` field in agents table
- **Duplicate Agents**: Both `demo` and `my-org` organizations have blog_post_writer agents
- **Configuration Location**: Database table `agents` with JSON config field

### **Debug Capabilities**
- **Add debug logic** to frontend/backend code as needed
- **Make changes** with hot reload enabled
- **Monitor logs** in real-time during tests
- **Interactive debugging** through browser DevTools

---

## 🔍 **Testing Methodology**

### **1. Progressive Testing Approach**
- **One test at a time** - Never start next test while current fails
- **Fix before proceeding** - Each test must pass completely
- **Document everything** - Track results and blockers

### **2. Multi-Source Monitoring**
- **Web Console**: Frontend errors, API calls, state changes
- **API Console**: Backend processing, database queries, errors
- **Browser DevTools**: Network requests, JavaScript errors, performance
- **Playwright Console**: Automation logs and errors

### **3. Real-Time Debugging**
- **Hot Reload**: Changes apply instantly
- **Live Logs**: Monitor activity as tests run
- **Interactive Debugging**: Use browser DevTools during tests

---

## 🎯 **Common Test Patterns**

### **Authentication Flow**
```javascript
// 1. Navigate to app
await page.goto('http://localhost:7102');

// 2. Handle login if needed
await page.click('[data-testid="login-button"]');

// 3. Verify authenticated state
const userInfo = await page.evaluate(() => window.authStore?.user);
```

### **Agent Interaction**
```javascript
// 1. Navigate to agent
await page.click('[data-testid="agent-blog-post-writer"]');

// 2. Send message
await page.fill('[placeholder="Type your message..."]', 'Test message');
await page.press('Enter');

// 3. Wait for response
await page.waitForSelector('[data-testid="agent-response"]');
```

### **API Endpoint Testing**
```javascript
// Monitor API calls
const response = await page.waitForResponse(response => 
  response.url().includes('/agent-to-agent/') && 
  response.status() === 200
);
```

---

## 🐛 **Common Issues & Solutions**

### **1. Authentication 401 Errors**
**Symptoms**: `401 Unauthorized` in console, "Authentication system failure"
**Solution**: Click "Enter App" button to authenticate
**Prevention**: Check auth token in localStorage

### **2. API 404 Not Found**
**Symptoms**: `POST /agents/context/blog_post_writer/tasks` returns 404
**Root Cause**: Frontend calling wrong endpoint
**Solution**: Ensure all agents use `/agent-to-agent/:orgSlug/:agentSlug/tasks`
**Code Fix**: Update `tasksService.ts` to use A2A protocol

### **3. Playwright Timeout Errors**
**Symptoms**: `TimeoutError: Waiting for selector`
**Solutions**:
- Use `page.evaluate()` for direct DOM access
- Try alternative selectors
- Add explicit waits
- Check for overlapping elements

### **4. Hot Reload Issues**
**Symptoms**: Changes not applying, ViteHMR errors
**Solutions**:
- Restart web server
- Clear browser cache
- Check for TypeScript errors
- Verify file watching

### **5. Authentication Issues**
**Symptoms**: `401 Unauthorized` errors
**Details**: Check that credentials are correct (`demo.user@orchestratorai.io` / `DemoUser123!`)
**Login Page**: Credentials are pre-filled in `LoginPage.vue` - verify they match the database
**Session Issues**: Check Supabase connection and user table

### **6. UI Navigation Issues**
**Message Input**: Use the textarea with placeholder "Type your message..." (NOT the search box in left panel)
**Send Button**: Look for "Send (Converse)" button after typing message
**Full Screen**: Click on conversation area to hide left navigation panel
**Agent Selection**: Click on agent name to start new conversation

### **7. LLM Configuration Issues**
**LLM Service Error**: "Both provider and model must be explicitly specified"
- Check agent configuration in database `agents` table
- Verify `config.llm_defaults` has proper `provider` and `model` fields
- Example: `{"provider": "ollama", "model": "llama3.2:1b", "temperature": 0.7}`
- Agent Not Responding: Verify agent has proper LLM configuration

### **8. Database Issues**
**No Data**: Restore from latest backup in `storage/backups/`
**Agent Not Found**: Check that agents exist in database with proper organization
**Configuration Missing**: Verify agent has `config.llm_defaults` field populated

### **9. Port and Connection Issues**
**Web Server**: Should run on port 7102 (not 7101 as configured in .env)
**API Server**: Should run on port 7100
**Supabase**: Should run on port 7010
**Database**: Should run on port 7012

---

## 🔧 **Debugging Techniques**

### **1. Console Monitoring**
```bash
# Web server logs
tail -f web-server.log

# API server logs  
tail -f api-server.log

# Filter for specific patterns
grep -i "error\|exception" api-server.log
```

### **2. Browser DevTools**
- **Console**: JavaScript errors and logs
- **Network**: API requests and responses
- **Application**: localStorage, sessionStorage
- **Sources**: Breakpoints and debugging

### **3. Code Investigation**
```bash
# Find specific functionality
grep -r "functionName" apps/web/src/

# Check API endpoints
grep -r "agent-to-agent" apps/api/src/

# Find component files
find apps/web/src -name "*.vue" | grep -i component
```

---

## 📋 **Testing Checklist**

### **Pre-Test Setup**
- [ ] Web server running (port 7102)
- [ ] API server running (port 7100) 
- [ ] Browser open at app URL
- [ ] Console monitoring active
- [ ] Previous test completed successfully

### **During Test Execution**
- [ ] Monitor web console for errors
- [ ] Monitor API console for backend activity
- [ ] Check browser DevTools for issues
- [ ] Verify expected UI changes
- [ ] Confirm API calls succeed

### **Post-Test Verification**
- [ ] Test passes completely
- [ ] No console errors
- [ ] UI state correct
- [ ] API responses successful
- [ ] Document results

---

## 🚀 **Advanced Testing Scenarios**

### **1. Multi-User Testing**
- Test concurrent conversations
- Verify state isolation
- Check real-time updates

### **2. Error Recovery**
- Test network failures
- Test API timeouts
- Test invalid responses

### **3. Performance Testing**
- Measure response times
- Monitor memory usage
- Test with large datasets

### **4. Cross-Browser Testing**
- Chrome/Chromium
- Firefox
- Safari (if available)
- Edge

---

## 📚 **Key Files to Know**

### **Frontend Core**
- `apps/web/src/services/tasksService.ts` - Agent task execution
- `apps/web/src/stores/agentChatStore/conversation.ts` - Chat management
- `apps/web/src/components/AgentTreeView.vue` - Agent navigation
- `apps/web/src/services/apiService.ts` - API client

### **Backend Core**
- `apps/api/src/agent2agent/agent2agent.controller.ts` - A2A protocol
- `apps/api/src/llms/` - LLM service integration
- `apps/api/src/supabase/` - Database integration

### **Configuration**
- `apps/web/vite.config.ts` - Frontend build config
- `apps/api/package.json` - Backend dependencies
- `.env` - Environment variables

---

## 🎯 **Testing Principles**

### **1. Progressive Complexity**
- Start with simple UI interactions
- Build up to complex workflows
- Each test builds on previous success

### **2. Real-World Scenarios**
- Test actual user workflows
- Include edge cases and errors
- Verify end-to-end functionality

### **3. Fast Iteration**
- Use hot reload for quick feedback
- Make small, focused changes
- Test immediately after fixes

### **4. Comprehensive Coverage**
- Test all user paths
- Verify error handling
- Check performance impact

## 🏗️ **Critical Architectural Principles**

### **Transport Types Integrity**
- **Maintain transport-types** for all front-to-API-to-front communication
- **Type safety** must be preserved across the entire data flow
- **No data transformation** that breaks type contracts
- **Verify** that API responses match expected transport types

### **Store State Management**
- **Store only receives new values** from request handlers
- **No direct store manipulation** from components
- **Single source of truth** - store is updated only through API responses
- **State consistency** - store reflects actual server state

### **Vue Reactivity Requirements**
- **All component interaction** must go through Vue reactivity
- **No direct DOM manipulation** for state changes
- **Reactive data binding** must work correctly
- **Component lifecycle** must be respected
- **Props/emits** for parent-child communication

### **Testing These Principles**
When fixing issues during tests:
1. **Verify transport types** are maintained end-to-end
2. **Check store updates** only come from API responses
3. **Ensure Vue reactivity** handles all UI state changes
4. **No bypassing** of the established architecture

---

## 📝 **Documentation Standards**

### **Test Results Format**
```
### Test X: [Test Name]
**Status**: ✅ Pass / ❌ Fail / ⏸️ Blocked
**Duration**: X minutes
**Issues Found**: [List any problems]
**Fixes Applied**: [Code changes made]
**Notes**: [Additional observations]
```

### **Bug Reports**
```
**Bug**: [Brief description]
**Steps to Reproduce**: [Detailed steps]
**Expected**: [What should happen]
**Actual**: [What actually happens]
**Console Logs**: [Relevant error messages]
**Fix Applied**: [Code changes made]
```

---

## 🔄 **Continuous Improvement**

### **Learning from Tests**
- Document patterns that work
- Note common failure modes
- Update guide with new solutions
- Share knowledge with team

### **Tool Enhancement**
- Improve automation scripts
- Add better monitoring
- Create reusable test utilities
- Optimize debugging workflows

---

**Remember**: As a Front-End Tester, you have unique capabilities with live browser access, real-time console monitoring, and code modification abilities. Use these powers to thoroughly validate the system and ensure each test passes before moving forward.

**Key Success Metrics**:
- ✅ All tests pass completely
- ✅ No console errors
- ✅ UI responds correctly
- ✅ API integration works
- ✅ User experience is smooth

---

## 🔄 **Live Updates During Testing**

*This guide is updated in real-time as we discover new patterns, solutions, and best practices.*

### **Recent Discoveries**
- **2025-01-14**: Fixed file-based/database agent discrimination in frontend
- **2025-01-14**: All agents now use unified A2A protocol
- **2025-01-14**: Removed `isDatabaseAgent` logic from multiple files

### **Testing Session Notes**
*Add discoveries, patterns, and solutions as we encounter them during testing sessions.*

---

*This guide is a living document. Update it as you discover new patterns, solutions, and best practices during testing.*
