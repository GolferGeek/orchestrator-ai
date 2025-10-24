# Textual Landing Page Feature PRD

## Overview

Create a parallel textual landing page that provides deep, technical information about OrchestratorAI's offerings through an accordion-based interface. This is an admin-only demo project that addresses the gap between high-level marketing content and the detailed technical information that small business decision-makers need to understand AI adoption. Business users will see the MyOrg landing page, while this demo serves as a comprehensive information resource for evaluation purposes.

## Problem Statement

Small business decision-makers need comprehensive, honest information to evaluate AI solutions, but most resources are either:
- **Marketing-focused**: Surface-level content that doesn't provide the technical depth needed for informed decisions
- **Overwhelming**: Technical documentation that's too complex for business owners to understand
- **Incomplete**: Missing critical information about implementation, costs, and real-world challenges
- **Unrealistic**: Promises that don't match the actual complexity and requirements

Small businesses need a resource that provides the complete picture: what AI agents are, how they work, what the technology stack includes, what implementation actually involves, and what it really costs.

## Solution

A comprehensive textual landing page that serves as a complete information resource for small business decision-makers:
- **Progressive Disclosure**: Accordion structure that allows users to dive as deep as they want
- **Complete Information**: Everything needed to understand the offering, technology, and implementation
- **Honest Assessment**: Realistic view of challenges, costs, and requirements
- **Technical Transparency**: Full disclosure of technology stack, architecture, and development process
- **Decision Support**: Clear information to help small businesses make informed choices

## User Stories

### Primary Users
- **Admin/Developer**: You will be the primary user maintaining and updating this demo
- **Potential Clients**: Small business decision-makers evaluating the offering (admin-only access)
- **Technical Evaluators**: Those who need detailed technical architecture information for assessment

### User Journey (Admin Demo)
1. Admin accesses the demo landing page (marketing view by default)
2. Admin clicks "Detailed Information" or "Technical View" button
3. Admin sees 6 main accordion sections, all expanded by default
4. Admin can collapse/expand sections based on interest
5. Admin can drill down into sub-accordions for more detail
6. Admin can switch back to marketing view at any time
7. Admin can use this as a reference for client discussions and evaluations

## Feature Requirements

### 1. Dual View System
- **Toggle Button**: Prominent button to switch between "Marketing View" and "Technical View"
- **State Persistence**: Remember which accordions were open when switching views
- **URL Parameters**: Support direct linking to textual view and specific accordion sections

### 2. Accordion Structure
- **Visual Hierarchy**: 
  - Main accordions: Full width
  - Sub-accordions: Narrower width (indented)
  - Sub-sub-accordions: Even narrower width
- **Default State**: All main accordions expanded on first visit
- **Responsive Design**: Mobile-friendly accordion behavior

### 3. Content Sections

**Note**: The accordion structure now includes 6 main sections instead of 4, with the addition of Technology Stack and Agent Building Process sections.

#### Section 1: Small Business and AI
**Main Content**: Small businesses face overwhelming AI information, technical complexity above their expertise level, security concerns, unclear ROI, and development challenges. OrchestratorAI addresses these by providing clear guidance, accessible technology, robust privacy protection, transparent pricing with proven returns, and complete implementation support.
**Video Integration**: Link to "Introduction to Orchestrator AI" video (intro-main)

**Sub-Accordions**:
- **AI as a Fire Hose**: The information overload problem
  - *Video Link*: "Introduction to Orchestrator AI" (intro-main)
- **Technical Complexity**: Why AI feels above small business pay grade
- **Security and Privacy**: Small business concerns with AI adoption
  - *Video Link*: "Privacy & Security" video (privacy-security category)
- **Cost and ROI**: Financial considerations and return on investment
- **Development Challenges**: Technical implementation barriers

#### Section 2: Our Offering
**Main Content**: We provide a complete AI implementation package including a piloting server (Mac Studio 128GB or equivalent), our forked repository with starter agents, super cheap consulting ($120/hour for me, $50/hour for interns), team building and training, and ongoing support. Setup starts at $15k with everything included - hardware, software, training, and initial configuration.
**Video Integration**: Link to "How We Work" video (how-we-work category)

