# Hiverarchy AI - Multi-Agent System

## Overview

Hiverarchy AI is a production-ready multi-agent system that intelligently routes conversations to specialized AI agents. Built with TypeScript NestJS and Vue.js, it provides a professional-grade platform for automating business processes through natural language interaction.

**Key Features:**
- **Intelligent Orchestration**: Central agent that routes requests to specialized agents
- **Comprehensive Agent Library**: 20+ pre-built agents for business, marketing, HR, and customer service
- **Session Management**: Maintains conversation context and history
- **Modern Tech Stack**: NestJS TypeScript backend with Vue.js frontend
- **Production Ready**: Docker support, commercial licensing, enterprise architecture

## Agent Categories

**Business Operations**
- Internal RAG, Invoice Processing, Metrics Analysis, SOP Management

**Customer Service**  
- Chat Support, Email Triage, Voice Receptionist, Call Summaries

**Marketing & Content**
- Blog Writing, Content Creation, Lead Management, Social Media

**Human Resources**
- Employee Onboarding, Policy Management, HR Assistant

**Development & Productivity**
- Requirements Writing, Project Management, Meeting Summaries

**External Intelligence**
- Market Research, Competitor Analysis, Industry Insights

## Quick Start

### Prerequisites
- **Node.js** 18+ with npm
- **OpenAI API Key** for LLM capabilities

### Installation

1. **Clone Repository**
   ```bash
   git clone <repository-url>
   cd orchestrator-ai
   ```

2. **Install Dependencies**
   ```bash
   # Root workspace dependencies
   npm install
   
   # API dependencies  
   cd apps/api
   npm install
   cd ../..
   
   # Frontend dependencies
   cd apps/web
   npm install
   cd ../../..
   ```

3. **Environment Setup**
   Create `.env` file in project root:
   ```env
   # Required
   OPENAI_API_KEY=sk-your-openai-key-here
   
   # Optional - Defaults provided
   API_PORT=8000
   WEB_PORT=5173
   ENVIRONMENT=development
   ```

### Running the Application

**Full Stack Development** (Recommended)
```bash
npm run dev
```
- API: http://localhost:4000
- Web Interface: http://localhost:3000

**Individual Services**
```bash
npm run dev:api       # API only
npm run dev:web       # Frontend only
```

## Docker Deployment

**Build and Run**
```bash
npm run docker:build
npm run docker:run
```

**Management**
```bash
npm run docker:logs      # View logs
npm run docker:stop      # Stop containers
npm run docker:clean     # Remove containers and images
```

## Usage Examples

**Getting Started**
- "Hello, I'm Sarah from the marketing team"
- "What can you help me with?"

**Content Creation**
- "Write a blog post about AI trends in 2024"
- "Create social media content for our product launch"

**Business Analysis**
- "Analyze last quarter's sales performance"
- "Generate a competitive analysis report"

**Customer Service**
- "Help me draft a response to this customer complaint"
- "Summarize recent support tickets"

## API Documentation

Once running, access interactive API documentation:
- **Swagger UI**: http://localhost:4100/api
- **Health Check**: http://localhost:4100/health

## Project Structure

```
hiverarchy-ai/
├── apps/
│   ├── api/             # TypeScript NestJS backend
│   │   ├── src/
│   │   │   ├── agents/     # Agent implementations
│   │   │   ├── auth/       # Authentication system
│   │   │   ├── supabase/   # Database integration
│   │   │   └── main.ts     # Application entry point
│   └── web/             # Vue.js frontend
│       ├── src/
│       │   ├── components/ # UI components
│       │   ├── services/   # API clients
│       │   └── stores/     # State management
├── package.json            # Development scripts
├── turbo.json             # Monorepo configuration  
└── LICENSE                # Commercial license
```

## Technology Stack

**Backend**
- NestJS (TypeScript web framework)
- Supabase (database and authentication)
- TypeScript (type safety)
- OpenAI SDK (LLM integration)

**Frontend**  
- Vue.js 3 (progressive framework)
- Pinia (state management)
- TypeScript (type safety)
- Vite (build tooling)

**Infrastructure**
- Docker (containerization)
- Turbo (monorepo management)
- Node.js (runtime)

## License

Commercial license - see LICENSE file for details. This software is proprietary and intended for customer use only. Redistribution and modification restrictions apply.

## Support

For technical support, customization requests, or enterprise licensing:
- Review API documentation at /docs endpoint
- Check configuration files for customization options
- Ensure all environment variables are properly configured

---

**Ready to deploy** - This system is production-ready and suitable for enterprise deployment through Docker Compose or containerization platforms. 