<template>
  <ion-page class="textual-landing-page">
    <!-- Landing Header (includes ViewToggle) -->
    <LandingHeader />
    
    <ion-content :fullscreen="true" class="textual-content">
      <!-- Page Title -->
      <div class="page-header">
        <div class="container">
          <h1 class="page-title">Without the Marketing Hype</h1>
          <p class="page-subtitle">
            Comprehensive details about OrchestratorAI's offerings, technology, and implementation
          </p>
          
          <!-- Demo Highlight Card -->
          <ion-card class="demo-highlight-box">
            <ion-card-header>
              <ion-card-title class="demo-highlight-title">
                🚀 Try the Full Demo Now!
              </ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <p class="demo-highlight-text">
                <strong>Jump right in:</strong> The demo environment is a <span class="highlight">fully functional system</span>—everything you see here (and in the videos) is live and ready for you to explore.
              </p>
              <ul class="demo-highlight-list">
                <li>Log in instantly with the provided demo credentials.</li>
                <li>All agents are active and ready—ask what they do, then try them out!</li>
                <li>Switch between LLM models to see real-time differences in performance.</li>
                <li>This is the exact system we deploy for you, inside your own infrastructure.</li>
              </ul>
              <p class="demo-highlight-text">
                <em>Experience OrchestratorAI hands-on—no waiting, no limitations.</em>
              </p>
            </ion-card-content>
          </ion-card>
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
              <!-- Small Business Challenge Card -->
              <ion-card class="challenge-highlight-box">
                <ion-card-header>
                  <ion-card-title class="challenge-highlight-title">
                    🎯 The Small Business AI Challenge
                  </ion-card-title>
                </ion-card-header>
                <ion-card-content>
                  <p class="challenge-highlight-text">
                    <strong>Small businesses face overwhelming choices when adopting AI.</strong> From information overload and decision fatigue 
                    to technical complexity and security concerns, the path to AI implementation is fraught with obstacles.
                  </p>
                  
                  <!-- Two Column Layout: Challenges + Videos -->
                  <div class="challenge-content-layout">
                    <!-- Left Column: Challenges List -->
                    <div class="challenges-column">
                      <ul class="challenge-highlight-list">
                        <li>Information overload from 10,000+ AI tools</li>
                        <li>Decision paralysis from conflicting advice</li>
                        <li>Technical barriers requiring expertise you don't have</li>
                        <li>Security and privacy concerns about data</li>
                        <li>Financial uncertainty around ROI and costs</li>
                        <li>Development challenges making DIY impractical</li>
                      </ul>
                      <p class="challenge-highlight-text">
                        <em>This section explores each challenge and shows how we eliminate them.</em>
                      </p>
                    </div>
                    
                    <!-- Right Column: Videos -->
                    <div class="videos-column">
                      <div class="challenge-videos-container">
                        <div class="video-with-label">
                          <p class="video-label">Introduction</p>
                          <VideoTrigger
                            v-if="introductionVideo"
                            :video="introductionVideo"
                            :hide-info="true"
                            @play="(video) => openVideoModal(video)"
                          />
                        </div>
                        <div class="video-with-label">
                          <p class="video-label">Client Challenges</p>
                          <VideoTrigger
                            v-if="clientChallengesVideo"
                            :video="clientChallengesVideo"
                            :hide-info="true"
                            @play="(video) => openVideoModal(video)"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </ion-card-content>
              </ion-card>

              <SubAccordion id="ai-fire-hose" title="AI as a Fire Hose">
                
                <ion-card class="information-overload-card">
                  <ion-card-content>
                    <h3 class="info-overload-title">🌊 Information Overload Challenge</h3>
                    
                    <p class="info-overload-intro">
                      <strong>Nothing but promises and marketing-- and 99% directed at large companies.</strong>
                    </p>
                    
                    <div class="overload-content-layout">
                      <div class="challenge-column">
                        <h4>What You're Up Against</h4>
                        <ul class="challenge-list">
                          <li><strong>10,000+ AI tools</strong> available today</li>
                          <li><strong>New tools launched daily</strong> - impossible to keep up</li>
                          <li><strong>Conflicting reviews</strong> - every tool claims to be "the best"</li>
                          <li><strong>Technical complexity</strong> - most require technical expertise</li>
                          <li><strong>Integration challenges</strong> - tools don't work together</li>
                        </ul>
                      </div>
                      
                      <div class="solution-column">
                        <h4>Our Approach</h4>
                        <ul class="solution-list">
                          <li><strong>Unique Small Business Focused</strong> - simple now and will grow with you</li>
                          <li><strong>Complete package</strong> - everything you need in one place</li>
                          <li><strong>Already working</strong> - no long term setup</li>
                          <li><strong>Less expensive to implement and grow</strong> - our consulting is affordable</li>
                        </ul>
                      </div>
                    </div>
                  </ion-card-content>
                </ion-card>
              </SubAccordion>
              
              <SubAccordion id="security-privacy" title="Security and Privacy">
                <ion-card class="security-privacy-card">
                  <ion-card-content>
                    <h3 class="security-title">🔒 LLM Security & Privacy Concerns</h3>
                    
                    <p class="security-intro">
                      <strong>Most AI solutions expose your sensitive data to third-party servers and unknown security risks.</strong>
                    </p>
                    
                    <div class="security-content-layout">
                      <div class="risks-column">
                        <h4>Common Security Risks</h4>
                        <ul class="risks-list">
                          <li><strong>Data exposure</strong> - your conversations sent to external servers</li>
                          <li><strong>No data control</strong> - unclear where your information goes</li>
                          <li><strong>Compliance issues</strong> - GDPR, HIPAA, SOX violations</li>
                          <li><strong>Third-party breaches</strong> - you're at mercy of their security</li>
                          <li><strong>Model training</strong> - your data used to improve their models</li>
                          <li><strong>Vendor lock-in</strong> - dependent on external services</li>
                        </ul>
                      </div>
                      
                      <div class="protection-column">
                        <h4>Our Security-First Approach</h4>
                        <ul class="protection-list">
                          <li><strong>Local deployment</strong> - your data never leaves your premises</li>
                          <li><strong>Complete control</strong> - you own and control everything</li>
                          <li><strong>Compliance ready</strong> - meets enterprise security standards</li>
                          <li><strong>No external dependencies</strong> - defaults to offline</li>
                          <li><strong>Private models</strong> - your conversations stay private</li>
                          <li><strong>Audit trail</strong> - full visibility into all AI interactions</li>
                        </ul>
                      </div>
                    </div>
                  </ion-card-content>
                </ion-card>
              </SubAccordion>
              
              <SubAccordion id="cost-roi" title="Cost and ROI">
                <ion-card class="cost-roi-card">
                  <ion-card-content>
                    <h3 class="cost-title">💰 Financial Uncertainty & Hidden Costs</h3>
                    
                    <p class="cost-intro">
                      <strong>Most AI implementations come with unpredictable costs and unclear ROI timelines.</strong>
                    </p>
                    
                    <div class="cost-content-layout">
                      <div class="cost-problems-column">
                        <h4>Typical Cost Problems</h4>
                        <ul class="cost-problems-list">
                          <li><strong>Hidden subscription fees</strong> - costs escalate with usage</li>
                          <li><strong>Per-user pricing</strong> - expensive as team grows</li>
                          <li><strong>API rate limits</strong> - throttling when you need it most</li>
                          <li><strong>Integration costs</strong> - expensive custom development</li>
                          <li><strong>Training expenses</strong> - months of learning curves</li>
                          <li><strong>Unclear ROI</strong> - no guarantee of returns</li>
                        </ul>
                      </div>
                      
                      <div class="cost-solution-column">
                        <h4>Our Transparent Pricing</h4>
                        <ul class="cost-solution-list">
                          <li><strong>Mostly local models</strong> - less cloud LLM costs</li>
                          <li><strong>No per-user fees</strong> - unlimited team access*</li>
                          <li><strong>No usage limits</strong> - run as much as you want</li>
                          <li><strong>Affordable consulting</strong> - $120/hr expert, $50/hr interns</li>
                          <li><strong>Fast implementation</strong> - working in days, not months</li>
                          <li><strong>Proven ROI</strong> - immediate productivity gains</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div class="cost-footnote">
                      <p>* Growing local LLM usage may require multiple servers or a more traditional server</p>
                    </div>
                  </ion-card-content>
                </ion-card>
              </SubAccordion>
              
              <SubAccordion id="development-challenges" title="Development Challenges">
                <ion-card class="development-challenges-card">
                  <ion-card-content>
                    <h3 class="development-title">⚙️ Development Barriers & Complexity</h3>
                    
                    <p class="development-intro">
                      <strong>Building AI solutions from scratch requires specialized expertise and months of development time.</strong>
                    </p>
                    
                    <div class="development-content-layout">
                      <div class="dev-challenges-column">
                        <h4>Development Barriers</h4>
                        <ul class="dev-challenges-list">
                          <li><strong>Technical expertise</strong> - need AI/ML specialists</li>
                          <li><strong>Infrastructure setup</strong> - complex server configurations</li>
                          <li><strong>Model integration</strong> - connecting different AI services</li>
                          <li><strong>Security implementation</strong> - building safe, compliant systems</li>
                          <li><strong>Testing & debugging</strong> - months of trial and error</li>
                          <li><strong>Maintenance overhead</strong> - ongoing updates and fixes</li>
                        </ul>
                      </div>
                      
                      <div class="dev-solution-column">
                        <h4>Our Pre-Built Solution</h4>
                        <ul class="dev-solution-list">
                          <li><strong>Ready to deploy</strong> - tested and production-ready</li>
                          <li><strong>Rapid implementation</strong> - coding required but we will help you</li>
                          <li><strong>Integrated agents</strong> - multiple AI capabilities included</li>
                          <li><strong>Security built-in</strong> - enterprise-grade from day one</li>
                          <li><strong>Proven reliability</strong> - battle-tested in real environments</li>
                          <li><strong>Ongoing support</strong> - we handle updates and maintenance</li>
                        </ul>
                      </div>
                    </div>
                  </ion-card-content>
                </ion-card>
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
                You provide a complete AI implementation package including a piloting server (Mac Studio 128GB or equivalent), 
                our forked repository with starter agents, super cheap consulting ($120/hour for me, $50/hour for interns), 
                team building and training, and ongoing support. Setup starts at $15k with everything included - hardware, 
                software, training, and initial configuration.
              </p>
              
              <!-- Privacy & Security Video -->
              <VideoTrigger 
                v-if="privacyVideo"
                :video="privacyVideo"
                @play="(video) => openVideoModal(video)"
              />
              
              <SubAccordion id="piloting-server" title="Piloting Server">
                <p>This section details our hardware solution for running AI locally. We'll cover the Mac Studio 128GB specifications, why local deployment matters for privacy and performance, and how this hardware choice eliminates cloud dependency and ongoing subscription costs.</p>
              </SubAccordion>
              
              <SubAccordion id="forked-repository" title="Forked Repository">
                <p>This section explores our pre-built agent ecosystem and customization capabilities. We'll showcase the starter agents we provide, explain how our forked repository gives you a head start, and detail the customization options that let you adapt the system to your specific business needs.</p>
              </SubAccordion>
              
              <SubAccordion id="consulting-services" title="Consulting Services">
                <p>This section outlines our comprehensive consulting approach, from initial setup through ongoing support. We'll explain our transparent pricing structure ($120/hour for senior consulting, $50/hour for intern support), detail the training and team building process, and describe how our ongoing support ensures long-term success.</p>
              </SubAccordion>
              
              <SubAccordion id="pricing-structure" title="Pricing Structure">
                <p>This section breaks down our transparent pricing model and value proposition. We'll detail what's included in the $15k setup cost, explain our consulting rate structure, and demonstrate how our pricing compares to traditional AI implementation costs while delivering better results.</p>
              </SubAccordion>
              
              <SubAccordion id="team-building" title="Team Building">
                <p>This section covers our team development and training programs. We'll explain how we help build AI competency within your organization, detail our leadership training approach, and describe how we create sustainable AI adoption that doesn't depend on external consultants long-term.</p>
                
                <!-- Collaboration Video -->
                <VideoTrigger 
                  v-if="collaborationVideo"
                  :video="collaborationVideo"
                  @play="(video) => openVideoModal(video)"
                />
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
              
              <!-- Agent Architecture Video -->
              <VideoTrigger 
                v-if="agentArchitectureVideo"
                :video="agentArchitectureVideo"
                @play="(video) => openVideoModal(video)"
              />
              
              <SubAccordion id="a2a-protocol" title="A2A Protocol">
                <p>This section explains our Agent-to-Agent communication framework. We'll cover the A2A standards we follow, detail our implementation approach, and demonstrate how this protocol ensures reliable, standardized communication between different AI agents in your system.</p>
                
                <SubSubAccordion id="a2a-standards" title="A2A Standards" :lazy-load="true">
                  <p>Detailed information about Agent-to-Agent communication protocols and standards.</p>
                </SubSubAccordion>
                
                <SubSubAccordion id="a2a-implementation" title="A2A Implementation">
                  <p>How we implement A2A protocols in our agent architecture.</p>
                </SubSubAccordion>
              </SubAccordion>
              
              <SubAccordion id="mcp-integration" title="MCP Integration">
                <p>This section covers our Model Context Protocol implementation. We'll explain how MCP enables seamless integration with external tools and services, detail our specific MCP configurations, and show how this protocol makes our agents more powerful and flexible.</p>
              </SubAccordion>
              
              <SubAccordion id="agent-types" title="Agent Types">
                <p>This section introduces our four specialized agent types and their capabilities. We'll explain Context agents for knowledge management, Function agents for custom logic, API agents for external integrations, and Orchestrator agents for workflow coordination, showing how each type serves specific business needs.</p>
              </SubAccordion>
              
              <SubAccordion id="file-vs-database-agents" title="File vs Database Agents">
                <p>This section explains our current file-based agent system and our upcoming database-based approach. We'll detail how file-based agents work today, explain the benefits of the upcoming database system for rapid agent creation, and show how this evolution will make agent management even more efficient.</p>
              </SubAccordion>
              
              <SubAccordion id="demo-vs-myorg" title="Demo vs MyOrg">
                <p>This section outlines our agent organization structure and customization approach. We'll explain the demo/ directory with pre-built agents, detail the my-org/ directory for your custom agents, and show how this structure allows you to start with proven solutions while building your own specialized agents.</p>
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
              
              <!-- Roadmap Video -->
              <VideoTrigger 
                v-if="roadmapVideo"
                :video="roadmapVideo"
                @play="(video) => openVideoModal(video)"
              />
              
              <SubAccordion id="project-orchestration" title="Project Orchestration">
                <p>This section explores our advanced project orchestration capabilities for managing large-scale agent activities. We'll explain how multiple agents can work together on complex projects, detail our coordination algorithms, and show how this system scales from simple tasks to enterprise-level operations.</p>
              </SubAccordion>
              
              <SubAccordion id="human-in-the-loop" title="Human-in-the-Loop">
                <p>This section covers our human-in-the-loop evaluation system that ensures AI decisions meet your standards. We'll explain how approval workflows work, detail the evaluation criteria, and show how this system maintains human oversight while maximizing AI efficiency.</p>
                
                <!-- Evaluations Video -->
                <VideoTrigger 
                  v-if="evaluationsVideo"
                  :video="evaluationsVideo"
                  @play="(video) => openVideoModal(video)"
                />
              </SubAccordion>
              
              <SubAccordion id="ai-versioning" title="AI Versioning">
                <p>This section details our AI versioning system for content comparison and merging. We'll explain how different AI outputs can be compared, detail our merging algorithms, and show how this system helps you track and improve AI performance over time.</p>
              </SubAccordion>
              
              <SubAccordion id="multi-modal-inputs" title="Multi-Modal Inputs">
                <p>This section covers our multi-modal input processing capabilities for images, files, and other data types. We'll explain how agents can process different input formats, detail our file handling capabilities, and show how this makes our system more versatile for real-world business applications.</p>
              </SubAccordion>
              
              <SubAccordion id="database-based-agents" title="Database-Based Agents">
                <p>This section explains our upcoming database-based agent system for rapid creation and deployment. We'll detail how this system will streamline agent development, explain the benefits over file-based agents, and show how it will enable faster customization and deployment of new agents.</p>
              </SubAccordion>
              
              <SubAccordion id="mcp-tool-integration" title="MCP Tool Integration">
                <p>This section covers our MCP tool integration capabilities that enable agents to use external tools for complex projects. We'll explain how agents can access external APIs and services, detail our tool management system, and show how this integration expands the capabilities of individual agents.</p>
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
                <p>This section details our frontend technology stack and its benefits for small businesses. We'll explain why we chose Vue.js with Ionic, detail our TypeScript implementation, and show how this modern stack provides a responsive, maintainable user interface that works across all devices.</p>
              </SubAccordion>
              
              <SubAccordion id="backend-architecture" title="Backend Architecture">
                <p>This section covers our backend architecture built on NestJS and Node.js. We'll explain our API design patterns, detail how our modular architecture supports agent communication, and show how this robust backend ensures reliable performance and easy maintenance.</p>
              </SubAccordion>
              
              <SubAccordion id="database-storage" title="Database & Storage">
                <p>This section explains our database and storage solution using Supabase and PostgreSQL. We'll detail how this setup provides reliable data management, explain our data security measures, and show how this foundation supports all agent operations and user data.</p>
              </SubAccordion>
              
              <SubAccordion id="development-tools" title="Development Tools">
                <p>This section covers our modern development tools and workflow that we help clients set up. We'll explain our Cursor and GitHub integration, detail our AI-assisted development approach, and show how these tools accelerate development while maintaining code quality.</p>
              </SubAccordion>
              
              <SubAccordion id="fork-management" title="Fork Management">
                <p>This section explains our fork management strategy and why agents are organized in safe my-org/ directories. We'll detail how fork updates work, explain our safe development practices, and show how this approach protects your custom agents while keeping you updated with improvements.</p>
              </SubAccordion>
              
              <SubAccordion id="ai-development-environment" title="AI Development Environment">
                <p>This section covers our AI development environment setup and configuration. We'll explain how to configure local LLM environments, detail our MCP integration for testing, and show how this setup enables rapid agent development and deployment in your own secure environment.</p>
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
                <p>This section provides a comprehensive introduction to AI agents and their capabilities. We'll explain what makes an agent different from simple AI tools, detail how agents work autonomously, and show how specialized agents can transform your business operations.</p>
              </SubAccordion>
              
              <SubAccordion id="context-agent-builder" title="Context Agent Builder">
                <p>This section covers our Context Agent Builder for creating knowledge-based agents. We'll explain how to use our standardized rules files, detail the knowledge management capabilities, and show how these agents can become your business's AI-powered knowledge base.</p>
                
                <!-- Context Agent Architecture Video -->
                <VideoTrigger 
                  v-if="contextAgentVideo"
                  :video="contextAgentVideo"
                  @play="(video) => openVideoModal(video)"
                />
              </SubAccordion>
              
              <SubAccordion id="function-agent-builder" title="Function Agent Builder">
                <p>This section details our Function Agent Builder for creating custom logic agents in TypeScript and Python. We'll explain how to build agents that execute specific functions, detail our development rules and patterns, and show how these agents can automate complex business processes.</p>
              </SubAccordion>
              
              <SubAccordion id="api-agent-builder" title="API Agent Builder">
                <p>This section covers our API Agent Builder for wrapping external APIs and services. We'll explain how to create agents that integrate with third-party services, detail our API management patterns, and show how these agents can extend your system's capabilities with external tools and data.</p>
              </SubAccordion>
              
              <SubAccordion id="orchestrator-agent-builder" title="Orchestrator Agent Builder">
                <p>This section details our Orchestrator Agent Builder for creating coordination and workflow agents. We'll explain how to build agents that manage complex workflows, detail our coordination patterns, and show how these agents can orchestrate multiple other agents to accomplish sophisticated business processes.</p>
              </SubAccordion>
              
              <SubAccordion id="rules-file-system" title="Rules File System">
                <p>This section explains our rules file system for consistent agent development. We'll detail how our standardized rules files work with Cursor, Claude, and Codex, explain the development patterns we follow, and show how this system ensures consistent, high-quality agent development across all types.</p>
              </SubAccordion>
              
              <SubAccordion id="ai-assisted-development" title="AI-Assisted Development">
                <p>This section covers our AI-assisted development approach using Cursor, Claude, and other AI tools. We'll explain how these tools accelerate agent development, detail our development workflow, and show how AI assistance makes agent creation accessible to non-technical team members while maintaining high code quality.</p>
              </SubAccordion>
            </template>
          </AccordionSection>
        </div>
      </div>
    </ion-content>
    
    <!-- Video Modal -->
    <VideoModal 
      :is-open="isVideoModalOpen"
      :video-title="currentVideo?.title || ''"
      :video-description="currentVideo?.description || ''"
      :video-url="currentVideo?.url"
      @close="closeVideoModal"
    />
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { IonPage, IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent } from '@ionic/vue';
import LandingHeader from '@/components/landing/LandingHeader.vue';
import AccordionSection from '@/components/landing/AccordionSection.vue';
import SubAccordion from '@/components/landing/SubAccordion.vue';
import SubSubAccordion from '@/components/landing/SubSubAccordion.vue';
import VideoModal from '@/components/landing/VideoModal.vue';
import VideoTrigger from '@/components/landing/VideoTrigger.vue';
import { useViewToggle } from '@/composables/useViewToggle';
import { videoService, type Video } from '@/services/videoService';

