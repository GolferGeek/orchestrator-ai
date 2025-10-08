# Requirements Writer Tutorial Video Script
**Target Duration:** 9 minutes  
**Purpose:** Step-by-step workflow for transforming ideas into professional documentation  
**Audience:** Product managers, developers, business analysts, project managers

---

## PRE-RECORDING SETUP
- [ ] Open Orchestrator AI platform
- [ ] Navigate to Requirements Writer agent
- [ ] Prepare sample feature/project idea
- [ ] Have examples of different document types ready
- [ ] Test screen recording setup
- [ ] Prepare to show document generation process

---

## SCRIPT

### Opening Hook (0:00 - 0:45)
**[SCREEN: Orchestrator AI main interface]**

> "Okay, so here's something every small business deals with - you have this great idea for a feature or product, but when you try to explain it to a developer or even write it down yourself, it turns into a mess. Either it's too vague and they build the wrong thing, or you overthink it and write a novel nobody reads."

**[ACTION: Navigate to Requirements Writer agent]**

> "I built our Requirements Writer agent because I was tired of miscommunications that led to expensive do-overs. Let me show you how to turn your messy ideas into clear documentation that actually gets you what you want."

### Agent Introduction & Documentation Types (0:45 - 1:30)
**[SCREEN: Requirements Writer agent interface]**

> "The Requirements Writer is your documentation specialist. It understands the difference between a PRD and a TRD, knows how to write proper acceptance criteria, and can create everything from high-level product vision to detailed API specifications."

**[ACTION: Show agent capabilities or description]**

> "What makes this agent powerful is its structured approach. It doesn't just write documents - it follows professional frameworks and ensures nothing critical gets missed."

**[ACTION: Start conversation with agent]**

> "Let's walk through a real scenario: turning a business idea into a complete Product Requirements Document."

### Phase 1: Idea to Initial Requirements (1:30 - 3:00)
**[SCREEN: Chat interface with Requirements Writer]**

> "I'm going to start with a common business scenario - a vague but promising idea that needs to become a concrete development plan."

**[TYPE IN CHAT:]**
```
I want to build a feature that helps our customers track their progress toward goals. Users should be able to set goals, see their progress, and get motivated to keep going. We want this to increase engagement and retention.
```

