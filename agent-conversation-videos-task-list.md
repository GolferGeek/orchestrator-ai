# Agent Conversation Videos - Task List

## High Priority Tasks

### Content Creation (1-19)
1. Script and record agent-default-overview video (General overview of working with Orchestrator AI agents)
2. Write script outline for agent-default-overview video covering key user flows
3. Record and edit agent-default-overview video with Loom
4. Generate metadata (title, description, duration, createdAt) for agent-default-overview
5. Script and record metrics-agent-walkthrough video (Finance Metrics agent)
6. Write script for metrics-agent-walkthrough showing specific finance use cases
7. Record and edit metrics-agent-walkthrough video
8. Script and record marketing-swarm-demo video (Marketing Swarm agent)
9. Write script for marketing-swarm-demo showcasing collaborative features
10. Record and edit marketing-swarm-demo video
11. Script and record requirements-writer-tutorial video (Requirements Writer agent)
12. Write script for requirements-writer-tutorial with step-by-step workflow
13. Record and edit requirements-writer-tutorial video
14. Script and record golf-rules-coach-demo video (Golf Rules specialist)
15. Write script for golf-rules-coach-demo with common rule scenarios
16. Record and edit golf-rules-coach-demo video
17. Script and record jokes-agent-demo video (Jokes productivity agent)
18. Write script for jokes-agent-demo showing productivity integration
19. Record and edit jokes-agent-demo video

### Reviews & Testing - Phase 1 (20-21)
20. Content review: Review all video scripts and metadata before recording phase
21. Test data structures: Validate videos.json and videoTexts.json schemas don't break existing functionality

### Data Modeling (22-25)
22. Extend apps/web/src/data/videos.json with agentDefaults mapping and new agent video entries
23. Design agentDefaults schema structure and validate against existing videos.json
24. Add new 'agents' category to categoryOrder in videos.json
25. Create video entries for all 6 agent videos plus default overview
26. Implement agentDefaults mapping (agent slugs to video ID arrays)
26a. Define specific agentDefaults mapping structure with agent slug keys (finance/metrics, marketing/marketing_swarm, etc.)
26b. Implement agentDefaults object in videos.json with mappings to video ID arrays

### Backend Core Implementation (27-37)
27. Update ContextLoaderService to parse ## Videos section and emit video IDs array
28. Add video parsing logic to ContextLoaderService with case-insensitive ## Videos detection
29. Extend AgentContextContent interface with optional videos array
30. Handle parsing edge cases (no videos section, malformed content, empty arrays)
31. Propagate parsed video IDs through AgentMetadataService for frontend API access
32. Update AgentMetadataService to include video IDs in API responses
33. Ensure video IDs are accessible via existing agent metadata endpoints
34. Backend testing: Unit tests for ContextLoaderService video parsing with success/fallback cases
35. Backend code review: Review ContextLoaderService and AgentMetadataService changes

### Frontend Core Components (36-53)
36. Create reusable AgentResourcesPanel component for video buttons and modals
37. Design AgentResourcesPanel component structure and props interface
38. Implement video button rendering with proper styling matching design system
39. Add modal trigger logic and state management for video display
40. Handle multiple videos per agent with proper ordering and layout
41. Extend agent conversation view to request and display video IDs with fallback logic
42. Update agent conversation API calls to fetch video metadata
43. Implement fallback logic to agent-default-overview when no agent videos exist
44. Integrate AgentResourcesPanel into conversation view layout
45. Implement modal player component reusing existing video player logic
46. Identify and extract reusable video player components from landing page
47. Create video modal component with Loom iframe embedding
48. Add modal controls (close, fullscreen, transcript toggle)
49. Frontend component testing: Test AgentResourcesPanel and modal components in isolation
50. Frontend code review: Review AgentResourcesPanel and modal components

### Critical QA (51-65)
51. Integration testing: Test complete agent conversation video flow end-to-end
52. Verify each target agent displays correct video(s) in conversation view
53. Test metrics agent conversation shows metrics-agent-walkthrough video
54. Test marketing-swarm agent shows marketing-swarm-demo video
55. Test requirements-writer agent shows requirements-writer-tutorial video
56. Test golf-rules agent shows golf-rules-coach-demo video
57. Test jokes agent shows jokes-agent-demo video
58. Test fallback behavior for agents without video section
59. Test agents without ## Videos section show agent-default-overview video
60. Test agents with empty ## Videos section show fallback video
61. Confirm landing page video experience remains unchanged
62. Final code review: Comprehensive review of all implemented features

## Medium Priority Tasks

