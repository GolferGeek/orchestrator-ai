<template>
  <section id="what-we-built" class="what-we-built-section">
    <div class="landing-section">
      <!-- Section Header -->
      <div class="section-header">
        <h2>What We've Built So Far</h2>
        <p class="section-subtitle">
          Real AI workforce, not just chatbots. 39 specialized agents working together 
          with cutting-edge orchestration, real-time monitoring, and enterprise deployment.
        </p>
        <ion-button 
          fill="outline" 
          size="small" 
          class="view-video-button"
          @click="openVideoModal"
        >
          <ion-icon slot="start" :icon="playCircleOutline"></ion-icon>
          View Video
        </ion-button>
      </div>
      <!-- Feature Grid -->
      <div class="features-grid stagger-children" ref="featuresGrid">
        <!-- AI Workforce -->
        <div class="feature-card highlight animate-on-scroll">
          <div class="feature-icon">
            <ion-icon :icon="peopleOutline"></ion-icon>
          </div>
          <h3>39 Specialized AI Agents</h3>
          <p>Complete workforce across Marketing, Operations, Finance, HR, Engineering, Sales, Research, Legal, and Product departments.</p>
          <div class="feature-stats">
            <span class="stat">🏢 9 Departments</span>
            <span class="stat">🤖 39 Agents</span>
            <span class="stat">⚡ Real-Time</span>
          </div>
        </div>
        <!-- Orchestration -->
        <div class="feature-card animate-on-scroll">
          <div class="feature-icon">
            <ion-icon :icon="gitNetworkOutline"></ion-icon>
          </div>
          <h3>Hierarchical Orchestration</h3>
          <p>CEO orchestrator delegates to department managers. Intent recognition, multi-agent coordination, subproject management.</p>
          <div class="feature-demo">
            <div class="video-embed-small">
              <a 
                href="https://www.loom.com/share/debf7736e3104891aa8014b65fab9d2f?sid=a19c6e34-6a65-4b3a-affc-700b3869e7eb" 
                target="_blank" 
                rel="noopener noreferrer"
                class="video-placeholder-small"
              >
                <ion-icon :icon="playOutline"></ion-icon>
                <span>Project Orchestration Demo</span>
              </a>
            </div>
          </div>
        </div>
        <!-- Real-Time Everything -->
        <div class="feature-card animate-on-scroll">
          <div class="feature-icon">
            <ion-icon :icon="flashOutline"></ion-icon>
          </div>
          <h3>Real-Time Everything</h3>
          <p>WebSocket progress tracking, live task updates, interrupt/modify tasks, Human-in-the-Loop integration.</p>
          <div class="feature-list">
            <div class="feature-item">✓ Live Progress Tracking</div>
            <div class="feature-item">✓ Task Interruption</div>
            <div class="feature-item">✓ Human-in-Loop</div>
          </div>
        </div>
        <!-- SQL Generation -->
        <div class="feature-card highlight animate-on-scroll">
          <div class="feature-icon">
            <ion-icon :icon="analyticsOutline"></ion-icon>
          </div>
          <h3>Natural Language → SQL</h3>
          <p>Ask questions in plain English, get formatted data back. Our metrics agent generates and runs SQL queries automatically.</p>
          <div class="feature-demo">
            <div class="video-embed-small">
              <div class="video-placeholder-small">
                <ion-icon :icon="playOutline"></ion-icon>
                <span>SQL Generation Live Demo</span>
              </div>
            </div>
          </div>
        </div>
        <!-- Voice & Agent Builder -->
        <div class="feature-card animate-on-scroll">
          <div class="feature-icon">
            <ion-icon :icon="micOutline"></ion-icon>
          </div>
          <h3>Voice + Agent Builder</h3>
          <p>Speech-to-Text, Text-to-Speech, plus an AI agent that builds other context agents. Talk to create agents.</p>
          <div class="feature-demo">
            <div class="video-embed-small">
              <div class="video-placeholder-small">
                <ion-icon :icon="playOutline"></ion-icon>
                <span>Voice + Builder Demo</span>
              </div>
            </div>
          </div>
        </div>
        <!-- Deliverables System -->
        <div class="feature-card animate-on-scroll">
          <div class="feature-icon">
            <ion-icon :icon="documentOutline"></ion-icon>
          </div>
          <h3>Deliverables That Deliver</h3>
          <p>Auto-persistence, versioning, multiple formats (Markdown, JSON, HTML), searchable archive, automatic evaluation.</p>
          <div class="feature-list">
            <div class="feature-item">📄 Multi-Format Output</div>
            <div class="feature-item">🔍 Searchable Archive</div>
            <div class="feature-item">⭐ Auto Evaluation</div>
          </div>
        </div>
        <!-- LLM Experimentation -->
        <div class="feature-card animate-on-scroll">
          <div class="feature-icon">
            <ion-icon :icon="flaskOutline"></ion-icon>
          </div>
          <h3>Cost-Saving LLM Lab</h3>
          <p>Multi-model support (OpenAI, Anthropic, Google, Local Ollama), A/B testing, cost analysis, privacy-first local AI.</p>
          <div class="feature-stats">
            <span class="stat">🤖 6+ Models</span>
            <span class="stat">💰 Cost Tracking</span>
            <span class="stat">🔒 Local Privacy</span>
          </div>
        </div>
        <!-- On-Premise Deployment -->
        <div class="feature-card highlight animate-on-scroll">
          <div class="feature-icon">
            <ion-icon :icon="serverOutline"></ion-icon>
          </div>
          <h3>On-Premise Deployment</h3>
          <p>Your data stays on your servers. Docker containerization, one-command deployment, Ollama integration for complete privacy.</p>
          <div class="feature-demo">
            <div class="video-embed-small">
              <div class="video-placeholder-small">
                <ion-icon :icon="playOutline"></ion-icon>
                <span>Deployment in Real Time</span>
              </div>
            </div>
          </div>
        </div>
        <!-- MCP Integration (Coming Soon) -->
        <div class="feature-card coming-soon animate-on-scroll">
          <div class="feature-icon">
            <ion-icon :icon="linkOutline"></ion-icon>
          </div>
          <h3>MCP Integrations</h3>
          <p>Model Context Protocol connections to Notion, Google Docs, email systems. Connect your existing tools seamlessly.</p>
          <div class="coming-soon-badge glow-accent">
            <span>🚀 Coming End of August</span>
          </div>
        </div>
      </div>
      <!-- Agent Showcase Grid -->
      <div class="agent-showcase">
        <div class="showcase-header">
          <h3>Meet Your AI Workforce</h3>
          <p>39 specialized agents across 9 departments, ready to customize for your business</p>
        </div>
        <div class="department-grid">
          <!-- Marketing Department -->
          <div class="department-card animate-on-scroll">
            <div class="department-header">
              <div class="department-icon marketing">
                <ion-icon :icon="megaphoneOutline"></ion-icon>
              </div>
              <div class="department-info">
                <h4>Marketing</h4>
                <span class="agent-count">7 agents</span>
              </div>
            </div>
            <div class="agent-list">
              <span class="agent-tag">Content Creator</span>
              <span class="agent-tag">SEO Specialist</span>
              <span class="agent-tag">Social Media</span>
              <span class="agent-tag">Email Campaign</span>
              <span class="agent-tag demo">+3 more</span>
            </div>
          </div>
          <!-- Operations Department -->
          <div class="department-card animate-on-scroll">
            <div class="department-header">
              <div class="department-icon operations">
                <ion-icon :icon="settingsOutline"></ion-icon>
              </div>
              <div class="department-info">
                <h4>Operations</h4>
                <span class="agent-count">6 agents</span>
              </div>
            </div>
            <div class="agent-list">
              <span class="agent-tag">Process Optimizer</span>
              <span class="agent-tag">Quality Assurance</span>
              <span class="agent-tag">Workflow Manager</span>
              <span class="agent-tag demo">+3 more</span>
            </div>
          </div>
          <!-- Engineering Department -->
          <div class="department-card animate-on-scroll">
            <div class="department-header">
              <div class="department-icon engineering">
                <ion-icon :icon="codeSlashOutline"></ion-icon>
              </div>
              <div class="department-info">
                <h4>Engineering</h4>
                <span class="agent-count">5 agents</span>
              </div>
            </div>
            <div class="agent-list">
              <span class="agent-tag">Code Reviewer</span>
              <span class="agent-tag">Architecture</span>
              <span class="agent-tag">DevOps</span>
              <span class="agent-tag demo">+2 more</span>
            </div>
          </div>
          <!-- Finance Department -->
          <div class="department-card animate-on-scroll">
            <div class="department-header">
              <div class="department-icon finance">
                <ion-icon :icon="trendingUpOutline"></ion-icon>
              </div>
              <div class="department-info">
                <h4>Finance</h4>
                <span class="agent-count">4 agents</span>
              </div>
            </div>
            <div class="agent-list">
              <span class="agent-tag">Budget Analyst</span>
              <span class="agent-tag">Forecasting</span>
              <span class="agent-tag">Invoice Manager</span>
              <span class="agent-tag demo">+1 more</span>
            </div>
          </div>
          <!-- Sales Department -->
          <div class="department-card animate-on-scroll">
            <div class="department-header">
              <div class="department-icon sales">
                <ion-icon :icon="callOutline"></ion-icon>
              </div>
              <div class="department-info">
                <h4>Sales</h4>
                <span class="agent-count">4 agents</span>
              </div>
            </div>
            <div class="agent-list">
              <span class="agent-tag">Lead Qualifier</span>
              <span class="agent-tag">Proposal Writer</span>
              <span class="agent-tag">CRM Manager</span>
              <span class="agent-tag demo">+1 more</span>
            </div>
          </div>
          <!-- HR Department -->
          <div class="department-card animate-on-scroll">
            <div class="department-header">
              <div class="department-icon hr">
                <ion-icon :icon="peopleCircleOutline"></ion-icon>
              </div>
              <div class="department-info">
                <h4>Human Resources</h4>
                <span class="agent-count">4 agents</span>
              </div>
            </div>
            <div class="agent-list">
              <span class="agent-tag">Recruiter</span>
              <span class="agent-tag">Policy Writer</span>
              <span class="agent-tag">Training</span>
              <span class="agent-tag demo">+1 more</span>
            </div>
          </div>
          <!-- Research Department -->
          <div class="department-card animate-on-scroll">
            <div class="department-header">
              <div class="department-icon research">
                <ion-icon :icon="searchOutline"></ion-icon>
              </div>
              <div class="department-info">
                <h4>Research</h4>
                <span class="agent-count">4 agents</span>
              </div>
            </div>
            <div class="agent-list">
              <span class="agent-tag">Market Research</span>
              <span class="agent-tag">Competitive Intel</span>
              <span class="agent-tag">Data Analyst</span>
              <span class="agent-tag demo">+1 more</span>
            </div>
          </div>
          <!-- Product Department -->
          <div class="department-card animate-on-scroll">
            <div class="department-header">
              <div class="department-icon product">
                <ion-icon :icon="bulbOutline"></ion-icon>
              </div>
              <div class="department-info">
                <h4>Product</h4>
                <span class="agent-count">3 agents</span>
              </div>
            </div>
            <div class="agent-list">
              <span class="agent-tag">Product Manager</span>
              <span class="agent-tag">UX Researcher</span>
              <span class="agent-tag demo">+1 more</span>
            </div>
          </div>
          <!-- Legal Department -->
          <div class="department-card animate-on-scroll">
            <div class="department-header">
              <div class="department-icon legal">
                <ion-icon :icon="documentTextOutline"></ion-icon>
              </div>
              <div class="department-info">
                <h4>Legal</h4>
                <span class="agent-count">2 agents</span>
              </div>
            </div>
            <div class="agent-list">
              <span class="agent-tag">Contract Review</span>
              <span class="agent-tag">Compliance</span>
            </div>
          </div>
        </div>
        <div class="showcase-note">
          <p><strong>Demo Ready, Not Production Ready:</strong> Each agent needs customization and integration with your specific systems (email, CRM, databases) to work for your business. That's where we come in! 🚀</p>
        </div>
      </div>
      <!-- Bottom CTA -->
      <div class="section-cta">
        <h3>Ready to See It All Working?</h3>
        <p>These aren't just features on a roadmap. They're working right now.</p>
        <ion-button 
          size="large" 
          @click="$emit('scrollToPricing')"
          class="cta-button"
        >
          <ion-icon slot="start" :icon="rocketOutline"></ion-icon>
          Become a Founding Partner
        </ion-button>
      </div>
    </div>
  </section>
