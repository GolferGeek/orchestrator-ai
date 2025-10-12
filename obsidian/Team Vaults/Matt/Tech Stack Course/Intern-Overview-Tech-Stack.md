# Orchestrator AI - Tech Stack Overview (For Interns)

**Read this first!** This is your 10-minute introduction to what we're building and how it works.

---

## What is Orchestrator AI?

**One sentence:** A platform that lets organizations create, deploy, and orchestrate custom AI agents that work together to solve complex business problems.

**Think of it like:** Zapier meets ChatGPT meets enterprise software - but for building intelligent agent workflows.

---

## What Does It Do?

### For Users:
- Create custom AI agents (without coding)
- Have agents talk to each other
- Build multi-step workflows with AI
- Keep their data private and secure
- Track costs and usage

### Real Example:
```
User: "I need to write a blog post about our new feature"

1. Research Agent → Gathers information
2. Writer Agent → Drafts the post
3. Editor Agent → Reviews and polishes
4. Publisher Agent → Formats and publishes

All automatically, with human approval gates where needed.
```

---

## The Tech Stack (What We Use)

### **Monorepo Structure**
We organize everything in one repository with multiple apps:

```
orchestrator-ai/
├── apps/api/          ← Backend (NestJS)
├── apps/web/          ← Frontend (Vue + Ionic)
├── apps/n8n/          ← Workflow builder
└── apps/transport-types/ ← Shared types
```

**Why?** Easier to manage, share code, and deploy together.

---

### **Backend: NestJS + TypeScript**
**What:** Node.js framework for building APIs  
**Why:** Modular, scalable, enterprise-ready  
**Location:** `apps/api/`

**Key Concepts:**
- **Modules** - Like folders that group related features
- **Services** - Where business logic lives
- **Controllers** - Handle HTTP requests/responses
- **Repositories** - Talk to the database

---

### **Frontend: Vue 3 + Ionic**
**What:** Modern JavaScript framework + mobile UI components  
**Why:** Fast, reactive, works on web and mobile  
**Location:** `apps/web/`

**Key Concepts:**
- **Components** - Reusable UI pieces (like buttons, forms)
- **Stores (Pinia)** - App-wide state management
- **Services** - Talk to the backend API
- **Composables** - Reusable logic

---

### **Database: PostgreSQL + Supabase**
**What:** Powerful relational database with auth/storage  
**Why:** Scalable, secure, built-in authentication  
**Location:** `apps/api/supabase/`

**Key Concepts:**
- **Tables** - Store data (agents, conversations, tasks)
- **Row-Level Security** - Each user only sees their data
- **Migrations** - How we update database structure

---

### **AI/LLM Integration**
**What:** Connect to multiple AI providers (OpenAI, Anthropic, Google, etc.)  
**Why:** Give users choice, avoid vendor lock-in  
**Location:** `apps/api/src/llms/`

**Providers We Support:**
- OpenAI (ChatGPT)
- Anthropic (Claude)
- Google (Gemini)
- Local models (Ollama)
- xAI (Grok)

---

## How Agents Work (Core Concept)

### **Agent Types:**

1. **Context Agents** - LLM + instructions (most common)
2. **Tool Agents** - Can use external tools/APIs
3. **API Agents** - Proxy to other services
4. **External Agents** - Connect to remote agents
5. **Orchestrator Agents** - Run multi-step workflows
6. **Function Agents** - Execute custom code

### **Execution Modes:**

Each agent can operate in different modes:
- **CONVERSE** - Chat back and forth
- **PLAN** - Create a plan for solving something
- **BUILD** - Generate a deliverable (document, code, etc.)

---

## Key Features You Should Know

### **1. Agent-to-Agent Communication**
Agents can call other agents to break down complex tasks.

### **2. Privacy Controls**
- Detect and mask personal information (PII)
- Keep data in specific regions (sovereign routing)
- Redact secrets automatically

### **3. Multi-Provider LLM**
Users choose which AI provider to use:
- Cost optimization
- Performance tuning
- Data sovereignty

### **4. Real-Time Updates**
Using SSE (Server-Sent Events), users see agent work in real-time.

### **5. Human-in-the-Loop**
Agents can pause and ask for human approval before continuing.

---

## Development Workflow (What You'll Do)

### **Local Setup:**
```bash
# Start backend
npm run dev:api     # Runs on port 9000

# Start frontend  
npm run dev:web     # Runs on port 7101

# Start database
cd apps/api && supabase start
```

### **Typical Tasks:**
- Create new agent types
- Build UI components
- Write tests
- Fix bugs
- Add features

---

## Important Concepts

### **Transport Types**
**What:** Shared TypeScript definitions for request/response  
**Why:** Ensures type safety between frontend ↔ backend ↔ agents  
**Location:** `apps/transport-types/`

### **A2A Protocol**
**What:** Agent-to-Agent communication standard  
**Why:** Agents can talk to each other reliably  
**Note:** We follow this strictly for compatibility

### **Orchestration**
**What:** Running multi-step agent workflows  
**Why:** Complex tasks need multiple agents working together  
**Example:** Research → Write → Edit → Publish

---

## What You Need to Know (Priorities)

### **Week 1: Learn the Basics**
- How monorepo is structured
- How to start local development
- Where agents are defined
- How to create a simple agent

### **Week 2-4: Understand the Flow**
- How requests flow through the system
- How agents execute
- How frontend talks to backend
- How data is stored

### **Month 2+: Deep Dives**
- LLM integration patterns
- Privacy features
- Orchestration system
- Performance optimization

---

## Common Questions

### **Q: Do I need to be an AI expert?**
No! You need to understand our platform. The AI providers handle the "AI magic."

### **Q: What if I break something?**
We have local development environments. You can't break production from your laptop.

### **Q: How much of the codebase do I need to know?**
Start with one module (like agents or frontend), then expand. Nobody knows everything.

### **Q: What's the most important thing to understand?**
How agents are defined and executed. That's the core of our platform.

---

## Resources

### **Documentation:**
- Full Analysis: `00-Codebase-Analysis.md`
- Quick Reference: `Quick-Reference.md`
- Agent Types: `/docs/agent-types/`

### **Code Locations:**
- Backend Agents: `apps/api/src/agent-platform/`
- Frontend: `apps/web/src/`
- Database: `apps/api/supabase/`

### **Getting Help:**
- Ask Matt (he built this!)
- Check existing agent examples
- Read the PRDs in `/docs/prd/`

---

## Your First Week Goals

**By End of Week 1, you should be able to:**

✅ Start the application locally  
✅ Navigate the codebase structure  
✅ Understand what an "agent" is  
✅ Create a simple context agent  
✅ Test it in the UI  

**Don't worry about:**
- ❌ Understanding every module
- ❌ Knowing all the LLM details
- ❌ Memorizing database schemas
- ❌ Being production-ready

---

## Next Steps

1. ✅ Read this overview (you're doing it!)
2. ⏭️ Set up local development
3. ⏭️ Explore the UI
4. ⏭️ Create your first agent
5. ⏭️ Read deeper documentation as needed

---

**Welcome to the team! You've got this.** 🚀

**Questions?** Ask Matt or check the detailed analysis docs.