**Sub-Accordions**:
- **Piloting Server**: Hardware requirements and specifications
- **Forked Repository**: Starter agents and customization options
  - *Video Link*: "Agent Demo - Marketing Assistant" (demo-1) or other demo videos
- **Consulting Services**: Setup, training, and ongoing support
  - *Video Link*: "Behind the Scenes - Development Process" (demo-2)
- **Pricing Structure**: $15k setup, $120/hour consulting, $50/hour interns
- **Team Building**: AI group development and leadership training

#### Section 3: Agent Architecture
**Main Content**: Our system follows A2A (Agent-to-Agent) and MCP (Model Context Protocol) standards for reliable communication. We offer four agent types: Context agents (knowledge-based), Function agents (TypeScript/Python), API agents (external service wrappers), and Orchestrator agents (workflow coordination). Agents are organized in demo/ and my-org/ directories, with file-based storage now and database-based agents coming soon for rapid creation.
**Video Integration**: Link to "Agent Architecture" video (agent-architecture-main)

**Sub-Accordions**:
- **A2A Protocol**: Agent-to-Agent communication standards
- **MCP Integration**: Model Context Protocol implementation
- **Agent Types**: Context, Function (TypeScript/Python), API, Orchestrator agents
  - *Video Link*: "Context Agent Architecture" (context-agent-architecture)
- **File vs Database Agents**: Current and future agent storage
- **Demo vs MyOrg**: Agent organization and customization

#### Section 4: What We're Working On
**Main Content**: We're building project orchestration for large-scale agent activity with human-in-the-loop evaluation, AI versioning for content comparison and merging, multi-modal input handling for images and files, database-based agents for rapid creation, and MCP tool integration so agents can use external tools. Our goal is finely-tuned, single-purpose agents that work together seamlessly.
**Video Integration**: Link to "What We're Working On Next" video (roadmap-main)

**Sub-Accordions**:
- **Project Orchestration**: Large-scale agent activity planning
- **Human-in-the-Loop**: Evaluation and approval workflows
- **AI Versioning**: Content comparison and merging capabilities
- **Multi-Modal Inputs**: Image and file processing capabilities
- **Database-Based Agents**: Rapid agent creation and deployment
- **MCP Tool Integration**: Agents using MCP tools for complex projects

#### Section 5: Technology Stack
**Main Content**: We use Vue.js with Ionic for the frontend, NestJS with Node.js for the backend, and Supabase with PostgreSQL for data management. Development is done with Cursor, GitHub, and modern AI-assisted tools. We help clients set up their development environment, understand fork management (why agents are in safe my-org/ directories), and configure local LLM environments with MCP integration for testing and deployment.
**Video Integration**: Link to "Behind the Scenes - Development Process" video (demo-2)

**Sub-Accordions**:
- **Frontend Technology**: Vue.js, Ionic, TypeScript, and modern web technologies
- **Backend Architecture**: NestJS, Node.js, and API design patterns
- **Database & Storage**: Supabase, PostgreSQL, and data management
- **Development Tools**: Cursor, GitHub, and modern development workflow
- **Fork Management**: Understanding forks, updates, and safe agent development
- **AI Development Environment**: Local LLM setup, MCP integration, and testing

#### Section 6: Agent Building Process
**Main Content**: Agents are specialized AI programs that perform specific tasks autonomously. We provide rules files for each agent type (Context, Function, API, Orchestrator) that guide AI-assisted development with Cursor, Claude, or Codex. Our process includes understanding what agents are, using standardized rules files for consistent development, leveraging AI tools for rapid creation, and building agents that communicate through A2A protocols for seamless integration.
**Video Integration**: Link to "Agent Demo - Marketing Assistant" video (demo-1)

**Sub-Accordions**:
- **What Are Agents?**: Understanding AI agents and their capabilities
- **Context Agent Builder**: Building knowledge-based agents with rules files
- **Function Agent Builder**: Creating TypeScript and Python function agents
- **API Agent Builder**: Wrapping external APIs and services
- **Orchestrator Agent Builder**: Building coordination and workflow agents
- **Rules File System**: Using Cursor rules for consistent agent development
- **AI-Assisted Development**: Leveraging Cursor, Claude, and other AI tools

