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

## 📍 Phase 3: Frontend Agent Interface with Ionic (Orchestrator-First)

### 🎯 Goal
Create an **Ionic + Vue 3** interface that puts the **Orchestrator** front and center, providing a seamless experience on both web and mobile (e.g., iPhone app). The user interacts with a single chat-style interface — the orchestrator handles everything.

### 🧱 Tasks
- Build an orchestrator-first chat interface using Ionic and Vue 3 components.
- Ensure responsive design for both web and mobile form factors.
- Add push-to-talk input (leveraging device capabilities via Ionic/Capacitor where possible, browser STT as fallback).
- Implement logic to only show available agents when explicitly requested by the user.
- Visualize agent responses clearly within the message thread, indicating the source agent.
- Prepare base structure for compiling to a native mobile application (e.g., for iPhone).

### 📎 Deliverables
| Deliverable                       | Description                                                      |
|-----------------------------------|------------------------------------------------------------------|
| Ionic + Vue Chat UI               | Single prompt input, threaded message view, responsive design.   |
| Cross-Platform Push-to-Talk     | Voice input leveraging native capabilities or browser STT.         |
| On-Demand Agent Discovery       | Agent list/capabilities displayed only when requested.           |
| Clear Agent Response Attribution | Messages clearly show which agent provided the response.         |
| Mobile Build Foundation         | Project structured for future native compilation with Capacitor. |

### 🤔 Phase Review & Future Enhancements
- **Key Learnings/Outcomes (Frontend - Initial Pass):**
  - Basic Ionic + Vue 3 project structure established for the frontend.
  - Core chat UI layout (header, message area, input footer) implemented.
  - Pinia stores for messages, agents (mocked), and UI state are set up.
  - Message display components (`MessageItem`, `MessageList`) created with Markdown rendering for agent responses and visual sender differentiation.
  - Chat input component (`ChatInput`) created with local state and event emission.
  - Basic integration with a (mocked) backend orchestrator flow via `apiService.ts` and `messagesStore` action.
  - Web-based Push-to-Talk (PTT) implemented using the Web Speech API.
- **Deviations from Original Plan:**
  - Native PTT implementation via a Capacitor plugin (Subtask 7.5) was deferred; current PTT relies on Web Speech API which works in mobile browsers but is not a true native integration. Placeholders for native integration are in `ChatInput.vue`.
- **Deferred Items for Phase 3 Frontend:**
  - Full native PTT integration using a Capacitor plugin (e.g., `@capacitor-community/speech-recognition`).
  - Advanced error display mechanisms (e.g., toasts instead of alerts for PTT errors).
  - Sophisticated agent avatar/icon mapping.
- **Potential Future Enhancements (for this UI foundation):**
  - Real-time updates/typing indicators.
  - UI for managing or selecting specific agents if direct interaction is desired beyond orchestrator-first.
  - More detailed loading states (e.g., per message, not just global).
  - UI for PTT error messages (currently uses `alert`).
- **Impact on Subsequent Phases:**
  - The current frontend provides a solid base for Phase 4 (Full Sub-Agent Implementation) as messages can be sent and responses (including Markdown) can be displayed.
  - Phase 5 (Supabase Authentication) will require adding UI elements for login/signup and protecting API calls.

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