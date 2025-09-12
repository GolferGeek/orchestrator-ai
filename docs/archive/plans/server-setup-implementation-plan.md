# Server Setup Implementation Plan

## Project Overview

Transform Orchestrator-AI into a comprehensive small business server solution with hybrid deployment architecture: development via npm scripts, production via Docker containers.

## Implementation Phases

### Phase 1: Foundation Infrastructure ✅ COMPLETED
**Timeline**: Week 1 (Days 1-7)
**Status**: Complete

#### Completed Tasks:
- [x] Created feature branch `feature/server-setup`
- [x] Developed comprehensive PRD document
- [x] Designed technical architecture
- [x] Created client deployment guide
- [x] Built Docker configuration files
- [x] Set up Ollama with gpt-oss:20b model

#### Deliverables Created:
- `docs/prd/small-business-server.md` - Product requirements document
- `docs/technical/server-architecture.md` - Technical architecture specification
- `docs/deployment/client-fork-guide.md` - Client deployment procedures
- `docker/development/` - Development environment containers
- `docker/production/` - Production deployment containers
- `templates/` - Environment configuration templates
- `scripts/dev-start.sh` - Development environment startup script

### Phase 2: Local Development Environment
**Timeline**: Week 1-2 (Days 8-10)
**Status**: Ready to Start

#### Tasks:
- [ ] Implement dual Supabase configuration in NestJS
- [ ] Update Supabase service to support mode switching
- [ ] Create migration scripts from cloud to local
- [ ] Test multi-database setup (orchestrator_ai, hierarchy_ai, demos)
- [ ] Configure Ollama integration in API
- [ ] Test development workflow with local services

#### Specific Implementation Steps:

##### 2.1 Supabase Configuration Updates
```typescript
// Update apps/api/src/supabase/supabase.config.ts
export default registerAs('supabase', () => {
  const mode = process.env.SUPABASE_MODE || 'cloud';
  
  if (mode === 'local') {
    return {
      url: process.env.SUPABASE_LOCAL_URL,
      anonKey: process.env.SUPABASE_LOCAL_ANON_KEY,
      serviceKey: process.env.SUPABASE_LOCAL_SERVICE_KEY,
      database: process.env.SUPABASE_LOCAL_DB || 'orchestrator_ai'
    };
  }
  
  return {
    url: process.env.SUPABASE_CLOUD_URL,
    anonKey: process.env.SUPABASE_CLOUD_ANON_KEY,
    serviceKey: process.env.SUPABASE_CLOUD_SERVICE_KEY
  };
});
```

##### 2.2 Migration Scripts
- Export current cloud schema and data
- Create local database initialization
- Test data migration integrity
- Validate all existing functionality works locally

##### 2.3 Ollama Integration
- Add Ollama service to NestJS providers
- Create model selection and routing logic
- Implement fallback to API providers when local unavailable
- Add health checks for local models

#### Acceptance Criteria:
- ✅ Can switch between local and cloud Supabase via environment variable
- ✅ All existing tests pass with local Supabase
- ✅ Can run multiple databases simultaneously
- ✅ Ollama models accessible from NestJS API
- ✅ Development startup script works end-to-end

### Phase 3: Landing Pages and Demo System
**Timeline**: Week 2 (Days 11-14)
**Status**: Pending Phase 2

#### Tasks:
- [ ] Design landing page components
- [ ] Create industry-specific demo scenarios
- [ ] Implement Loom video integration
- [ ] Build lead capture and consultation scheduling
- [ ] Add branding/theming system
- [ ] Create public routing for landing pages

#### Landing Page Structure:
```
src/views/landing/
├── LandingHome.vue          # Hero section + value prop
├── FeaturesShowcase.vue     # Key capabilities with videos
├── IndustryDemos.vue        # Industry-specific examples
├── PricingPlans.vue         # Deployment options
├── ContactForm.vue          # Lead capture
└── components/
    ├── VideoEmbed.vue       # Loom integration
    ├── TestimonialCard.vue  # Client success stories
    └── CTAButton.vue        # Call-to-action components
```

#### Demo Scenarios:
1. **Legal Practice**: Contract review, compliance checking, research
2. **Marketing Agency**: Content creation, social media management, analytics
3. **Accounting Firm**: Invoice processing, client communication, reporting
4. **Manufacturing**: Operations management, supply chain optimization

#### Acceptance Criteria:
- ✅ Compelling landing pages that convert visitors
- ✅ Working demo environments for each industry
- ✅ Loom videos properly embedded and responsive
- ✅ Lead capture form integrates with CRM/email
- ✅ Mobile-responsive design

### Phase 4: Production Deployment System
**Timeline**: Week 3 (Days 15-21)
**Status**: Pending Phase 3

#### Tasks:
- [ ] Build Docker production containers
- [ ] Create SSL certificate automation
- [ ] Implement monitoring and health checks
- [ ] Create backup and restore procedures
- [ ] Build client deployment scripts
- [ ] Test full production deployment

#### Docker Containers to Build:
```dockerfile
# Dockerfile.api - NestJS production container
# Dockerfile.web - Vue production container  
# nginx.conf - Reverse proxy configuration
# monitoring/ - Grafana/Prometheus setup
# backup-script.sh - Automated backup procedures
```

#### Deployment Automation:
- One-command client deployment
- SSL certificate generation with Let's Encrypt
- Health monitoring and alerting
- Automated database backups
- Rolling updates with zero downtime

