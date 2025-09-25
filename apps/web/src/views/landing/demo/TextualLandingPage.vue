<template>
  <ion-page class="textual-landing-page">
    <!-- Landing Header (includes ViewToggle) -->
    <LandingHeader />
    
    <ion-content :fullscreen="true" class="textual-content">
      <!-- Page Title -->
      <div class="page-header">
        <div class="container">
          <h1 class="page-title">Technical Information</h1>
          <p class="page-subtitle">
            Comprehensive details about OrchestratorAI's offerings, technology, and implementation
          </p>
        </div>
      </div>

      <!-- Accordion Content -->
      <div class="accordion-container">
        <div class="container">
          <!-- Section 1: Small Business and AI -->
          <AccordionSection
            id="small-business-ai"
            title="Small Business and AI"
            :default-expanded="true"
          >
            <template #content>
              <p class="section-summary">
                Small businesses face overwhelming AI information, technical complexity above their expertise level, 
                security concerns, unclear ROI, and development challenges. OrchestratorAI addresses these by providing 
                clear guidance, accessible technology, robust privacy protection, transparent pricing with proven returns, 
                and complete implementation support.
              </p>
              
              <SubAccordion id="ai-fire-hose" title="AI as a Fire Hose">
                <p>The information overload problem that small businesses face when trying to understand AI.</p>
              </SubAccordion>
              
              <SubAccordion id="technical-complexity" title="Technical Complexity">
                <p>Why AI feels above small business pay grade and how we make it accessible.</p>
              </SubAccordion>
              
              <SubAccordion id="security-privacy" title="Security and Privacy">
                <p>Small business concerns with AI adoption and how we address them.</p>
              </SubAccordion>
              
              <SubAccordion id="cost-roi" title="Cost and ROI">
                <p>Financial considerations and return on investment for AI implementation.</p>
              </SubAccordion>
              
              <SubAccordion id="development-challenges" title="Development Challenges">
                <p>Technical implementation barriers and our solutions.</p>
              </SubAccordion>
            </template>
          </AccordionSection>

          <!-- Section 2: Our Offering -->
          <AccordionSection
            id="our-offering"
            title="Our Offering"
            :default-expanded="true"
          >
            <template #content>
              <p class="section-summary">
                We provide a complete AI implementation package including a piloting server (Mac Studio 128GB or equivalent), 
                our forked repository with starter agents, super cheap consulting ($120/hour for me, $50/hour for interns), 
                team building and training, and ongoing support. Setup starts at $15k with everything included - hardware, 
                software, training, and initial configuration.
              </p>
              
              <SubAccordion id="piloting-server" title="Piloting Server">
                <p>Hardware requirements and specifications for running local LLMs.</p>
              </SubAccordion>
              
              <SubAccordion id="forked-repository" title="Forked Repository">
                <p>Starter agents and customization options available in our repository.</p>
              </SubAccordion>
              
              <SubAccordion id="consulting-services" title="Consulting Services">
                <p>Setup, training, and ongoing support services we provide.</p>
              </SubAccordion>
              
              <SubAccordion id="pricing-structure" title="Pricing Structure">
                <p>$15k setup, $120/hour consulting, $50/hour interns - transparent pricing.</p>
              </SubAccordion>
              
              <SubAccordion id="team-building" title="Team Building">
                <p>AI group development and leadership training programs.</p>
              </SubAccordion>
            </template>
          </AccordionSection>

          <!-- Section 3: Agent Architecture -->
          <AccordionSection
            id="agent-architecture"
            title="Agent Architecture"
            :default-expanded="true"
          >
            <template #content>
              <p class="section-summary">
                Our system follows A2A (Agent-to-Agent) and MCP (Model Context Protocol) standards for reliable communication. 
                We offer four agent types: Context agents (knowledge-based), Function agents (TypeScript/Python), API agents 
                (external service wrappers), and Orchestrator agents (workflow coordination). Agents are organized in demo/ 
                and my-org/ directories, with file-based storage now and database-based agents coming soon for rapid creation.
              </p>
              
              <SubAccordion id="a2a-protocol" title="A2A Protocol">
                <p>Agent-to-Agent communication standards we follow.</p>
              </SubAccordion>
              
              <SubAccordion id="mcp-integration" title="MCP Integration">
                <p>Model Context Protocol implementation in our system.</p>
              </SubAccordion>
              
              <SubAccordion id="agent-types" title="Agent Types">
                <p>Context, Function (TypeScript/Python), API, and Orchestrator agents.</p>
              </SubAccordion>
              
              <SubAccordion id="file-vs-database-agents" title="File vs Database Agents">
                <p>Current and future agent storage approaches.</p>
              </SubAccordion>
              
              <SubAccordion id="demo-vs-myorg" title="Demo vs MyOrg">
                <p>Agent organization and customization structure.</p>
              </SubAccordion>
            </template>
          </AccordionSection>

          <!-- Section 4: What We're Working On -->
          <AccordionSection
            id="what-were-working-on"
            title="What We're Working On"
            :default-expanded="true"
          >
            <template #content>
              <p class="section-summary">
                We're building project orchestration for large-scale agent activity with human-in-the-loop evaluation, 
                AI versioning for content comparison and merging, multi-modal input handling for images and files, 
                database-based agents for rapid creation, and MCP tool integration so agents can use external tools. 
                Our goal is finely-tuned, single-purpose agents that work together seamlessly.
              </p>
              
              <SubAccordion id="project-orchestration" title="Project Orchestration">
                <p>Large-scale agent activity planning and coordination.</p>
              </SubAccordion>
              
              <SubAccordion id="human-in-the-loop" title="Human-in-the-Loop">
                <p>Evaluation and approval workflows for AI decisions.</p>
              </SubAccordion>
              
              <SubAccordion id="ai-versioning" title="AI Versioning">
                <p>Content comparison and merging capabilities.</p>
              </SubAccordion>
              
              <SubAccordion id="multi-modal-inputs" title="Multi-Modal Inputs">
                <p>Image and file processing capabilities.</p>
              </SubAccordion>
              
              <SubAccordion id="database-based-agents" title="Database-Based Agents">
                <p>Rapid agent creation and deployment system.</p>
              </SubAccordion>
              
              <SubAccordion id="mcp-tool-integration" title="MCP Tool Integration">
                <p>Agents using MCP tools for complex projects.</p>
              </SubAccordion>
            </template>
          </AccordionSection>

          <!-- Section 5: Technology Stack -->
          <AccordionSection
            id="technology-stack"
            title="Technology Stack"
            :default-expanded="true"
          >
            <template #content>
              <p class="section-summary">
                We use Vue.js with Ionic for the frontend, NestJS with Node.js for the backend, and Supabase with PostgreSQL 
                for data management. Development is done with Cursor, GitHub, and modern AI-assisted tools. We help clients 
                set up their development environment, understand fork management (why agents are in safe my-org/ directories), 
                and configure local LLM environments with MCP integration for testing and deployment.
              </p>
              
              <SubAccordion id="frontend-technology" title="Frontend Technology">
                <p>Vue.js, Ionic, TypeScript, and modern web technologies.</p>
              </SubAccordion>
              
              <SubAccordion id="backend-architecture" title="Backend Architecture">
                <p>NestJS, Node.js, and API design patterns.</p>
              </SubAccordion>
              
              <SubAccordion id="database-storage" title="Database & Storage">
                <p>Supabase, PostgreSQL, and data management.</p>
              </SubAccordion>
              
              <SubAccordion id="development-tools" title="Development Tools">
                <p>Cursor, GitHub, and modern development workflow.</p>
              </SubAccordion>
              
              <SubAccordion id="fork-management" title="Fork Management">
                <p>Understanding forks, updates, and safe agent development.</p>
              </SubAccordion>
              
              <SubAccordion id="ai-development-environment" title="AI Development Environment">
                <p>Local LLM setup, MCP integration, and testing.</p>
              </SubAccordion>
            </template>
          </AccordionSection>

          <!-- Section 6: Agent Building Process -->
          <AccordionSection
            id="agent-building-process"
            title="Agent Building Process"
            :default-expanded="true"
          >
            <template #content>
              <p class="section-summary">
                Agents are specialized AI programs that perform specific tasks autonomously. We provide rules files for each 
                agent type (Context, Function, API, Orchestrator) that guide AI-assisted development with Cursor, Claude, or 
                Codex. Our process includes understanding what agents are, using standardized rules files for consistent 
                development, leveraging AI tools for rapid creation, and building agents that communicate through A2A protocols 
                for seamless integration.
              </p>
              
              <SubAccordion id="what-are-agents" title="What Are Agents?">
                <p>Understanding AI agents and their capabilities.</p>
              </SubAccordion>
              
              <SubAccordion id="context-agent-builder" title="Context Agent Builder">
                <p>Building knowledge-based agents with rules files.</p>
              </SubAccordion>
              
              <SubAccordion id="function-agent-builder" title="Function Agent Builder">
                <p>Creating TypeScript and Python function agents.</p>
              </SubAccordion>
              
              <SubAccordion id="api-agent-builder" title="API Agent Builder">
                <p>Wrapping external APIs and services.</p>
              </SubAccordion>
              
              <SubAccordion id="orchestrator-agent-builder" title="Orchestrator Agent Builder">
                <p>Building coordination and workflow agents.</p>
              </SubAccordion>
              
              <SubAccordion id="rules-file-system" title="Rules File System">
                <p>Using Cursor rules for consistent agent development.</p>
              </SubAccordion>
              
              <SubAccordion id="ai-assisted-development" title="AI-Assisted Development">
                <p>Leveraging Cursor, Claude, and other AI tools.</p>
              </SubAccordion>
            </template>
          </AccordionSection>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { IonPage, IonContent } from '@ionic/vue';