</template>
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { IonIcon, IonButton } from '@ionic/vue';
import { 
  peopleOutline, 
  gitNetworkOutline, 
  flashOutline, 
  analyticsOutline,
  micOutline,
  documentOutline,
  flaskOutline,
  serverOutline,
  linkOutline,
  playOutline,
  rocketOutline,
  megaphoneOutline,
  settingsOutline,
  codeSlashOutline,
  trendingUpOutline,
  callOutline,
  peopleCircleOutline,
  searchOutline,
  bulbOutline,
  documentTextOutline,
  playCircleOutline
} from 'ionicons/icons';
const featuresGrid = ref<HTMLElement>();
const emit = defineEmits<{
  scrollToPricing: [];
  openVideoModal: [videoId: string];
}>();

function openVideoModal() {
  // Emit event to parent to open video modal for "what-we-built" section
  emit('openVideoModal', 'what-we-built');
}
// Intersection Observer for scroll animations
let observer: IntersectionObserver | null = null;
onMounted(() => {
  // Set up intersection observer for scroll animations
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    }
  );
  // Observe all elements with animate-on-scroll class
  const animateElements = document.querySelectorAll('.animate-on-scroll');
  animateElements.forEach((el) => {
    if (observer) {
      observer.observe(el);
    }
  });
  // Add stagger animation to features grid after a slight delay
  setTimeout(() => {
    if (featuresGrid.value) {
      featuresGrid.value.classList.add('animate');
    }
  }, 300);
});
onUnmounted(() => {
  if (observer) {
    observer.disconnect();
  }
});
</script>
<style scoped>
.what-we-built-section {
  background: white;
  padding: 4rem 0;
}
.section-header {
  text-align: center;
  margin-bottom: 4rem;
}