### 4. Video Integration
- **VideoModal Component**: Use existing VideoModal component for all video playback
- **Video Data Source**: Pull video data from existing `videos.json` structure
- **Strategic Placement**: Place video links at logical points throughout accordion content
- **Video Categories**: Map existing video categories to relevant accordion sections
- **Modal Props**: 
  - `isOpen`: Boolean for modal state
  - `videoTitle`: Video title from videos.json
  - `videoDescription`: Video description from videos.json  
  - `videoUrl`: Video URL from videos.json
  - `@close`: Event handler for closing modal

### 5. Technical Requirements
- **Performance**: Lazy-loading for deep accordion content
- **SEO**: All content crawlable and indexable
- **Accessibility**: Proper ARIA labels and keyboard navigation
- **Search**: Optional search functionality within textual view
- **Print-Friendly**: Clean printing of accordion content

## Success Criteria
- **Information Completeness**: Small business decision-makers have all the information they need to make informed decisions
- **Technical Clarity**: Complex concepts are explained in accessible terms without losing accuracy
- **Decision Support**: Users can understand the value proposition, technical approach, and implementation process
- **Trust Building**: Transparency about technology, pricing, and capabilities builds confidence in the offering

## Video Integration Strategy

### Video Placement Logic
- **Main Section Videos**: One primary video per main accordion section
- **Sub-Accordion Videos**: Relevant videos for specific technical topics
- **Demo Videos**: Showcase actual functionality and behind-the-scenes content
- **Educational Videos**: Explain complex concepts with visual demonstrations

### Video Button Design
- **Primary Video Links**: Prominent buttons with play icon and video title
- **Secondary Video Links**: Smaller hyperlinks within text content
- **Video Thumbnails**: Optional thumbnail previews for key videos
- **Duration Display**: Show video length to set user expectations

### Video Data Mapping
Based on existing `videos.json` structure:

| Video Category | Accordion Section | Video ID | Purpose |
|---|---|---|---|
| introduction | Small Business and AI | intro-main | Overview and value proposition |
| privacy-security | Small Business and AI → Security | privacy-main | Security concerns and solutions |
| how-we-work | Our Offering | how-we-work-main | Service delivery process |
| agent-architecture | Agent Architecture | agent-architecture-main | Technical architecture overview |
| agent-architecture | Agent Architecture → Agent Types | context-agent-architecture | Deep dive into context agents |
| what-were-working-on-next | What We're Working On | roadmap-main | Future development roadmap |
| demos | Our Offering → Demos | demo-1, demo-2 | Live demonstrations |
| demos | Technology Stack | demo-2 | Development process and tools |
| demos | Agent Building Process | demo-1 | Agent demonstrations and building |

## Implementation Phases

### Phase 1: Core Structure
- Dual view toggle system
- Basic accordion functionality
- Content for all 6 main sections
- Video integration with existing VideoModal component
- **Rules file system for agent building** (see detailed tasks below)

### Phase 2: Enhanced UX
- State persistence
- URL parameter support
- Mobile optimization
- Video thumbnail previews

### Phase 3: Advanced Features
- Search functionality
- Print optimization
- Analytics integration
- Video engagement tracking

## Rules File Creation Tasks

### Task 1: Context Agent Rules File
**Deliverable**: `context-agent-rules.md`
**Location**: `.cursor/rules/` directory
**Content**:
- Agent definition and purpose
- Required file structure (agent.json, markdown context files, route handlers)
- Implementation patterns for knowledge storage and retrieval
- Code examples and templates
- Testing requirements for context accuracy
- Integration guidelines with other agents

### Task 2: Function Agent Rules File
**Deliverable**: `function-agent-rules.md`
**Location**: `.cursor/rules/` directory
**Content**:
- Agent definition and purpose
- TypeScript and Python implementation patterns
- Input/output validation requirements
- Error handling best practices
- Code examples for common function types
- Testing requirements for function correctness
- Performance optimization guidelines