**[ACTION: Send message and observe agent's response]**

> "Notice how the agent immediately starts asking clarifying questions. This is exactly what a professional business analyst would do - it's not jumping straight to solutions, it's understanding the problem space."

**[SCREEN: Show agent's follow-up questions]**

> "See these questions: Who are the users? What types of goals? How do we measure progress? What does 'motivated' mean functionally? The agent is guiding us through proper requirements gathering."

**[ACTION: Respond to agent questions]**

**[TYPE RESPONSE:]**
```
The users are members of our fitness app, mostly ages 25-45. They want to set goals like losing 20 pounds, working out 3 times a week, or eating more vegetables. We can track progress through their daily weigh-ins, logged workouts, and when they log meals. For motivation, I'm thinking progress bars, achievement badges when they hit milestones, and maybe they can share their progress with friends for accountability.
```

### Phase 2: Structured PRD Creation (3:00 - 4:45)
**[SCREEN: Continue conversation showing PRD development]**

> "Now watch how the agent transforms our conversation into a structured Product Requirements Document."

**[ACTION: Request PRD generation]**

**[TYPE IN CHAT:]**
```
Perfect! Now can you create a complete Product Requirements Document for this goal tracking feature? I need something I can send to my development team that has all the professional sections they expect - user stories, requirements, success metrics, all that stuff.
```

**[ACTION: Show PRD generation process]**

> "The agent is following professional PRD structure: Executive Summary, User Personas, User Stories, Functional Requirements, Non-Functional Requirements, Success Metrics, and Implementation Timeline."

**[SCREEN: Scroll through generated PRD sections]**

> "Look at this User Stories section - each story follows proper format: 'As a [user type], I want to [action] so that [benefit].' Plus acceptance criteria that developers can actually implement."

**[ACTION: Highlight specific PRD elements]**

> "The Functional Requirements section breaks down complex features into specific, testable requirements. Instead of 'users can track progress,' we get 'System shall update goal progress percentage within 5 seconds of user action completion.'"

### Phase 3: Technical Specifications (4:45 - 6:15)
**[SCREEN: Continue with technical documentation]**

> "For the development team, we need technical specifications. Let's see how the agent handles this transition."

**[TYPE IN CHAT:]**
```
Now I need the technical side of this. Can you create a Technical Requirements Document with the database schema, API endpoints, and system architecture? My developer needs to know exactly what to build and how the data should be structured.
```

**[ACTION: Show TRD generation]**

> "The agent automatically switches to technical thinking. Look at this database schema - it's designing tables for goals, progress_entries, achievements, and user_settings with proper foreign key relationships."

**[SCREEN: Show database schema and API specs]**

> "The API specification follows REST conventions with proper HTTP methods, response codes, and error handling. This isn't generic documentation - it's implementation-ready."

**[ACTION: Highlight API endpoint examples]**

> "Each endpoint includes request/response examples, authentication requirements, and error scenarios. A developer could start building from this specification immediately."

### Phase 4: User Stories and Acceptance Criteria (6:15 - 7:30)
**[SCREEN: Show user story breakdown]**

> "Let's get more granular with user stories for agile development teams."

**[TYPE IN CHAT:]**
```
Now I need to break this down into user stories for my development team. Can you create detailed user stories with acceptance criteria and story point estimates? Format these so we can use them directly in our sprint planning.
```

**[ACTION: Show user story generation]**

> "Perfect for sprint planning. Each story is sized appropriately, includes detailed acceptance criteria, and has clear definition of done."

**[SCREEN: Show story breakdown with estimates]**

> "Notice the story point estimates and dependencies. 'Goal Creation' is prerequisite for 'Progress Tracking,' which enables 'Achievement System.' The agent understands logical development sequence."

**[ACTION: Show acceptance criteria details]**

> "The acceptance criteria are testable: 'Given a user has created a weight loss goal, When they log a weigh-in, Then the progress bar updates within 5 seconds and displays percentage complete.' QA can write test cases directly from this."

### Phase 5: Advanced Documentation Features (7:30 - 8:30)
**[SCREEN: Show advanced capabilities]**

> "The Requirements Writer can also handle complex scenarios like API documentation and system integration specs."

**[TYPE IN CHAT:]**
```
One more thing - can you create API documentation for the goal tracking endpoints? I need code examples in JavaScript and Python, and make it good enough that we could publish this on our developer portal for third-party integrations.
```

**[ACTION: Show API documentation generation]**

> "Look at this developer-ready documentation. Code examples in multiple languages, authentication flow, rate limiting details, and webhook notifications for real-time updates."

**[SCREEN: Show code examples and integration guides]**

> "This is publication-ready documentation. Clear examples, error handling, and integration patterns that external developers can follow without additional support."

### Quality Assurance & Review Process (8:30 - 8:50)
**[SCREEN: Show document review features]**

> "Before finalizing, let's use the agent's review capabilities."

**[TYPE IN CHAT:]**
```
Review all our documentation for completeness and consistency. Flag any missing requirements or potential implementation issues.
```

**[ACTION: Show review process and feedback]**

> "The agent identifies gaps: missing error states, undefined edge cases, and scaling considerations. It's thinking like a senior architect, not just documenting what we asked for."

### Closing & Best Practices (8:50 - 9:00)
**[SCREEN: Show complete documentation suite]**

> "So in about 15 minutes, we went from a vague idea to professional documentation that a developer can actually use. No more 'that's not what I meant' conversations after they build it."

**[ACTION: Show final document overview]**

> "If you're tired of project miscommunications or paying for stuff to be rebuilt because the requirements weren't clear, give this a try. It's way easier than trying to figure out documentation formats yourself."

---

## POST-PRODUCTION NOTES
- [ ] Add visual callouts for different document sections
- [ ] Highlight the evolution from idea to structured docs
- [ ] Include side-by-side before/after comparisons
- [ ] Add timestamps for different document types
- [ ] Create graphics showing documentation workflow

---

## KEY WORKFLOW STEPS TO EMPHASIZE
1. **Clarification**: Agent asks the right questions before writing
2. **Structure**: Follows professional documentation frameworks
3. **Iteration**: Builds complexity gradually from basic idea
4. **Specificity**: Transforms vague concepts into testable requirements
5. **Implementation-Ready**: Creates documentation developers can actually use

---

## DOCUMENT TYPES TO DEMONSTRATE
- Product Requirements Document (PRD)
- Technical Requirements Document (TRD)
- User Stories with Acceptance Criteria
- API Documentation with code examples
- Database Schema specifications
- System Architecture considerations

---

## SAMPLE PROJECT DETAILS
**Feature**: Goal Tracking for Fitness App
**Users**: Fitness app members (25-45 years old)
**Goal Types**: Weight loss, workout frequency, nutrition targets
**Tracking Methods**: Daily weigh-ins, logged workouts, meal tracking
**Motivation Elements**: Progress visualization, achievement badges, social sharing
**Technical Stack**: REST API, mobile app integration, real-time updates

---

## REQUIREMENTS QUALITY INDICATORS
- Specific and measurable acceptance criteria
- Clear user personas and use cases
- Defined success metrics and KPIs
- Technical constraints and dependencies
- Error handling and edge cases
- Performance and scalability requirements

---

## FILMING TECHNICAL NOTES
- Show the evolution from vague idea to specific requirements
- Highlight professional documentation structure
- Pause to let viewers read acceptance criteria
- Show code examples clearly and completely
- Demonstrate the iterative refinement process
- Include examples of what NOT to do vs. proper requirements