import LandingHeader from '@/components/landing/LandingHeader.vue';
import AccordionSection from '@/components/landing/AccordionSection.vue';
import SubAccordion from '@/components/landing/SubAccordion.vue';
import { useViewToggle } from '@/composables/useViewToggle';

const { initializeViewMode } = useViewToggle();

onMounted(() => {
  // Initialize the view mode when the component mounts
  initializeViewMode();
});
</script>

<style scoped>
.textual-landing-page {
  --ion-background-color: var(--landing-light);
  --ion-text-color: var(--landing-dark);
}

.textual-content {
  --background: var(--landing-light);
  padding-top: 80px; /* Account for fixed header */
}

.page-header {
  background: linear-gradient(135deg, var(--landing-primary-50) 0%, var(--landing-accent-50) 100%);
  padding: 3rem 0;
  border-bottom: 1px solid rgba(139, 90, 60, 0.1);
}

.container {
  max-width: var(--container-max-width);
  margin: 0 auto;
  padding: 0 2rem;
}

.page-title {
  font-size: var(--text-4xl);
  font-weight: var(--font-weight-bold);
  color: var(--landing-primary);
  margin: 0 0 1rem 0;
  line-height: 1.2;
}

.page-subtitle {
  font-size: var(--text-lg);
  color: var(--landing-secondary);
  margin: 0;
  line-height: 1.5;
  max-width: 600px;
}

.accordion-container {
  padding: 2rem 0;
}

.section-summary {
  font-size: var(--text-base);
  line-height: 1.6;
  color: var(--landing-dark);
  margin: 0 0 1.5rem 0;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.7);
  border-radius: var(--radius-lg);
  border-left: 4px solid var(--landing-primary);
}

/* Mobile responsive */
@media (max-width: 768px) {
  .container {
    padding: 0 1rem;
  }
  
  .page-header {
    padding: 2rem 0;
  }
  
  .page-title {
    font-size: var(--text-3xl);
  }
  
  .page-subtitle {
    font-size: var(--text-base);
  }
  
  .accordion-container {
    padding: 1rem 0;
  }
}
</style>