### Task 3: API Agent Rules File
**Deliverable**: `api-agent-rules.md`
**Location**: `.cursor/rules/` directory
**Content**:
- Agent definition and purpose
- API client configuration patterns
- Authentication handling (API keys, OAuth, etc.)
- Request/response processing
- Rate limiting and error recovery
- Code examples for common API integrations
- Testing requirements for API connectivity
- Security best practices

### Task 4: Orchestrator Agent Rules File
**Deliverable**: `orchestrator-agent-rules.md`
**Location**: `.cursor/rules/` directory
**Content**:
- Agent definition and purpose
- Workflow definition patterns
- Agent coordination and communication
- State management approaches
- Task routing and dependency handling
- Code examples for common orchestration patterns
- Testing requirements for workflow execution
- Error handling and recovery strategies

### Task 5: Rules File Integration
**Deliverable**: Integration with textual landing page
**Content**:
- Links to rules files in Agent Building Process section
- Demo workflow showing rules file usage
- Documentation on how to use rules files with Cursor/Claude
- Examples of AI-assisted development using rules files

### Task 6: Rules File Testing and Validation
**Deliverable**: Validated and tested rules files
**Content**:
- Test each rules file with actual agent creation
- Validate that AI tools can follow the rules effectively
- Refine rules based on testing results
- Create example agents using each rules file
- Document any issues or improvements needed

## Content Guidelines

### Tone and Style
- **Professional but Accessible**: Technical accuracy without jargon overload
- **Business-Focused**: Always tie technical concepts back to business value
- **Honest and Transparent**: Acknowledge challenges and limitations - no marketing fluff
- **Complete Information**: Provide everything needed for informed decision-making
- **Realistic**: Set proper expectations about implementation complexity and timeline

### Content Structure
- **Paragraph Summary**: 2-3 sentences for each main section
- **Accordion Details**: 3-5 paragraphs with specific examples
- **Sub-Accordion Depth**: Technical specifications and implementation details
- **Call-to-Action**: Clear path to engagement at each level

## Technical Considerations

### Frontend Framework
- Leverage existing Vue.js infrastructure
- Consider accordion component library or custom implementation
- Ensure responsive design across all device sizes

### Content Management
- **No CMS Required**: This is an admin-only demo project
- **Manual Updates**: Content changes handled through fork updates by admin
- **Version Control**: All content changes tracked through Git
- **Admin-Only Access**: Business users will see the MyOrg landing page, not this demo

### Performance
- Optimize for fast loading of textual view
- Consider content preloading strategies
- Monitor Core Web Vitals impact

## Rules File System for Agent Building

### Purpose
The rules file system provides standardized guidelines and best practices for building each type of agent. These rules ensure consistency, quality, and proper implementation when using AI-assisted development tools like Cursor, Claude, or Codex.

### Rules File Structure
Each agent type will have a dedicated rules file containing:
- **Agent Definition**: What the agent does and its purpose
- **Required Components**: Essential files, functions, and configurations
- **Implementation Patterns**: Standard approaches and best practices
- **Code Examples**: Sample implementations and templates
- **Testing Requirements**: How to verify the agent works correctly
- **Integration Guidelines**: How the agent connects with other system components

### Agent Type Rules Files

#### 1. Context Agent Rules (`context-agent-rules.md`)
- **Purpose**: Knowledge-based agents that provide information and context
- **Key Components**: Markdown context files, agent.json, route handlers
- **Implementation**: File-based knowledge storage, context retrieval patterns
- **Testing**: Context accuracy, response quality, knowledge coverage

#### 2. Function Agent Rules (`function-agent-rules.md`)
- **Purpose**: Agents that perform specific computational tasks
- **Key Components**: TypeScript/Python functions, input/output validation, error handling
- **Implementation**: Pure functions, async operations, data transformation
- **Testing**: Function correctness, performance, edge case handling

#### 3. API Agent Rules (`api-agent-rules.md`)
- **Purpose**: Agents that wrap external APIs and services
- **Key Components**: API client configuration, authentication, request/response handling
- **Implementation**: HTTP clients, rate limiting, error recovery, data mapping
- **Testing**: API connectivity, response parsing, error scenarios

