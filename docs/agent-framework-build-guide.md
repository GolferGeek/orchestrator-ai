# 🧠 Agent Framework Build Guide  
### A Hands-On Project for Learning and Teaching AI Agent Development  

This document outlines the multi-phase plan for building an interoperable, A2A-compatible agent framework using FastAPI, Vue, Supabase, and markdown-based agent context. It is designed as both a collaborative project and a developer training platform.

---

## 📍 Phase 1: Core Scaffolding (✅ Mostly Complete)

### 🎯 Goal  
Establish a fully functional development foundation for an agent-based system using modern tools and clean architecture. This includes the orchestrator, agent discovery, and frontend/backend separation.

### 🏗️ Current Status  
- ✅ Turbo repo with FastAPI backend and Vue frontend
- ✅ All core agents defined with `.well-known/agent.json` discovery files
- ✅ Orchestrator agent with A2A-compatible task routing
- ✅ Vue UI scaffolded
- 🔲 Agents to add:
  - `marketing_swarm` (brainstorming)
  - `write_blog_post` (content gen)
  - `requirements_writer` (software spec writer)

### 🛠 Remaining Tasks  
- Implement missing agents with `agent.json` and basic routes

### 📎 Deliverables  
| Deliverable                  | Status       |
|------------------------------|--------------|
| Turbo repo                   | ✅ Done       |
| Agent registry & routing     | ✅ Done       |
| `marketing_swarm` agent      | 🔲 To be added |
| `write_blog_post` agent      | 🔲 To be added |
| `requirements_writer` agent  | 🟡 Planned     |

---

## 📍 Phase 2: Context-Based Agent Bootstrapping

### 🎯 Goal  
Use markdown files as immediate agent knowledge bases for LLM prompting, enabling useful output from each agent without building full APIs or vector databases.

### 🧠 Strategy  
- Place `context.md` for each agent in a root-level `markdown_context/` folder (for Obsidian editing)
- Each agent reads its markdown and uses it for dynamic LLM prompt construction
- This bypasses the need for RAG in early phases

### 📁 Context File Layout

```
markdown_context/
├── marketing_swarm.md
├── write_blog_post.md
├── metrics_agent.md
└── requirements_writer.md
```

### 🧱 Tasks  
- Write context markdowns for each agent
- Create shared MCP for markdown processing across all agents
- Create FastAPI endpoints that read those markdowns and prompt the LLM
- Return generated content to the orchestrator or frontend

### 📎 Deliverables  
| Deliverable                    | Description                               |
|--------------------------------|-------------------------------------------|
| Shared `markdown_context/` dir | Central source of agent knowledge         |
| Shared markdown processing MCP | Common code for all agents to use context |
| FastAPI LLM routes             | Prompt LLMs using markdown + user input   |
| `openai_utils.py`              | (Optional) wrapper for model calls        |
| Updated `agent.json` examples  | Add skill examples to reflect markdown    |

---

## 📍 Phase 3: Frontend Agent Interface (Orchestrator-First)

### 🎯 Goal  
Create a Vue 3 interface that puts the **Orchestrator** front and center. The user interacts with a single chat-style interface — the orchestrator handles everything.

### 🧱 Tasks
- Build an orchestrator-first chat interface
- Add push-to-talk input (browser STT to start)
- Only show available agents when asked
- Visualize agent responses in message thread

### 📎 Deliverables  
| Deliverable                  | Description                                 |
|------------------------------|---------------------------------------------|
| Chat-style orchestrator UI   | One prompt input, one thread view           |
| Push-to-talk input           | Simple browser voice integration            |
| Agent discovery via prompt   | Agent list only appears when requested      |
| Agent response rendering     | Show which agent answered which message     |

---

## 📍 Phase 4: Full Sub-Agent Implementation

### 🎯 Goal  
Transition each markdown-bootstrapped agent into a **fully implemented functional agent** using structured input validation, external APIs, tools, or internal logic. This marks the beginning of "real-world agent behavior" that goes beyond static context.

### 🧱 Tasks
- Define structured inputs and outputs for each agent skill
- Refactor each route to use Pydantic models
- Replace static markdown-only prompting with real logic (LLM or programmatic)
- Optionally connect to tools, RAG, or external APIs

### 📎 Deliverables  
| Deliverable               | Description                              |
|---------------------------|------------------------------------------|
| Refactored agent routers  | Functional endpoints per skill           |
| Updated `agent.json`      | With input/output schemas and examples   |
| FastAPI models            | Input/output Pydantic schemas per skill  |
| Unit tests (optional)     | For input validation + error handling    |

---

## 📍 Phase 5: Supabase Authentication

### 🎯 Goal  
Implement secure authentication and user management using Supabase for both frontend and API.

### 🧱 Tasks
- Set up Supabase project and configure auth providers
- Implement JWT validation in FastAPI backend
- Add login/signup flows to Vue frontend
- Configure user-specific data storage and access control

### 📎 Deliverables  
| Deliverable                  | Status       |
|------------------------------|--------------|
| Supabase project setup       | 🔲 To do     |
| API JWT validation           | 🔲 To do     |
| Vue auth integration         | 🔲 To do     |
| User-specific agent context  | 🔲 To do     |

---

## 📍 Phase 6: Agent Feedback & Evaluation  
### (*Ongoing Phase – Continues Through Agent Expansion*)

### 🎯 Goal  
Introduce lightweight feedback + task scoring to improve agent quality over time. Track task outcomes and user reactions.

### 🧱 Tasks
- Add feedback buttons to each agent response (👍👎)
- Store task results (success, failure, clarification)
- Track agent scores (success rate, likes, last used)
- Review and evaluate agents **one at a time**
- Always keep app in demo-ready state

### 📎 Deliverables  
| Deliverable                  | Description                                  |
|------------------------------|----------------------------------------------|
| Task feedback UI             | 👍👎 buttons + optional comment                |
| Orchestrator scoring memory  | Tracks task success and satisfaction         |
| Agent inspection tool (opt.) | View stats/history per agent                 |

---

## 📍 Phase 7: Demo & Outreach Packaging

### 🎯 Goal  
Package the project for public demo, business outreach, and educational delivery.

### 🧱 Tasks
- Add a "demo mode" experience
- Write teaching docs and project overview
- Create a use-case page for small businesses
- Provide setup steps for forking and reusing the framework

### 📎 Deliverables  
| Deliverable                 | Description                                  |
|-----------------------------|----------------------------------------------|
| Demo-ready interface        | Simple, smooth UX for showcasing agents      |
| Docs folder                 | Includes agent concepts, routing, setup      |
| Teaching notes              | Tips for learners and career pivoters        |
| Business use case summary   | Explains why this system matters to SMBs     |
| Pitch-ready instructions    | Clean README or markdown deck                |

---