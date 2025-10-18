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
              <!-- Small Business Challenge Card -->
              
                <h3 class="challenge-highlight-title">
                  🎯 The Small Business AI Challenge
                </h3>
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
              

              <SubAccordion id="ai-fire-hose" title="AI as a Fire Hose">
                
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
                  
              </SubAccordion>
              
              <SubAccordion id="security-privacy" title="Security and Privacy">
                
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
                  
              </SubAccordion>
              
              <SubAccordion id="cost-roi" title="Cost and ROI">
                
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
                  
              </SubAccordion>
              
              <SubAccordion id="development-challenges" title="Development Challenges">
                
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
              
                  <h3 class="offering-summary-title">🚀 Complete AI Implementation Package</h3>
                  
                  <p class="offering-summary-intro">
                    <strong>Everything you need to deploy AI successfully - we help you set up your hardware, software, training, and ongoing support.</strong>
                  </p>
                  
                  <div class="offering-summary-layout">
                    <div class="package-includes-column">
                      <h4>Complete Solution</h4>
                      <ul class="package-includes-list">
                        <li><strong>Forked codebase ($15k)</strong> - pre-built starter agents</li>
                        <li><strong>Hardware consultation</strong> - help select and configure server</li>
                        <li><strong>Installation & setup</strong> - get your system running</li>
                        <li><strong>LLM API setup</strong> - help configure your API keys</li>
                        <li><strong>Team training</strong> - build internal AI competency</li>
                        <li><strong>Expert consulting</strong> - $120/hr senior, $50/hr interns</li>
                        <li><strong>Ongoing support</strong> - transparent hourly rates</li>
                      </ul>
                    </div>
                    
                    <div class="package-video-column">
              <!-- Privacy & Security Video -->
                      <div class="video-with-label">
                        <p class="video-label">Privacy & Security</p>
              <VideoTrigger 
                v-if="privacyVideo"
                :video="privacyVideo"
                          :hide-info="true"
                @play="(video) => openVideoModal(video)"
              />
                      </div>
                    </div>
                  </div>
                  
                  <div class="offering-summary-footer">
                    <p><strong>Forked code: $15k</strong> - consulting fees additional at $120/hr senior, $50/hr interns<br>
                    <small>*You provide: hardware and LLM API keys (we help with setup)</small></p>
                  </div>
              
              
              <SubAccordion id="piloting-server" title="Piloting Server">
                
                    <h3 class="piloting-title">🖥️ Your Local AI Hardware Setup*</h3>
                    
                    <p class="piloting-intro">
                      <strong>We help you configure powerful local hardware that eliminates cloud dependency and ensures complete data privacy.</strong>
                    </p>
                    
                    <div class="piloting-content-layout">
                      <div class="hardware-specs-column">
                        <h4>Mac Studio 128GB Specifications</h4>
                        <ul class="hardware-specs-list">
                          <li><strong>M2 Ultra chip</strong> - 24-core CPU, 76-core GPU</li>
                          <li><strong>128GB unified memory</strong> - handles large AI models</li>
                          <li><strong>8TB SSD storage</strong> - fast model loading and data processing</li>
                          <li><strong>Multiple ports</strong> - extensive connectivity options</li>
                          <li><strong>Quiet operation</strong> - office-friendly design</li>
                          <li><strong>Energy efficient</strong> - lower operating costs</li>
                        </ul>
                      </div>
                      
                      <div class="local-benefits-column">
                        <h4>Local Deployment Benefits</h4>
                        <ul class="local-benefits-list">
                          <li><strong>Complete privacy</strong> - data never leaves your premises</li>
                          <li><strong>No cloud costs</strong> - eliminate ongoing subscription fees</li>
                          <li><strong>Consistent performance</strong> - no internet dependency</li>
                          <li><strong>Instant response</strong> - no network latency</li>
                          <li><strong>Full control</strong> - customize and configure as needed</li>
                          <li><strong>Compliance ready</strong> - meets enterprise security standards</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div class="piloting-footnote">
                      <p>* You provide the server hardware. We recommend Mac Studio 128GB, but any equivalent hardware is fine.</p>
                    </div>
                  
              </SubAccordion>
              
              <SubAccordion id="forked-repository" title="Forked Repository">
                
                    <h3 class="repository-title">📦 Pre-Built Agent Ecosystem</h3>
                    
                    <p class="repository-intro">
                      <strong>Skip months of development with our battle-tested agent repository and starter templates.</strong>
                    </p>
                    
                    <div class="repository-content-layout">
                      <div class="starter-agents-column">
                        <h4>Included Starter Agents</h4>
                        <ul class="starter-agents-list">
                          <li><strong>Content creation</strong> - blog posts, social media, marketing</li>
                          <li><strong>Data analysis</strong> - reports, insights, visualizations</li>
                          <li><strong>Customer service</strong> - support tickets, FAQ responses</li>
                          <li><strong>Code assistance</strong> - documentation, reviews, debugging</li>
                          <li><strong>Research & summarization</strong> - market analysis, competitive intel</li>
                          <li><strong>Workflow automation</strong> - task management, notifications</li>
                        </ul>
                      </div>
                      
                      <div class="customization-column">
                        <h4>Customization Capabilities</h4>
                        <ul class="customization-list">
                          <li><strong>Industry-specific templates</strong> - tailored to your business</li>
                          <li><strong>Custom agent creation</strong> - build new capabilities</li>
                          <li><strong>Privacy and security</strong> - enterprise-grade data protection</li>
                          <li><strong>User-evaluation</strong> - feedback and performance tracking</li>
                          <li><strong>Local-LLM-centric</strong> - optimized for on-premises models</li>
                          <li><strong>Integration options</strong> - connect to your existing tools</li>
                          <li><strong>Workflow configuration</strong> - adapt to your processes</li>
                          <li><strong>Brand customization</strong> - match your company voice</li>
                          <li><strong>Performance tuning</strong> - optimize for your use cases</li>
                        </ul>
                      </div>
                    </div>
                  
              </SubAccordion>
              
              <SubAccordion id="consulting-services" title="Consulting Services">
                
                    <h3 class="consulting-title">🤝 Expert Guidance & Support</h3>
                    
                    <p class="consulting-intro">
                      <strong>Comprehensive consulting from setup to success - transparent pricing, expert guidance, long-term partnership.</strong>
                    </p>
                    
                    <div class="consulting-content-layout">
                      <div class="consulting-approach-column">
                        <h4>Our Consulting Approach</h4>
                        <ul class="consulting-approach-list">
                          <li><strong>Initial assessment</strong> - understand your specific needs</li>
                          <li><strong>Custom implementation</strong> - tailored to your workflows</li>
                          <li><strong>Team training</strong> - build internal AI competency</li>
                          <li><strong>Change management</strong> - smooth adoption process</li>
                          <li><strong>Performance optimization</strong> - continuous improvement</li>
                          <li><strong>Ongoing support</strong> - we're with you long-term</li>
                        </ul>
                      </div>
                      
                      <div class="pricing-support-column">
                        <h4>Transparent Pricing & Support</h4>
                        <ul class="pricing-support-list">
                          <li><strong>Senior consulting</strong> - $120/hour expert guidance</li>
                          <li><strong>Intern support</strong> - $50/hour for routine tasks</li>
                          <li><strong>No hidden fees</strong> - clear, upfront pricing</li>
                          <li><strong>Flexible engagement</strong> - scale support as needed</li>
                          <li><strong>Knowledge transfer</strong> - build your team's capabilities</li>
                          <li><strong>Success metrics</strong> - measure and optimize ROI</li>
                        </ul>
                      </div>
                    </div>
                  
              </SubAccordion>
              
              <SubAccordion id="pricing-structure" title="Pricing Structure">
                
                    <h3 class="pricing-structure-title">💎 Transparent Value Proposition</h3>
                    
                    <p class="pricing-structure-intro">
                      <strong>Clear, upfront pricing with exceptional value - no surprises, no hidden costs, just results.</strong>
                    </p>
                    
                    <div class="pricing-structure-content-layout">
                      <div class="setup-cost-column">
                        <h4>$15k Forked Code Package</h4>
                        <ul class="setup-cost-list">
                          <li><strong>Pre-built agent repository</strong> - battle-tested codebase</li>
                          <li><strong>Starter agent templates</strong> - ready-to-customize</li>
                          <li><strong>Integration frameworks</strong> - connect to your systems</li>
                          <li><strong>Security implementations</strong> - enterprise-grade built-in</li>
                          <li><strong>Documentation & guides</strong> - comprehensive setup instructions</li>
                          <li><strong>License & updates</strong> - ongoing code improvements</li>
                        </ul>
                      </div>
                      
                      <div class="value-comparison-column">
                        <h4>Consulting & Implementation</h4>
                        <ul class="value-comparison-list">
                          <li><strong>Senior consulting</strong> - $120/hr for expert guidance</li>
                          <li><strong>Intern support</strong> - $50/hr for routine tasks</li>
                          <li><strong>Hardware consultation</strong> - help select and configure</li>
                          <li><strong>Installation & setup</strong> - get system running</li>
                          <li><strong>API key configuration</strong> - help set up your LLM accounts</li>
                          <li><strong>Team training</strong> - build internal competency</li>
                          <li><strong>Ongoing support</strong> - transparent hourly rates</li>
                        </ul>
                      </div>
                    </div>
                  
              </SubAccordion>
              
              <SubAccordion id="team-building" title="Team Building">
                
                    <h3 class="team-building-title">👥 AI Competency Development</h3>
                    
                    <p class="team-building-intro">
                      <strong>Build lasting AI expertise within your organization - sustainable adoption that reduces external dependency.</strong>
                    </p>
                    
                    <div class="team-building-content-layout">
                      <div class="training-programs-column">
                        <h4>Training Programs</h4>
                        <ul class="training-programs-list">
                          <li><strong>Leadership training</strong> - AI strategy and decision-making</li>
                          <li><strong>Technical training</strong> - hands-on system management</li>
                          <li><strong>User adoption</strong> - effective AI tool utilization</li>
                          <li><strong>Best practices</strong> - workflow optimization techniques</li>
                          <li><strong>Troubleshooting</strong> - common issues and solutions</li>
                          <li><strong>Advanced features</strong> - unlock full system potential</li>
                        </ul>
                      </div>
                      
                      <div class="sustainability-column">
                        <h4>Sustainable AI Adoption</h4>
                        <ul class="sustainability-list">
                          <li><strong>Internal champions</strong> - develop AI advocates</li>
                          <li><strong>Knowledge transfer</strong> - reduce consultant dependency</li>
                          <li><strong>Documentation</strong> - comprehensive internal guides</li>
                          <li><strong>Change management</strong> - smooth organizational transition</li>
                          <li><strong>Performance metrics</strong> - measure success and ROI</li>
                          <li><strong>Continuous improvement</strong> - evolve with your needs</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div class="team-building-video-section">
                      <div class="video-with-label">
                        <p class="video-label">Team Collaboration</p>
                <VideoTrigger 
                  v-if="collaborationVideo"
                  :video="collaborationVideo"
                          :hide-info="true"
                  @play="(video) => openVideoModal(video)"
                />
                      </div>
                    </div>
                  
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
              
                  <h3 class="architecture-summary-title">🏗️ Advanced Agent Architecture</h3>
                  
                  <p class="architecture-summary-intro">
                    <strong>Standards-based agent system with A2A and MCP protocols for reliable, scalable AI communication.</strong>
                  </p>
                  
                  <div class="architecture-summary-layout">
                    <div class="agent-types-column">
                      <h4>Agent Types</h4>
                      <ul class="agent-types-list">
                        <li><strong>Context agents</strong> - knowledge-based intelligence</li>
                        <li><strong>Function agents</strong> - TypeScript/Python logic</li>
                        <li><strong>API agents</strong> - external service wrappers</li>
                        <li><strong>External agents</strong> - A2A communication with outside systems</li>
                        <li><strong>Orchestrator agents</strong> - workflow coordination</li>
                      </ul>
                    </div>
                    
                    <div class="organization-column">
                      <h4>Organization Structure</h4>
                      <ul class="organization-list">
                        <li><strong>demo/</strong> - example agents and templates</li>
                        <li><strong>my-org/</strong> - your custom business agents</li>
                        <li><strong>saas/</strong> - shared agents for small companies</li>
                        <li><strong>A2A protocol</strong> - standardized communication</li>
                        <li><strong>MCP integration</strong> - external tool connectivity</li>
                      </ul>
                    </div>
                    
                    <div class="architecture-video-column">
              <!-- Agent Architecture Video -->
                      <div class="video-with-label">
                        <p class="video-label">Agent Architecture</p>
              <VideoTrigger 
                v-if="agentArchitectureVideo"
                :video="agentArchitectureVideo"
                          :hide-info="true"
                @play="(video) => openVideoModal(video)"
              />
                      </div>
                    </div>
                  </div>
                  
                  <div class="architecture-summary-footer">
                    <p><strong>File-based storage now</strong> - database-based agents coming soon for rapid creation</p>
                  </div>
              
              
              <SubAccordion id="a2a-protocol" title="A2A Protocol">
                
                    <h3 class="a2a-title">🔗 Industry-Standard Communication</h3>
                    
                    <p class="a2a-intro">
                      <strong>Your AI system speaks the same language as other modern AI systems - keeping you current as the industry grows.</strong>
                    </p>
                    
                    <div class="a2a-content-layout">
                      <div class="a2a-standards-column">
                        <h4>Why Standards Matter</h4>
                        <ul class="a2a-standards-list">
                          <li><strong>Future-proof investment</strong> - won't become obsolete</li>
                          <li><strong>Industry compatibility</strong> - works with other modern AI systems</li>
                          <li><strong>Easy expansion</strong> - add new capabilities as they emerge</li>
                          <li><strong>Vendor independence</strong> - not locked into one provider</li>
                          <li><strong>Reliable operation</strong> - built on proven communication methods</li>
                          <li><strong>Professional credibility</strong> - enterprise-grade standards</li>
                        </ul>
                      </div>
                      
                      <div class="a2a-implementation-column">
                        <h4>Business Benefits</h4>
                        <ul class="a2a-implementation-list">
                          <li><strong>Connect with partners</strong> - communicate with other businesses' AI</li>
                          <li><strong>Stay competitive</strong> - use the same standards as large companies</li>
                          <li><strong>Easy growth</strong> - add new AI capabilities without starting over</li>
                          <li><strong>Industry evolution</strong> - automatically compatible with new developments</li>
                          <li><strong>Investment protection</strong> - system grows with the industry</li>
                          <li><strong>Professional integration</strong> - seamlessly work with client systems</li>
                        </ul>
                      </div>
                    </div>
                  
              </SubAccordion>
              
              <SubAccordion id="mcp-integration" title="MCP Integration">
                
                    <h3 class="mcp-title">🔌 Connect to Any Tool or Service</h3>
                    
                    <p class="mcp-intro">
                      <strong>MCP protocol lets your AI agents work with the tools you already use - no complex integrations required.</strong>
                    </p>
                    
                    <div class="mcp-content-layout">
                      <div class="mcp-capabilities-column">
                        <h4>What MCP Enables</h4>
                        <ul class="mcp-capabilities-list">
                          <li><strong>Database connections</strong> - read and update your business data</li>
                          <li><strong>File system access</strong> - work with documents and files</li>
                          <li><strong>Web services</strong> - connect to online tools and APIs</li>
                          <li><strong>Business applications</strong> - integrate with CRM, accounting, etc.</li>
                          <li><strong>Development tools</strong> - automate coding and deployment</li>
                          <li><strong>Custom workflows</strong> - connect any tool that supports MCP</li>
                        </ul>
                      </div>
                      
                      <div class="mcp-benefits-column">
                        <h4>Business Benefits</h4>
                        <ul class="mcp-benefits-list">
                          <li><strong>Use existing tools</strong> - no need to replace what works</li>
                          <li><strong>Seamless integration</strong> - AI works with your current workflow</li>
                          <li><strong>Expand capabilities</strong> - add new tools as your business grows</li>
                          <li><strong>Reduce manual work</strong> - automate tasks across multiple systems</li>
                          <li><strong>Industry standard</strong> - works with tools from major vendors</li>
                          <li><strong>Future-ready</strong> - new tools automatically compatible</li>
                        </ul>
                      </div>
                    </div>
                  
              </SubAccordion>
              
              <SubAccordion id="agent-types" title="Agent Types">
                
                    <h3 class="agent-types-title">🤖 Five Specialized AI Agent Types</h3>
                    
                    <p class="agent-types-intro">
                      <strong>Each agent type is designed for specific business tasks - from knowledge management to workflow coordination.</strong>
                    </p>
                    
                    <div class="agent-types-content-layout">
                      <div class="agent-descriptions-column">
                        <h4>Agent Capabilities</h4>
                        <ul class="agent-descriptions-list">
                          <li><strong>Context agents</strong> - your business knowledge base and expertise</li>
                          <li><strong>Function agents</strong> - custom business logic and calculations</li>
                          <li><strong>API agents</strong> - connect to external services and data</li>
                          <li><strong>External agents</strong> - communicate with other businesses' AI</li>
                          <li><strong>Orchestrator agents</strong> - coordinate complex workflows</li>
                        </ul>
                      </div>
                      
                      <div class="agent-use-cases-column">
                        <h4>Business Applications</h4>
                        <ul class="agent-use-cases-list">
                          <li><strong>Knowledge management</strong> - instant access to company expertise</li>
                          <li><strong>Process automation</strong> - handle routine business tasks</li>
                          <li><strong>Data integration</strong> - pull information from multiple sources</li>
                          <li><strong>Partner collaboration</strong> - work with client and vendor systems</li>
                          <li><strong>Workflow management</strong> - orchestrate multi-step processes</li>
                        </ul>
                      </div>
                    </div>
                  
              </SubAccordion>
              
              <SubAccordion id="file-vs-database-agents" title="File vs Database Agents">
                
                    <h3 class="file-database-title">📁 Current System + Future Upgrades</h3>
                    
                    <p class="file-database-intro">
                      <strong>Start with our proven file-based system today, upgrade to rapid database creation when ready.</strong>
                    </p>
                    
                    <div class="file-database-content-layout">
                      <div class="current-system-column">
                        <h4>Current File-Based System</h4>
                        <ul class="current-system-list">
                          <li><strong>Proven and reliable</strong> - battle-tested in production</li>
                          <li><strong>Version controlled</strong> - track all changes with Git</li>
                          <li><strong>Easy to understand</strong> - simple file structure</li>
                          <li><strong>Customizable</strong> - modify agents to fit your needs</li>
                          <li><strong>Portable</strong> - move agents between environments</li>
                          <li><strong>Transparent</strong> - see exactly how agents work</li>
                        </ul>
                      </div>
                      
                      <div class="future-system-column">
                        <h4>Upcoming Database System</h4>
                        <ul class="future-system-list">
                          <li><strong>Rapid creation</strong> - build new agents in minutes</li>
                          <li><strong>Dynamic updates</strong> - modify agents without downtime</li>
                          <li><strong>Advanced management</strong> - sophisticated agent controls</li>
                          <li><strong>Performance optimization</strong> - faster agent responses</li>
                          <li><strong>Scalability</strong> - handle hundreds of agents easily</li>
                          <li><strong>Smooth migration</strong> - upgrade when you're ready</li>
                        </ul>
                      </div>
                    </div>
                  
              </SubAccordion>
              
              <SubAccordion id="demo-vs-myorg" title="Demo vs MyOrg">
                
                    <h3 class="demo-myorg-title">🏢 Organized Agent Directories</h3>
                    
                    <p class="demo-myorg-intro">
                      <strong>Start with proven demo agents, then build your own custom business agents in separate directories.</strong>
                    </p>
                    
                    <div class="demo-myorg-content-layout">
                      <div class="demo-directory-column">
                        <h4>Demo/ Directory</h4>
                        <ul class="demo-directory-list">
                          <li><strong>Pre-built agents</strong> - ready-to-use examples</li>
                          <li><strong>Best practices</strong> - learn from proven patterns</li>
                          <li><strong>Quick start</strong> - get results immediately</li>
                          <li><strong>Training materials</strong> - understand how agents work</li>
                          <li><strong>Safe to experiment</strong> - modify without risk</li>
                          <li><strong>Regular updates</strong> - new examples added over time</li>
                        </ul>
                      </div>
                      
                      <div class="myorg-directory-column">
                        <h4>My-Org/ Directory</h4>
                        <ul class="myorg-directory-list">
                          <li><strong>Your custom agents</strong> - built for your specific needs</li>
                          <li><strong>Business-specific</strong> - tailored to your industry</li>
                          <li><strong>Private and secure</strong> - your proprietary logic</li>
                          <li><strong>Full control</strong> - modify and extend as needed</li>
                          <li><strong>Gradual development</strong> - build at your own pace</li>
                          <li><strong>Professional deployment</strong> - production-ready agents</li>
                        </ul>
                      </div>
                    </div>
                  
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
                <p><strong>Coordinate many specialized agents to deliver predictable outcomes.</strong> Our orchestrator agents plan multi-step initiatives using A2A standards—assigning tasks, handling dependencies, tracking progress, and retrying failures with clear metrics. Start with a single workflow and scale to dozens of agents collaborating across content, data, and integration tasks.</p>
                <ul class="mcp-benefits-list">
                  <li><strong>Deterministic workflows</strong> - consistent plans, explicit steps, observable state</li>
                  <li><strong>Dependency management</strong> - ordered execution, guardrails, graceful retries</li>
                  <li><strong>Metrics & logs</strong> - measure throughput, quality, and time-to-complete</li>
                  <li><strong>Composable patterns</strong> - reuse flows across teams and clients</li>
                </ul>
              </SubAccordion>
              
              <SubAccordion id="human-in-the-loop" title="Human-in-the-Loop">
                <p><strong>Keep humans in control where it matters.</strong> We add approval checkpoints, evaluation rubrics, and audit trails to critical steps. Review diffs, score outputs, and approve or request changes—backed by privacy-first design and compliance-friendly records.</p>
                
                <!-- Evaluations Video -->
                <VideoTrigger 
                  v-if="evaluationsVideo"
                  :video="evaluationsVideo"
                  @play="(video) => openVideoModal(video)"
                />
                <ul class="mcp-benefits-list">
                  <li><strong>Approval gates</strong> - block release until stakeholders sign off</li>
                  <li><strong>Standardized rubrics</strong> - objective quality checks by use case</li>
                  <li><strong>Auditability</strong> - full history of decisions and rationale</li>
                  <li><strong>Rollback</strong> - revert to prior versions when needed</li>
                </ul>
              </SubAccordion>
              
              <SubAccordion id="ai-versioning" title="AI Versioning">
                <p><strong>Run variants, compare results, and merge the best.</strong> Generate multiple candidate outputs, view side-by-side diffs, and accept, cherry-pick, or merge changes with provenance preserved. Version history helps teams learn what prompts, agents, or tools produce the strongest outcomes.</p>
                <ul class="mcp-benefits-list">
                  <li><strong>Multi-variant runs</strong> - explore quality vs. cost tradeoffs</li>
                  <li><strong>Structured comparison</strong> - highlight factual and stylistic differences</li>
                  <li><strong>Provenance</strong> - track model, prompt, and toolchain per output</li>
                  <li><strong>Continuous improvement</strong> - iterate intentionally over time</li>
                </ul>
              </SubAccordion>
              
              <SubAccordion id="multi-modal-inputs" title="Multi-Modal Inputs">
                <p><strong>Handle real files and images safely.</strong> Using MCP resources, agents ingest PDFs, images, and office docs for OCR, summarization, and structured extraction. Our PII pseudonymization workflow (see project scripts) protects sensitive data end-to-end.</p>
                <ul class="mcp-benefits-list">
                  <li><strong>File ingestion</strong> - MCP file system and storage integration</li>
                  <li><strong>Structured extraction</strong> - turn documents into actionable data</li>
                  <li><strong>PII controls</strong> - pseudonymize on intake; reversible with policy</li>
                  <li><strong>Business-ready</strong> - route outputs to agents, APIs, or databases</li>
                </ul>
              </SubAccordion>
              
              <SubAccordion id="database-based-agents" title="Database-Based Agents">
                <p><strong>From files to a managed registry.</strong> We’re introducing a Supabase/Postgres-backed catalog for agents and capabilities. Create agents in minutes, manage per-tenant configuration, and roll out updates safely—while keeping today’s file-based agents fully supported.</p>
                <ul class="mcp-benefits-list">
                  <li><strong>Rapid creation</strong> - scaffold, configure, and publish quickly</li>
                  <li><strong>Central management</strong> - visibility across environments and tenants</li>
                  <li><strong>Safer updates</strong> - staged releases with rollback</li>
                  <li><strong>Scale</strong> - operate hundreds of agents consistently</li>
                </ul>
              </SubAccordion>
              
              <SubAccordion id="mcp-tool-integration" title="MCP Tool Integration">
                <p><strong>Connect to the tools you already use.</strong> MCP provides a standard way for agents to access databases, file systems, web APIs, and developer tools with least-privilege credentials and auditable access—future-proofing your integrations.</p>
                <ul class="mcp-benefits-list">
                  <li><strong>Standards-first</strong> - portable across vendors and models</li>
                  <li><strong>Security-minded</strong> - scoped keys, explicit permissions</li>
                  <li><strong>Extensible</strong> - add new tools without re-architecting</li>
                  <li><strong>Operational clarity</strong> - observable calls and outcomes</li>
                </ul>
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
                <p><strong>Vue 3 + Ionic + TypeScript for fast, mobile-ready UI.</strong> We use componentized SFCs, Pinia for state where needed, and Vite for rapid builds. The result is a responsive, maintainable interface that adapts across devices.</p>
                <ul class="mcp-benefits-list">
                  <li><strong>Reusable components</strong> - consistent UX and faster delivery</li>
                  <li><strong>Type safety</strong> - clearer contracts and fewer runtime bugs</li>
                  <li><strong>Great performance</strong> - modern tooling and tree-shaking</li>
                  <li><strong>Testing support</strong> - aligned with repo test patterns</li>
                </ul>
              </SubAccordion>
              
              <SubAccordion id="backend-architecture" title="Backend Architecture">
                <p><strong>NestJS + Node.js with clear module boundaries.</strong> Our backend supports A2A/MCP workflows, structured APIs, Supabase auth, and streaming where applicable. Modules stay small, typed, and testable.</p>
                <ul class="mcp-benefits-list">
                  <li><strong>Reliability</strong> - predictable services with explicit contracts</li>
                  <li><strong>Maintainability</strong> - modular design and shared utilities</li>
                  <li><strong>Scalability</strong> - horizontal growth with simple patterns</li>
                  <li><strong>Security</strong> - explicit config validation; no silent defaults</li>
                </ul>
              </SubAccordion>
              
              <SubAccordion id="database-storage" title="Database & Storage">
                <p><strong>Supabase/Postgres for durable data and assets.</strong> We model tasks, evaluations, and agent metadata in relational tables, and use storage for files. Backups, migrations, and access policies are standard practice.</p>
                <ul class="mcp-benefits-list">
                  <li><strong>Durability</strong> - ACID guarantees and automated backups</li>
                  <li><strong>Query power</strong> - analytics and reporting without exports</li>
                  <li><strong>Access control</strong> - role-based rules for safer operations</li>
                  <li><strong>Operational clarity</strong> - schema you can reason about</li>
                </ul>
              </SubAccordion>
              
              <SubAccordion id="development-tools" title="Development Tools">
                <p><strong>Cursor + GitHub with pnpm/Turborepo.</strong> We follow strict linting/formatting, leverage AI-assisted workflows, and provide PM2 and deployment scripts for smooth releases.</p>
                <ul class="mcp-benefits-list">
                  <li><strong>Faster iteration</strong> - tight inner loop and code reviews</li>
                  <li><strong>Consistency</strong> - enforced standards and rules files</li>
                  <li><strong>Observability</strong> - scripts for testing and diagnostics</li>
                  <li><strong>Repeatable deploys</strong> - proven production runbooks</li>
                </ul>
              </SubAccordion>
              
              <SubAccordion id="fork-management" title="Fork Management">
                <p><strong>Safe customization without losing upstream improvements.</strong> Keep your business-specific agents in `my-org/` while `demo/` provides patterns and updates. Pull new features without overwriting your custom work.</p>
                <ul class="mcp-benefits-list">
                  <li><strong>Isolation</strong> - protect proprietary logic and prompts</li>
                  <li><strong>Upgradability</strong> - adopt upstream changes on your schedule</li>
                  <li><strong>Clarity</strong> - clear boundaries between templates and custom code</li>
                  <li><strong>Team velocity</strong> - experiment safely without regressions</li>
                </ul>
              </SubAccordion>
              
              <SubAccordion id="ai-development-environment" title="AI Development Environment">
                <p><strong>Local LLMs with MCP for privacy-first development.</strong> Use the provided Ollama scripts, `.env` patterns, and Supabase setup to run agents entirely on your hardware—keeping sensitive data in-house.</p>
                <ul class="mcp-benefits-list">
                  <li><strong>Data control</strong> - keep conversations and files local</li>
                  <li><strong>Lower cost</strong> - reduce cloud inference spend</li>
                  <li><strong>Better testing</strong> - deterministic environments for QA</li>
                  <li><strong>Compliance</strong> - align with security requirements by default</li>
                </ul>
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
                <p><strong>Single-responsibility programs that collaborate.</strong> Agents specialize—Context, Function, API, External, and Orchestrator—and communicate through A2A. Clear roles and typed interfaces make systems more reliable and adaptable.</p>
                <ul class="mcp-benefits-list">
                  <li><strong>Composability</strong> - assemble complex workflows from small parts</li>
                  <li><strong>Clarity</strong> - explicit responsibilities and contracts</li>
                  <li><strong>Reliability</strong> - fewer side effects and easier testing</li>
                  <li><strong>Evolution</strong> - upgrade one agent without breaking others</li>
                </ul>
              </SubAccordion>
              
              <SubAccordion id="context-agent-builder" title="Context Agent Builder">
                <p><strong>Turn your knowledge into a reliable agent.</strong> Use `markdown_context/` with persona, key facts, capabilities/limits, and examples. Follow our size and structure guidelines for predictable answers.</p>
                <ul class="mcp-benefits-list">
                  <li><strong>Fast capture</strong> - add domain expertise in markdown</li>
                  <li><strong>Consistency</strong> - standardized format yields stable outputs</li>
                  <li><strong>Safety</strong> - scope capabilities and disclose limitations</li>
                  <li><strong>Maintainability</strong> - update docs, not code, to improve answers</li>
                </ul>
                
                <!-- Context Agent Architecture Video -->
                <VideoTrigger 
                  v-if="contextAgentVideo"
                  :video="contextAgentVideo"
                  @play="(video) => openVideoModal(video)"
                />
              </SubAccordion>
              
              <SubAccordion id="function-agent-builder" title="Function Agent Builder">
                <p><strong>TypeScript/Python logic with explicit contracts.</strong> Define clear inputs/outputs and validate configuration up-front. Follow our “No Fallbacks & Hardcoded Defaults” rule: fail fast with actionable errors.</p>
                <ul class="mcp-benefits-list">
                  <li><strong>Correctness</strong> - typed interfaces and early validation</li>
                  <li><strong>Testability</strong> - unit tests around pure functions</li>
                  <li><strong>Safety</strong> - meaningful error messages instead of silent defaults</li>
                  <li><strong>Reusability</strong> - small, focused modules</li>
                </ul>
              </SubAccordion>
              
              <SubAccordion id="api-agent-builder" title="API Agent Builder">
                <p><strong>Safe adapters for third-party services.</strong> Store secrets in `.env`, set explicit timeouts/retries, and expose a minimal surface area. Design for MCP so tools remain portable.</p>
                <ul class="mcp-benefits-list">
                  <li><strong>Predictable integrations</strong> - graceful failures and retries</li>
                  <li><strong>Credential hygiene</strong> - no hardcoded keys; scoped access</li>
                  <li><strong>Observability</strong> - structured logs around requests</li>
                  <li><strong>Portability</strong> - standards-first tool interfaces</li>
                </ul>
              </SubAccordion>
              
              <SubAccordion id="orchestrator-agent-builder" title="Orchestrator Agent Builder">
                <p><strong>Design workflows, not monoliths.</strong> Model steps, dependencies, and evaluation gates. Route work to specialized agents, gather results, and move forward only when checks pass.</p>
                <ul class="mcp-benefits-list">
                  <li><strong>Manage complexity</strong> - break work into verifiable stages</li>
                  <li><strong>Quality gates</strong> - human or automated evaluations</li>
                  <li><strong>Scalable patterns</strong> - reuse flows across projects</li>
                  <li><strong>Operational control</strong> - pause, resume, or rollback</li>
                </ul>
              </SubAccordion>
              
              <SubAccordion id="rules-file-system" title="Rules File System">
                <p><strong>Shared rules that encode best practices.</strong> Use the provided rules (Cursor profile and internal standards) to drive consistent prompts, configs, and code patterns—including explicit configuration validation and security notes.</p>
                <ul class="mcp-benefits-list">
                  <li><strong>Consistency</strong> - same patterns across teams and agents</li>
                  <li><strong>Fewer regressions</strong> - guardrails for common mistakes</li>
                  <li><strong>Faster onboarding</strong> - new contributors ship safely</li>
                  <li><strong>Traceability</strong> - decisions documented beside code</li>
                </ul>
              </SubAccordion>
              
              <SubAccordion id="ai-assisted-development" title="AI-Assisted Development">
                <p><strong>Plan → expand → implement → verify.</strong> Use Taskmaster to turn PRDs into tasks/subtasks, research when needed, log findings, and mark work done. Cursor and Claude speed implementation while our rules maintain quality.</p>
                <ul class="mcp-benefits-list">
                  <li><strong>Structured progress</strong> - clear next actions and status</li>
                  <li><strong>Higher quality</strong> - checklists and tests by default</li>
                  <li><strong>Team transparency</strong> - shared context and histories</li>
                  <li><strong>Faster delivery</strong> - AI accelerates routine work</li>
                </ul>
              </SubAccordion>
            </template>
          </AccordionSection>
        </div>
      </div>
    <!-- Footer -->
    <footer class="landing-footer">
      <div class="footer-content">
        <p>2025 – Orchestrator AI</p>
      </div>
    </footer>
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
import { IonPage, IonContent } from '@ionic/vue';
import LandingHeader from '@/components/landing/LandingHeader.vue';
import AccordionSection from '@/components/landing/AccordionSection.vue';
import SubAccordion from '@/components/landing/SubAccordion.vue';
import VideoModal from '@/components/landing/VideoModal.vue';
import VideoTrigger from '@/components/landing/VideoTrigger.vue';
import { useViewToggle } from '@/composables/useViewToggle';
import { videoService, type Video } from '@/services/videoService';
import { useRouter } from 'vue-router';

