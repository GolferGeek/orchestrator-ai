# Video Management System

This directory contains the centralized video management system for the Orchestrator AI website.

## How to Add New Videos

### 1. Edit `videos.json`

To add a new video, simply edit the `videos.json` file:

```json
{
  "categoryOrder": [
    "introduction",
    "privacy-security", 
    "how-we-work",
    "evaluations",
    "what-were-working-on-next",
    "demos"
  ],
  "categories": {
    "introduction": {
      "title": "Introduction",
      "description": "Get to know Orchestrator AI...",
      "order": 1,
      "videos": [
        {
          "id": "intro-main",
          "title": "Introduction to Orchestrator AI",
          "description": "Get to know Orchestrator AI...",
          "url": "https://www.loom.com/embed/YOUR_VIDEO_ID",
          "duration": "5:30",
          "createdAt": "2024-01-15",
          "featured": true,
          "order": 1
        }
      ]
    }
  }
}
```

### 2. Video Properties

Each video needs these properties:

#### Required Properties
- **id**: Unique identifier (e.g., "intro-main", "metrics-agent-walkthrough")
- **title**: Display title for the video
- **description**: Brief description of the video content
- **url**: Full Loom embed URL or "TBD_RECORDING_NEEDED" for placeholder
- **duration**: Video length in MM:SS format (or "TBD" for unrecorded videos)
- **createdAt**: Date when video was created (YYYY-MM-DD)
- **featured**: Boolean - if true, shows on landing page buttons
- **order**: Number for sorting within category (1, 2, 3, etc.)

#### Optional Properties (Enhanced Schema)
- **recordingStatus**: String - "ready_for_recording", "in_production", or "completed"
- **transcriptId**: String - ID for associated transcript (defaults to video ID if not specified)
- **tags**: Array of strings - For improved searchability and categorization
- **agentDefaults**: Array of strings - Agent paths this video should appear for (deprecated, use global agentDefaults mapping)

### 3. Category Properties

Each category needs:

- **title**: Display name for the category
- **description**: Brief description of the category
- **order**: Number for sorting categories (1, 2, 3, etc.)
- **videos**: Array of video objects

### 4. Category Order

The `categoryOrder` array controls the display order of categories. Add new category keys here to include them in the display.

## Adding New Categories

1. Add the category key to `categoryOrder` array
2. Add the full category object to `categories`
3. Set appropriate `order` numbers

## Adding New Videos

1. Find the appropriate category in `categories`
2. Add the video object to the category's `videos` array
3. Set `featured: true` if you want it to appear on landing page buttons
4. Set appropriate `order` number for sorting within the category

## Examples

### Adding a New Demo Video

```json
"demos": {
  "title": "Demos & Behind-the-Scenes",
  "description": "Watch our latest demos...",
  "order": 6,
  "videos": [
    {
      "id": "demo-3",
      "title": "New Feature Demo",
      "description": "See our latest feature in action",
      "url": "https://www.loom.com/embed/NEW_VIDEO_ID",
      "duration": "8:45",
      "createdAt": "2024-01-25",
      "featured": false,
      "order": 3
    }
  ]
}
```

### Adding a New Category

1. Add to `categoryOrder`:
```json
"categoryOrder": [
  "introduction",
  "privacy-security", 
  "how-we-work",
  "evaluations",
  "what-were-working-on-next",
  "demos",
  "tutorials"
]
```

2. Add category object:
```json
"tutorials": {
  "title": "Tutorials",
  "description": "Step-by-step guides and tutorials",
  "order": 7,
  "videos": [
    {
      "id": "tutorial-1",
      "title": "Getting Started Tutorial",
      "description": "Learn the basics of using our platform",
      "url": "https://www.loom.com/embed/TUTORIAL_VIDEO_ID",
      "duration": "12:30",
      "createdAt": "2024-01-25",
      "featured": false,
      "order": 1
    }
  ]
}
```

## Where Videos Appear

- **Featured videos** (`featured: true`) appear as buttons on the landing page
- **All videos** appear in the Video Gallery page
- **Categories** are displayed in the order specified in `categoryOrder`
- **Videos within categories** are sorted by their `order` property

## Agent Video Mappings

The system supports agent-specific video recommendations through the `agentDefaults` mapping:

```json
{
  "agentDefaults": {
    "finance/metrics": ["metrics-agent-walkthrough"],
    "marketing/marketing_swarm": ["marketing-swarm-demo"],
    "engineering/requirements_writer": ["requirements-writer-tutorial"],
    "specialists/golf_rules_agent": ["golf-rules-coach-demo"],
    "productivity/jokes_agent": ["jokes-agent-demo"]
  }
}
```

When users interact with specific agents, the system will show the mapped videos. If no agent-specific videos are found, it falls back to the default overview video.

### Adding Agent Video Mappings

1. Add your video to the appropriate category first
2. Add the agent path (e.g., "specialists/my_new_agent") to `agentDefaults`
3. Map it to an array of video IDs that should appear for that agent
4. Update the agent's context.md file with a ## Videos section (see Agent Integration below)

## Video Transcripts

The system supports video transcripts stored in the `.taskmaster/docs/video-texts/` directory.

### Adding Transcripts

1. **Create transcript file**: `apps/web/src/.taskmaster/docs/video-texts/{videoId}.md`
2. **Use Markdown format**: Full Markdown support with headers, lists, code blocks, etc.
3. **Set transcriptId**: In videos.json, set `transcriptId` field (defaults to video ID if omitted)

Example transcript file structure:
```markdown
# Video Title

## Overview
Brief description of what the video covers.

## Key Points
- Important concept 1
- Important concept 2

## Code Examples
```javascript
// Example code from the video
console.log("Hello world");
```

## Conclusion
Summary of the video content.
```

### Transcript Display
- Transcripts appear in the video modal as a separate tab
- Markdown is rendered with syntax highlighting
- Search functionality includes transcript content
- Transcript badges appear on video list items when available

## Agent Integration

To integrate videos with agent conversations:

### 1. Add Video to Agent Context

Edit the agent's `context.md` file and add a `## Videos` section:

```markdown
## Videos
- metrics-agent-walkthrough
- agent-default-overview
```

### 2. Update Agent Defaults Mapping

Add the agent path to `agentDefaults` in videos.json:
```json
"agentDefaults": {
  "finance/metrics": ["metrics-agent-walkthrough"]
}
```

### 3. Video Display Logic
- Agent conversations show videos from the agent's context.md file
- If no agent-specific videos found, shows default overview video
- Videos appear as buttons in the agent resources panel
- Analytics track agent context for video interactions

## Admin Video Management

Administrators can add videos through the Video Gallery admin interface:

### Admin Modal Fields
- **Video ID**: Unique identifier
- **Title & Description**: Display information  
- **Video URL**: Loom embed URL or TBD_RECORDING_NEEDED
- **Duration**: MM:SS format
- **Category**: Select from existing categories
- **Order**: Position within category
- **Featured**: Show on landing page
- **Transcript ID**: Optional custom transcript ID
- **Recording Status**: Production workflow tracking

### Admin Features
- Form validation and error handling
- Automatic page refresh after successful creation
- Toast notifications for feedback
- Role-based access control (admin only)

## Analytics Tracking

The system tracks comprehensive video analytics:

### Tracked Events
- **Video button clicks**: From agent conversations
- **Video modal opens**: With agent context
- **Transcript views**: When users switch to transcript tab
- **Fallback usage**: When agents lack dedicated videos
- **Admin actions**: Video creation success/failure
- **Gallery interactions**: Video clicks from gallery page

### Event Metadata
- Agent context (slug, name, conversation context)
- Video metadata (ID, title, featured status, order)
- Source tracking (agent_conversation, video_gallery, admin_modal)
- Fallback detection and agent video mapping status

## Best Practices

1. **Use descriptive IDs**: Make video IDs meaningful (e.g., "intro-main", "metrics-agent-walkthrough")
2. **Keep titles concise**: Video titles should be clear and under 50 characters
3. **Update metadata**: Always update `lastUpdated` and `totalVideos` in metadata when adding videos
4. **Test URLs**: Make sure Loom embed URLs work before adding them
5. **Consistent ordering**: Use sequential order numbers (1, 2, 3, etc.) within categories
6. **Transcript quality**: Provide comprehensive transcripts with proper Markdown formatting
7. **Agent mapping**: Always map agent-specific videos in agentDefaults for proper targeting
8. **Recording workflow**: Use recordingStatus to track production pipeline
9. **Tagging**: Use meaningful tags for improved searchability and categorization
10. **Analytics**: Monitor fallback usage to identify agents needing dedicated content