const { initializeViewMode } = useViewToggle();

// Video modal state
const isVideoModalOpen = ref(false);
const currentVideo = ref<Video | null>(null);

// Get videos for different sections
const introductionVideo = videoService.getVideoById('intro-main')?.video;
const clientChallengesVideo = videoService.getVideoById('client-challenges')?.video;
const privacyVideo = videoService.getVideoById('privacy-main')?.video;
const collaborationVideo = videoService.getVideoById('collaboration-main')?.video;
const evaluationsVideo = videoService.getVideoById('evaluations-main')?.video;
const roadmapVideo = videoService.getVideoById('roadmap-main')?.video;
const agentArchitectureVideo = videoService.getVideoById('agent-architecture-main')?.video;
const contextAgentVideo = videoService.getVideoById('context-agent-architecture')?.video;

// Video functions
function openVideoModal(video: Video) {
  currentVideo.value = video;
  isVideoModalOpen.value = true;
}

function closeVideoModal() {
  isVideoModalOpen.value = false;
  currentVideo.value = null;
}

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
  padding-top: 180px; /* Account for fixed header - increased to handle layout issues */
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

.demo-highlight-box {
  margin: 1rem 0;
  --background: rgba(255, 255, 255, 0.95);
  --color: var(--landing-dark);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(139, 90, 60, 0.2);
}