const { initializeViewMode } = useViewToggle();
const _router = useRouter();

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
  padding-top: 24px; /* Small breathing room under sticky header */
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

.piloting-footnote {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.piloting-footnote p {
  font-size: var(--text-xs);
  color: var(--ion-color-medium);
  margin: 0;
  text-align: center;
  font-style: italic;
}

/* Architecture summary card styles */
.architecture-summary-card {
  margin: 1rem 0;
  --background: rgba(255, 255, 255, 0.95);
  --color: var(--landing-dark);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.2);
}

.architecture-summary-title {
  font-size: 1.75rem;
  font-weight: var(--font-weight-bold);
  color: #6366f1;
  text-align: center;
  margin: 0;
}

.architecture-summary-intro {
  font-size: var(--text-base);
  line-height: 1.5;
  color: var(--landing-dark);
  margin: 1rem 0;
  text-align: center;
}

.architecture-summary-layout {
  display: flex;
  gap: 2rem;
  margin-top: 1.5rem;
}

.agent-types-column,
.organization-column,
.architecture-video-column {
  flex: 1;
}

.agent-types-list,
.organization-list {
  list-style: none;
  padding: 0;
  margin: 1rem 0;
}

.agent-types-list li,
.organization-list li {
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  font-size: var(--text-sm);
  line-height: 1.4;
}