#### Acceptance Criteria:
- ✅ Complete Docker stack deploys successfully
- ✅ SSL certificates auto-generate and renew
- ✅ Monitoring dashboards show all metrics
- ✅ Backup/restore procedures tested and documented
- ✅ Deployment takes < 30 minutes from start to finish

### Phase 5: Client Onboarding and Testing
**Timeline**: Week 4 (Days 22-28)
**Status**: Pending Phase 4

#### Tasks:
- [ ] Create client customization templates
- [ ] Build onboarding documentation
- [ ] Implement support and maintenance procedures
- [ ] Conduct end-to-end testing with pilot client
- [ ] Create pricing and service packages
- [ ] Launch beta program

#### Client Onboarding Flow:
1. **Discovery Call**: Understand client needs and requirements
2. **Hardware Recommendation**: Based on scale and budget
3. **Repository Fork**: Customize for client branding and needs
4. **Server Setup**: Deploy to client hardware/cloud
5. **Configuration**: Industry-specific agent setup
6. **Training**: Client team onboarding and usage training
7. **Go-Live**: Production launch with support monitoring

#### Beta Program:
- Target 3-5 friendly clients for pilot deployments
- Different industries to test versatility
- Gather feedback and iterate on process
- Document lessons learned and best practices

#### Acceptance Criteria:
- ✅ Successful deployment and operation at 3+ client sites
- ✅ Client satisfaction scores > 4.5/5
- ✅ Support ticket volume < 2/month per client
- ✅ Average deployment time < 2 hours
- ✅ All documentation complete and validated

## Resource Requirements

### Your Mac Studio Development Setup:
- **Current**: 128GB RAM, Docker, Ollama with gpt-oss:20b
- **Additional Needed**:
  - Domain name for demo site
  - SSL certificate for public access  
  - Basic monitoring setup (Grafana)
  - Backup storage (cloud or local NAS)

### Client Minimum Requirements:
- **Hardware**: 16GB RAM, 4-core CPU, 500GB SSD
- **Software**: Ubuntu 22.04 LTS, Docker, Domain name
- **Network**: Static IP or dynamic DNS service
- **Budget**: $500-1000 hardware + $50/month operational

## Risk Mitigation

### Technical Risks:
1. **Supabase Migration Complexity**
   - *Mitigation*: Extensive testing with multiple database exports
   - *Fallback*: Maintain cloud option for complex migrations

2. **Docker Deployment Failures**  
   - *Mitigation*: Comprehensive health checks and rollback procedures
   - *Fallback*: Manual deployment documentation

3. **Resource Constraints on Client Hardware**
   - *Mitigation*: Multiple deployment profiles (16GB, 32GB, 64GB+)
   - *Fallback*: Cloud-hybrid deployment options

### Business Risks:
1. **High Support Burden**
   - *Mitigation*: Self-healing infrastructure and extensive automation
   - *Plan*: Document all common issues and solutions

2. **Client Deployment Complexity**
   - *Mitigation*: One-command deployment scripts
   - *Plan*: Offer deployment services for additional fee

## Success Metrics

### Development Phase Metrics:
- [ ] All existing functionality works with local Supabase
- [ ] Development environment starts in < 2 minutes
- [ ] Hot reload works for both API and web applications
- [ ] Can switch between multiple local databases seamlessly

### Production Phase Metrics:
- [ ] Client deployment completes in < 30 minutes
- [ ] System uptime > 99.5% after initial setup
- [ ] API response times < 2 seconds average
- [ ] Memory usage < 70% during normal operations

### Business Phase Metrics:
- [ ] Landing page conversion rate > 15%
- [ ] Client deployment success rate > 95%
- [ ] Client satisfaction score > 4.5/5
- [ ] Monthly recurring revenue > $10K by month 3

## Next Actions (Week 1)

### Immediate Tasks (Days 1-3):
1. **Test Current Setup**: Verify gpt-oss:20b model works with existing code
2. **Environment Configuration**: Set up .env file from template
3. **Supabase Migration**: Export current cloud schema and test locally
4. **Integration Testing**: Ensure API can communicate with both Ollama and Supabase

### Weekly Goals:
- **Monday-Tuesday**: Complete local Supabase setup and migration
- **Wednesday-Thursday**: Integrate Ollama with NestJS API
- **Friday**: Test complete development workflow end-to-end

### Weekly Deliverables:
- Working local development environment
- Updated NestJS code for dual Supabase support
- Tested migration from cloud to local data
- Documentation of any issues and solutions

## Long-term Vision (Months 2-6)

### Month 2: Client Acquisition
- Launch landing pages and demo system
- Begin outreach to target industries
- Onboard first 3 paying clients

### Month 3: Process Refinement  
- Streamline deployment procedures
- Build automated update system
- Create advanced monitoring dashboards

### Month 4-6: Scale and Expand
- Add industry-specific agent templates
- Build marketplace for community agents
- Create partner program for resellers

## Support and Maintenance Model

### Service Tiers:
1. **Basic**: Monthly updates, email support, backup management
2. **Professional**: Priority support, phone support, custom integrations  
3. **Enterprise**: On-site support, dedicated success manager, SLA guarantees

### Revenue Projections:
- **Month 1**: 0 clients, -$5K (setup costs)
- **Month 2**: 3 clients × $500/month = $1.5K
- **Month 3**: 8 clients × $500/month = $4K  
- **Month 6**: 20 clients × $500/month = $10K
- **Year 1**: 50+ clients, $25K+ monthly recurring revenue

This implementation plan provides a clear roadmap from current state to successful small business AI server solution. Each phase builds on the previous one, with clear acceptance criteria and risk mitigation strategies.