### Data Structure Setup (63-67)
63. Create apps/web/src/data/video-texts/ directory for Markdown transcripts
64. Create apps/web/src/data/videoTexts.json registry mapping transcriptIds to metadata
65. Design videoTexts.json schema (title, description, filePath, lastUpdated)
66. Create sample transcript entries for initial video set

### Agent Context Updates (67-75)
67. Update agent context.md files to include ## Videos section with video IDs
67a. Add ## Videos section to finance/metrics/context.md with metrics-agent-walkthrough
67b. Add ## Videos section to marketing/marketing_swarm/context.md with marketing-swarm-demo
67c. Add ## Videos section to engineering/requirements_writer/context.md with requirements-writer-tutorial
67d. Add ## Videos section to specialists/golf_rules_agent/context.md with golf-rules-coach-demo
67e. Add ## Videos section to productivity/jokes_agent/context.md with jokes-agent-demo
68. Locate all target agent context.md files (metrics, marketing-swarm, requirements-writer, golf-rules, jokes)
68a. Testing: Verify ContextLoaderService correctly parses all updated context.md files
68b. Code review: Review all agent context.md file updates
69. Add ## Videos section to each agent's context.md with appropriate video IDs

### Backend API Development (76-84)
76. Implement POST /videos endpoint for admin video management with auth validation
77. Design video creation API payload schema with validation rules
78. Implement secure POST /videos endpoint with admin auth checks
79. Add logic to update videos.json file and handle concurrent writes safely
80. Implement GET /videos/transcripts/:id endpoint for transcript retrieval
81. Create transcript serving endpoint with proper caching headers
82. Add error handling for missing/invalid transcript IDs
83. Implement GET /videos/categories endpoint for admin modal dropdown
84. API testing: Test all new video management endpoints with various scenarios

### Frontend Features (85-97)
85. Add transcript viewing capability in video modal with Markdown rendering
86. Implement transcript fetching from GET /videos/transcripts/:id endpoint
87. Add Markdown rendering component for transcript display in modal
88. Create toggle UI between video view and transcript view in modal
89. Enhance VideoGalleryPage.vue with Add Video admin modal and transcript badges
90. Design and implement Add Video admin modal form with all required fields
91. Add admin permission checks and show/hide modal trigger based on user role
92. Implement form validation and submission to POST /videos endpoint
93. Add transcript availability badges to video list items
94. Implement automatic gallery refresh after successful video submission
95. Update videoService to handle expanded schema and transcript metadata
96. Extend videoService methods to handle new video fields (transcriptId, tags, etc.)
97. Add transcript metadata caching and retrieval methods
97a. Add getVideosByIds() method to videoService for batch video retrieval
97b. Extend Video interface to support transcript metadata fields (transcriptId, tags)
97c. Testing: Test videoService batch retrieval and extended interface
97d. Code review: Review videoService extensions

### Testing & QA (98-101)
98. Admin modal testing: Test Add Video modal with various input scenarios and error cases
99. Frontend code review: Review VideoGalleryPage and videoService updates
100. Cross-browser and responsive testing for all video components
101. Performance testing: Ensure video loading and modal performance meets standards

## Low Priority Tasks

### Analytics (102-106)
102. Implement analytics tracking for video button clicks and modal opens per agent
103. Add analytics event tracking for video button clicks with agent context
104. Add analytics event tracking for modal opens and video plays
105. Track fallback video usage to identify agents missing dedicated content
106. Track Add Video modal submissions (success/failure) for pipeline health monitoring

### Documentation (107-110)
107. Document schema changes in apps/web/src/data/README.md with transcript contribution instructions
108. Document videos.json schema changes and agentDefaults structure
109. Document videoTexts.json schema and transcript contribution workflow
110. Create usage examples for adding videos to agent context files

## Task Summary
- **Total Tasks:** 114
- **High Priority:** 62 tasks (Content, Core Backend/Frontend, Critical QA)
- **Medium Priority:** 43 tasks (Data Setup, APIs, Features, Testing)
- **Low Priority:** 9 tasks (Analytics, Documentation)

## Key Milestones
- **Phase 1:** Content Creation & Data Modeling (Tasks 1-26b)
- **Phase 2:** Backend Implementation & Testing (Tasks 27-35)
- **Phase 3:** Frontend Core Components & Testing (Tasks 36-50)
- **Phase 4:** Integration & Critical QA (Tasks 51-62)
- **Phase 5:** Advanced Features & Admin Tools (Tasks 63-101)
- **Phase 6:** Analytics & Documentation (Tasks 102-110)