.agent-types-list li:last-child,
.organization-list li:last-child {
  border-bottom: none;
}

.architecture-summary-footer {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  text-align: center;
}

.architecture-summary-footer p {
  font-size: var(--text-sm);
  color: var(--ion-color-medium);
  margin: 0;
  font-style: italic;
}

/* A2A Protocol card styles */
.a2a-protocol-card {
  margin: 1rem 0;
  --background: rgba(255, 255, 255, 0.95);
  --color: var(--landing-dark);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.a2a-title {
  font-size: 1.75rem;
  font-weight: var(--font-weight-bold);
  color: #10b981;
  text-align: center;
  margin: 0;
}

.a2a-intro {
  font-size: var(--text-base);
  line-height: 1.5;
  color: var(--landing-dark);
  margin: 1rem 0;
  text-align: center;
}

.a2a-content-layout {
  display: flex;
  gap: 2rem;
  margin-top: 1.5rem;
}

.a2a-standards-column,
.a2a-implementation-column {
  flex: 1;
}

.a2a-standards-list,
.a2a-implementation-list {
  list-style: none;
  padding: 0;
  margin: 1rem 0;
}

.a2a-standards-list li,
.a2a-implementation-list li {
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  font-size: var(--text-sm);
  line-height: 1.4;
}

.a2a-standards-list li:last-child,
.a2a-implementation-list li:last-child {
  border-bottom: none;
}

/* MCP Integration Card */
.mcp-integration-card {
  margin: 1rem 0;
  --background: rgba(255, 255, 255, 0.95);
  --color: var(--landing-dark);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(245, 101, 101, 0.2); /* Red border */
}

.mcp-title {
  font-size: 1.75rem;
  font-weight: var(--font-weight-bold);
  color: #f56565; /* Red color */
  text-align: center;
  margin: 0;
}

.mcp-intro {
  font-size: var(--text-base);
  line-height: 1.5;
  color: var(--landing-dark);
  margin: 1rem 0;
  text-align: center;
}

.mcp-content-layout {
  display: flex;
  gap: 2rem;
  margin-top: 1.5rem;
}

.mcp-capabilities-column,
.mcp-benefits-column {
  flex: 1;
}

.mcp-capabilities-list,
.mcp-benefits-list {
  list-style: none;
  padding: 0;
  margin: 1rem 0;
}

.mcp-capabilities-list li,
.mcp-benefits-list li {
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  font-size: var(--text-sm);
  line-height: 1.4;
}

.mcp-capabilities-list li:last-child,
.mcp-benefits-list li:last-child {
  border-bottom: none;
}

/* Agent Types Card */
.agent-types-card {
  margin: 1rem 0;
  --background: rgba(255, 255, 255, 0.95);
  --color: var(--landing-dark);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(72, 187, 120, 0.2); /* Green border */
}

.agent-types-title {
  font-size: 1.75rem;
  font-weight: var(--font-weight-bold);
  color: #48bb78; /* Green color */
  text-align: center;
  margin: 0;
}

.agent-types-intro {
  font-size: var(--text-base);
  line-height: 1.5;
  color: var(--landing-dark);
  margin: 1rem 0;
  text-align: center;
}

.agent-types-content-layout {
  display: flex;
  gap: 2rem;
  margin-top: 1.5rem;
}

.agent-descriptions-column,
.agent-use-cases-column {
  flex: 1;
}

.agent-descriptions-list,
.agent-use-cases-list {
  list-style: none;
  padding: 0;
  margin: 1rem 0;
}

.agent-descriptions-list li,
.agent-use-cases-list li {
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  font-size: var(--text-sm);
  line-height: 1.4;
}

.agent-descriptions-list li:last-child,
.agent-use-cases-list li:last-child {
  border-bottom: none;
}

/* File vs Database Agents Card */
.file-database-agents-card {
  margin: 1rem 0;
  --background: rgba(255, 255, 255, 0.95);
  --color: var(--landing-dark);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(102, 126, 234, 0.2); /* Blue border */
}

.file-database-title {
  font-size: 1.75rem;
  font-weight: var(--font-weight-bold);
  color: #667eea; /* Blue color */
  text-align: center;
  margin: 0;
}

.file-database-intro {
  font-size: var(--text-base);
  line-height: 1.5;
  color: var(--landing-dark);
  margin: 1rem 0;
  text-align: center;
}

.file-database-content-layout {
  display: flex;
  gap: 2rem;
  margin-top: 1.5rem;
}

.current-system-column,
.future-system-column {
  flex: 1;
}

.current-system-list,
.future-system-list {
  list-style: none;
  padding: 0;
  margin: 1rem 0;
}

.current-system-list li,
.future-system-list li {
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  font-size: var(--text-sm);
  line-height: 1.4;
}

.current-system-list li:last-child,
.future-system-list li:last-child {
  border-bottom: none;
}

/* Demo vs MyOrg Card */
.demo-myorg-card {
  margin: 1rem 0;
  --background: rgba(255, 255, 255, 0.95);
  --color: var(--landing-dark);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(237, 137, 54, 0.2); /* Orange border */
}

.demo-myorg-title {
  font-size: 1.75rem;
  font-weight: var(--font-weight-bold);
  color: #ed8936; /* Orange color */
  text-align: center;
  margin: 0;
}

.demo-myorg-intro {
  font-size: var(--text-base);
  line-height: 1.5;
  color: var(--landing-dark);
  margin: 1rem 0;
  text-align: center;
}

.demo-myorg-content-layout {
  display: flex;
  gap: 2rem;
  margin-top: 1.5rem;
}

.demo-directory-column,
.myorg-directory-column {
  flex: 1;
}

.demo-directory-list,
.myorg-directory-list {
  list-style: none;
  padding: 0;
  margin: 1rem 0;
}

.demo-directory-list li,
.myorg-directory-list li {
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  font-size: var(--text-sm);
  line-height: 1.4;
}

.demo-directory-list li:last-child,
.myorg-directory-list li:last-child {
  border-bottom: none;
}

  /* Unified heading styles across all accordion content */
  .challenge-highlight-title,
  .info-overload-title,
  .security-title,
  .cost-title,
  .development-title,
  .offering-summary-title,
  .piloting-title,
  .repository-title,
  .consulting-title,
  .pricing-structure-title,
  .team-building-title,
  .architecture-summary-title,
  .a2a-title,
  .mcp-title,
  .agent-types-title,
  .file-database-title,
  .demo-myorg-title {
    font-size: var(--text-2xl);
    font-weight: var(--font-weight-bold);
    color: var(--landing-primary);
    text-align: left;
    margin: 0 0 0.75rem 0;
    line-height: 1.3;
  }

  /* Consistent spacing for intro paragraphs under headings */
  .info-overload-intro,
  .security-intro,
  .cost-intro,
  .development-intro,
  .offering-summary-intro,
  .repository-intro,
  .consulting-intro,
  .pricing-structure-intro,
  .agent-types-intro,
  .file-database-intro,
  .demo-myorg-intro,
  .architecture-summary-intro {
    margin: 0.5rem 0 0;
    text-align: left;
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


.challenge-highlight-text {
  font-size: var(--text-base);
  line-height: 1.5;
  color: var(--landing-dark);
  margin: 0.75rem 0;
  text-align: center;
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

  /* Footer */
  .landing-footer {
    background: var(--landing-gradient);
    color: var(--landing-white);
    padding: var(--space-8) 0;
    text-align: center;
    margin-top: var(--space-16);
  }

  .footer-content {
    max-width: var(--container-max-width);
    margin: 0 auto;
    padding: 0 var(--space-8);
  }

  .footer-content p {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--landing-white);
    font-weight: var(--font-weight-medium);
  }

/* Mobile responsive */
@media (max-width: 768px) {
  .textual-content {
    padding-top: 16px; /* Mobile spacing under sticky header */
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
  
  .architecture-summary-layout {
    flex-direction: column;
    gap: 1.5rem;
  }
  
  .agent-types-column,
  .organization-column,
  .architecture-video-column {
    flex: none;
  }
  
  .architecture-video-column {
    order: -1; /* Move video to top on mobile */
  }
  
  .a2a-content-layout {
    flex-direction: column;
    gap: 1.5rem;
  }
  
  .a2a-standards-column,
  .a2a-implementation-column {
    flex: none;
  }

  /* New card mobile styles */
  .mcp-content-layout,
  .agent-types-content-layout,
  .file-database-content-layout,
  .demo-myorg-content-layout {
    flex-direction: column;
    gap: 1.5rem;
  }

  .mcp-capabilities-column, .mcp-benefits-column,
  .agent-descriptions-column, .agent-use-cases-column,
  .current-system-column, .future-system-column,
  .demo-directory-column, .myorg-directory-column {
    flex: none;
  }

    .landing-footer {
      padding: var(--space-6) 0;
      margin-top: var(--space-12);
    }

    .footer-content {
      padding: 0 var(--space-4);
    }
}
</style>