.challenge-highlight-box {
  margin: 1rem 0;
  --background: rgba(255, 255, 255, 0.95);
  --color: var(--landing-dark);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(220, 38, 38, 0.2);
}

.information-overload-card {
  margin: 1rem 0;
  --background: rgba(255, 255, 255, 0.95);
  --color: var(--landing-dark);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(249, 115, 22, 0.2);
}

.security-privacy-card {
  margin: 1rem 0;
  --background: rgba(255, 255, 255, 0.95);
  --color: var(--landing-dark);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.cost-roi-card {
  margin: 1rem 0;
  --background: rgba(255, 255, 255, 0.95);
  --color: var(--landing-dark);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(168, 85, 247, 0.2);
}

.development-challenges-card {
  margin: 1rem 0;
  --background: rgba(255, 255, 255, 0.95);
  --color: var(--landing-dark);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.demo-highlight-title {
  font-size: 1.75rem;
  font-weight: var(--font-weight-bold);
  color: var(--landing-primary);
  text-align: center;
  margin: 0;
}

.challenge-highlight-title {
  font-size: 1.75rem;
  font-weight: var(--font-weight-bold);
  color: #dc2626;
  text-align: center;
  margin: 0;
}

.info-overload-title {
  font-size: 1.75rem;
  font-weight: var(--font-weight-bold);
  color: #f97316;
  text-align: center;
  margin: 0;
}

.security-title {
  font-size: 1.75rem;
  font-weight: var(--font-weight-bold);
  color: #22c55e;
  text-align: center;
  margin: 0;
}

.cost-title {
  font-size: 1.75rem;
  font-weight: var(--font-weight-bold);
  color: #a855f7;
  text-align: center;
  margin: 0;
}

.development-title {
  font-size: 1.75rem;
  font-weight: var(--font-weight-bold);
  color: #3b82f6;
  text-align: center;
  margin: 0;
}

.info-overload-intro {
  font-size: var(--text-base);
  line-height: 1.5;
  color: var(--landing-dark);
  margin: 1rem 0;
  text-align: center;
}

.overload-content-layout {
  display: flex;
  gap: 2rem;
  margin-top: 1.5rem;
}

.challenge-column,
.solution-column {
  flex: 1;
}

.challenge-list,
.solution-list {
  list-style: none;
  padding: 0;
  margin: 1rem 0;
}

.challenge-list li,
.solution-list li {
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  font-size: var(--text-sm);
  line-height: 1.4;
}

.challenge-list li:last-child,
.solution-list li:last-child {
  border-bottom: none;
}

.security-intro {
  font-size: var(--text-base);
  line-height: 1.5;
  color: var(--landing-dark);
  margin: 1rem 0;
  text-align: center;
}

.security-content-layout {
  display: flex;
  gap: 2rem;
  margin-top: 1.5rem;
}

.risks-column,
.protection-column {
  flex: 1;
}

.risks-list,
.protection-list {
  list-style: none;
  padding: 0;
  margin: 1rem 0;
}

.risks-list li,
.protection-list li {
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  font-size: var(--text-sm);
  line-height: 1.4;
}

.risks-list li:last-child,
.protection-list li:last-child {
  border-bottom: none;
}

.cost-intro {
  font-size: var(--text-base);
  line-height: 1.5;
  color: var(--landing-dark);
  margin: 1rem 0;
  text-align: center;
}

.cost-content-layout {
  display: flex;
  gap: 2rem;
  margin-top: 1.5rem;
}

.cost-problems-column,
.cost-solution-column {
  flex: 1;
}

.cost-problems-list,
.cost-solution-list {
  list-style: none;
  padding: 0;
  margin: 1rem 0;
}

.cost-problems-list li,
.cost-solution-list li {
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  font-size: var(--text-sm);
  line-height: 1.4;
}

.cost-problems-list li:last-child,
.cost-solution-list li:last-child {
  border-bottom: none;
}

.cost-footnote {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.cost-footnote p {
  font-size: var(--text-xs);
  color: var(--ion-color-medium);
  margin: 0;
  text-align: center;
  font-style: italic;
}

.development-intro {
  font-size: var(--text-base);
  line-height: 1.5;
  color: var(--landing-dark);
  margin: 1rem 0;
  text-align: center;
}

.development-content-layout {
  display: flex;
  gap: 2rem;
  margin-top: 1.5rem;
}

.dev-challenges-column,
.dev-solution-column {
  flex: 1;
}

.dev-challenges-list,
.dev-solution-list {
  list-style: none;
  padding: 0;
  margin: 1rem 0;
}

.dev-challenges-list li,
.dev-solution-list li {
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  font-size: var(--text-sm);
  line-height: 1.4;
}

.dev-challenges-list li:last-child,
.dev-solution-list li:last-child {
  border-bottom: none;
}

.demo-highlight-text {
  font-size: var(--text-base);
  line-height: 1.5;
  color: var(--landing-dark);
  margin: 0.75rem 0;
  text-align: center;
}

.challenge-highlight-text {
  font-size: var(--text-base);
  line-height: 1.5;
  color: var(--landing-dark);
  margin: 0.75rem 0;
  text-align: center;
}

.demo-highlight-list {
  list-style: none;
  padding: 0;
  margin: 1rem 0;
  text-align: left;
  display: inline-block;
}

.demo-highlight-list li {
  padding: 0.25rem 0;
  position: relative;
  padding-left: 1.5rem;
  color: var(--landing-dark);
}

.demo-highlight-list li::before {
  content: "✓";
  position: absolute;
  left: 0;
  color: var(--landing-primary);
  font-weight: bold;
}

.challenge-highlight-list {
  list-style: none;
  padding: 0;
  margin: 1rem 0;
  text-align: left;
  display: inline-block;
}

.challenge-highlight-list li {
  padding: 0.25rem 0;
  position: relative;
  padding-left: 1.5rem;
  color: var(--landing-dark);
}

.challenge-highlight-list li::before {
  content: "⚠";
  position: absolute;
  left: 0;
  color: #dc2626;
  font-weight: bold;
}

.challenge-content-layout {
  display: flex;
  gap: 2rem;
  margin-top: 1.5rem;
  align-items: flex-start;
}

.challenges-column {
  flex: 1;
}

.videos-column {
  flex: 0 0 300px;
  text-align: center;
}


.challenge-videos-container {
  display: flex;
  flex-direction: row;
  gap: 1rem;
  justify-content: center;
}

.video-with-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.video-label {
  font-size: var(--text-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--landing-primary);
  margin: 0;
  text-align: center;
}

.highlight {
  background: linear-gradient(120deg, var(--landing-accent-50) 0%, var(--landing-primary-50) 100%);
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-weight: 600;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .textual-content {
    padding-top: 160px; /* Adjust for smaller mobile header - increased to handle layout issues */
  }
  
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
  
  .demo-highlight-box {
    margin: 0.5rem 0;
  }
  
  .demo-highlight-title {
    font-size: 1.5rem;
  }
  
  .demo-highlight-list {
    text-align: center;
  }
  
  .challenge-highlight-box {
    margin: 0.5rem 0;
  }
  
  .challenge-highlight-title {
    font-size: 1.5rem;
  }
  
  .challenge-highlight-list {
    text-align: center;
  }
  
  .challenge-content-layout {
    flex-direction: column;
    gap: 1.5rem;
    margin-top: 1rem;
  }
  
  .videos-column {
    flex: none;
    order: -1; /* Move videos to top on mobile */
  }
  
  .challenge-videos-container {
    flex-direction: row;
    gap: 0.5rem;
    justify-content: center;
  }
  
  .video-with-label {
    gap: 0.125rem;
  }
  
  .video-label {
    font-size: 0.75rem;
  }
  
  .overload-content-layout {
    flex-direction: column;
    gap: 1.5rem;
  }
  
  .challenge-column,
  .solution-column {
    flex: none;
  }
  
  .security-content-layout {
    flex-direction: column;
    gap: 1.5rem;
  }
  
  .risks-column,
  .protection-column {
    flex: none;
  }
  
  .cost-content-layout {
    flex-direction: column;
    gap: 1.5rem;
  }
  
  .cost-problems-column,
  .cost-solution-column {
    flex: none;
  }
  
  .development-content-layout {
    flex-direction: column;
    gap: 1.5rem;
  }
  
  .dev-challenges-column,
  .dev-solution-column {
    flex: none;
  }
}
</style>