.view-video-button {
  margin-top: 1rem;
  --color: var(--landing-primary);
  --border-color: var(--landing-primary);
  font-weight: 500;
}
.section-header h2 {
  font-size: 2.5rem;
  color: var(--landing-dark);
  margin-bottom: 1rem;
  font-weight: 700;
}
.section-subtitle {
  font-size: 1.2rem;
  color: #6b7280;
  max-width: 800px;
  margin: 0 auto;
  line-height: 1.6;
}
.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 2rem;
  margin-bottom: 4rem;
}
.feature-card {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  border: 2px solid #e5e7eb;
  transition: var(--transition-smooth);
  position: relative;
}
.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0,0,0,0.15);
  border-color: var(--landing-primary);
}
.feature-card.highlight {
  border-color: var(--landing-primary);
  background: linear-gradient(135deg, #f8faff, white);
}
.feature-card.coming-soon {
  border-color: var(--landing-accent);
  background: linear-gradient(135deg, #fffbf0, white);
  opacity: 0.9;
}
.feature-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  background: var(--landing-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
}
.feature-icon ion-icon {
  font-size: 1.8rem;
  color: white;
}
.feature-card h3 {
  font-size: 1.3rem;
  color: var(--landing-dark);
  margin-bottom: 0.75rem;
  font-weight: 600;
}
.feature-card p {
  color: #6b7280;
  line-height: 1.6;
  margin-bottom: 1.5rem;
}
.feature-stats {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.stat {
  background: var(--landing-light);
  color: var(--landing-primary);
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 500;
}
.feature-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.feature-item {
  color: var(--landing-secondary);
  font-size: 0.9rem;
  font-weight: 500;
}
.feature-demo {
  margin-top: 1rem;
}
.video-embed-small {
  border-radius: 8px;
  overflow: hidden;
}
.video-placeholder-small {
  background: linear-gradient(135deg, #f3f4f6, #e5e7eb);
  border: 1px dashed #d1d5db;
  padding: 1rem;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: var(--landing-primary);
  font-weight: 500;
  font-size: 0.85rem;
  cursor: pointer;
  transition: var(--transition-smooth);
  text-decoration: none;
}
.video-placeholder-small:hover {
  background: linear-gradient(135deg, #e5e7eb, #d1d5db);
}
.video-placeholder-small ion-icon {
  font-size: 1.2rem;
}
.coming-soon-badge {
  background: var(--landing-accent);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
  display: inline-block;
  margin-top: 1rem;
}
.section-cta {
  text-align: center;
  padding: 3rem 2rem;
  background: var(--landing-gradient);
  border-radius: 20px;
  color: white;
}
.section-cta h3 {
  font-size: 1.8rem;
  margin-bottom: 0.5rem;
}
.section-cta p {
  font-size: 1.1rem;
  margin-bottom: 2rem;
  opacity: 0.9;
}
.cta-button {
  --background: var(--landing-accent);
  --color: white;
  font-weight: 600;
  --border-radius: 8px;
}
/* Mobile responsive */
@media (max-width: 768px) {
  .features-grid {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  .feature-card {
    padding: 1.5rem;
  }
  .section-header h2 {
    font-size: 2rem;
  }
  .section-subtitle {
    font-size: 1rem;
  }
  .feature-stats {
    justify-content: center;
  }
}
/* Agent Showcase Styles */
.agent-showcase {
  margin: 4rem 0;
  padding: 3rem 0;
  background: var(--landing-primary-50);
  border-radius: 24px;
}
.showcase-header {
  text-align: center;
  margin-bottom: 3rem;
}
.showcase-header h3 {
  font-size: 2rem;
  color: var(--landing-dark);
  margin-bottom: 0.5rem;
  font-weight: 700;
}
.showcase-header p {
  font-size: 1.1rem;
  color: var(--landing-gray);
  max-width: 600px;
  margin: 0 auto;
}
.department-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
  padding: 0 2rem;
}
.department-card {
  background: var(--landing-white);
  border-radius: 16px;
  padding: 1.5rem;
  border: 2px solid transparent;
  transition: var(--transition-smooth);
  box-shadow: var(--shadow-sm);
}
.department-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
  border-color: var(--landing-secondary);
}
.department-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}
.department-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--landing-white);
}
.department-icon.marketing { background: linear-gradient(135deg, #f59e0b, #d97706); }
.department-icon.operations { background: linear-gradient(135deg, var(--landing-primary), var(--landing-primary-light)); }
.department-icon.engineering { background: linear-gradient(135deg, #6366f1, #8b5cf6); }
.department-icon.finance { background: linear-gradient(135deg, var(--landing-secondary), var(--landing-secondary-light)); }
.department-icon.sales { background: linear-gradient(135deg, #ef4444, #f87171); }
.department-icon.hr { background: linear-gradient(135deg, #8b5a3c, #a16c4a); }
.department-icon.research { background: linear-gradient(135deg, #06b6d4, #67e8f9); }
.department-icon.product { background: linear-gradient(135deg, #84cc16, #a3e635); }
.department-icon.legal { background: linear-gradient(135deg, #6b7280, #9ca3af); }
.department-icon ion-icon {
  font-size: 1.5rem;
}
.department-info h4 {
  font-size: 1.2rem;
  color: var(--landing-dark);
  margin: 0;
  font-weight: 600;
}
.agent-count {
  font-size: 0.9rem;
  color: var(--landing-gray);
  font-weight: 500;
}
.agent-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.agent-tag {
  background: var(--landing-primary-100);
  color: var(--landing-primary-dark);
  padding: 0.25rem 0.75rem;
  border-radius: 16px;
  font-size: 0.8rem;
  font-weight: 500;
  border: 1px solid var(--landing-primary-100);
  transition: var(--transition-smooth);
}
.agent-tag:hover {
  background: var(--landing-secondary-light);
  color: var(--landing-white);
  transform: translateY(-1px);
}
.agent-tag.demo {
  background: var(--landing-warning);
  color: var(--landing-white);
  font-weight: 600;
}
.showcase-note {
  text-align: center;
  padding: 2rem;
  background: var(--landing-white);
  border-radius: 16px;
  margin: 0 2rem;
  border: 2px solid var(--landing-secondary-light);
}
.showcase-note p {
  color: var(--landing-dark);
  font-size: 1rem;
  margin: 0;
  line-height: 1.6;
}
/* Mobile responsive for agent showcase */
@media (max-width: 768px) {
  .department-grid {
    grid-template-columns: 1fr;
    padding: 0 1rem;
  }
  .department-card {
    padding: 1.25rem;
  }
  .showcase-header h3 {
    font-size: 1.5rem;
  }
  .showcase-note {
    margin: 0 1rem;
    padding: 1.5rem;
  }
}
</style>