#### 4. Orchestrator Agent Rules (`orchestrator-agent-rules.md`)
- **Purpose**: Agents that coordinate and manage other agents
- **Key Components**: Workflow definitions, agent coordination, state management
- **Implementation**: Task routing, dependency management, progress tracking
- **Testing**: Workflow execution, agent coordination, error handling

### AI Development Workflow
1. **Reference Rules File**: Developer opens the appropriate rules file for the agent type
2. **AI-Assisted Development**: Use Cursor/Claude with rules file as context
3. **Guided Implementation**: AI follows the rules to generate consistent code
4. **Quality Assurance**: Rules ensure proper patterns and best practices
5. **Testing & Validation**: Follow testing requirements from rules file

### Benefits
- **Consistency**: All agents follow the same patterns and standards
- **Quality**: Built-in best practices and error handling
- **Efficiency**: AI tools can generate better code with clear guidelines
- **Maintainability**: Standardized structure makes updates easier
- **Onboarding**: New developers can quickly understand agent patterns

## "What Are Agents?" Content Framework

### Core Concept Explanation
**Agents are specialized AI programs that perform specific tasks autonomously or with minimal human intervention.** Think of them as digital employees that can:
- **Understand Context**: Process and interpret information relevant to their domain
- **Make Decisions**: Choose appropriate actions based on their knowledge and goals
- **Execute Tasks**: Perform specific functions like data processing, API calls, or content generation
- **Communicate**: Interact with other agents, systems, and humans through standardized protocols

### Agent vs. Traditional Software
| Traditional Software | AI Agents |
|---|---|
| Follows predetermined logic | Adapts behavior based on context |
| Requires exact inputs | Handles ambiguous or incomplete information |
| Static functionality | Learns and improves over time |
| Isolated operation | Collaborative and communicative |
| Human-driven interaction | Autonomous task execution |

### Types of Agents in OrchestratorAI

#### 1. Context Agents
- **Purpose**: Provide knowledge and information
- **Example**: Marketing agent that knows about SEO best practices
- **How it works**: Stores knowledge in markdown files, retrieves relevant information based on queries

#### 2. Function Agents
- **Purpose**: Perform specific computational tasks
- **Example**: Data processing agent that cleans and formats customer data
- **How it works**: Executes TypeScript or Python functions with defined inputs and outputs

#### 3. API Agents
- **Purpose**: Connect to external services and APIs
- **Example**: Email marketing agent that integrates with Mailchimp
- **How it works**: Wraps external APIs with standardized interfaces and error handling

#### 4. Orchestrator Agents
- **Purpose**: Coordinate and manage other agents
- **Example**: Project management agent that assigns tasks to other agents
- **How it works**: Manages workflows, dependencies, and agent coordination

### Why Agents Matter for Small Businesses
- **Automation**: Handle repetitive tasks without human intervention
- **Scalability**: Can work 24/7 and handle multiple tasks simultaneously
- **Specialization**: Each agent is an expert in its specific domain
- **Integration**: Work together seamlessly through standardized protocols
- **Cost-Effective**: Reduce need for human labor on routine tasks
- **Consistency**: Provide reliable, standardized results every time

### Agent Communication (A2A Protocol)
Agents communicate using the Agent-to-Agent (A2A) protocol, which ensures:
- **Standardized Messages**: All agents understand the same communication format
- **Reliable Delivery**: Messages are delivered and acknowledged properly
- **Error Handling**: Failed communications are detected and retried
- **Security**: Communications are authenticated and encrypted
- **Scalability**: New agents can easily join the network


## Risks and Mitigation
- **Content Overwhelm**: Mitigate with clear hierarchy and progressive disclosure
- **Technical Complexity**: Balance detail with accessibility
- **Maintenance Burden**: Admin handles all content updates through fork management
- **User Confusion**: Clear navigation and breadcrumbs
- **Demo Scope**: Keep focused on admin demo purposes, not production deployment

## Success Criteria
- Small business decision-makers can make informed decisions about AI adoption
- Users understand the complete offering, technology, and implementation process
- Technical information is accessible without losing accuracy or depth
- The resource builds trust through transparency and honesty about challenges
