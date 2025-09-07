# Developer Tools Components

A comprehensive suite of Vue.js components for monitoring and debugging LLM request routing, model status, and system health.

## Components

### 🛠️ DevToolsPanel
The main container component that provides a unified developer tools interface with tabs for different monitoring aspects.

**Features:**
- Collapsible/expandable panel with persistent state
- Tabbed interface for different tools
- Real-time system status indicators
- Quick actions for system management
- Minimizable to a floating mini-panel

### 📊 RunMetadataPanel
Displays detailed metadata for LLM requests including run ID, provider, model, duration, cost, and performance insights.

**Features:**
- Expandable/collapsible display
- Performance insights with visual indicators
- Copy-to-clipboard functionality
- Token usage tracking
- Cost analysis

### 🖥️ LocalModelStatus
Real-time dashboard showing the status of local Ollama models organized by performance tiers.

**Features:**
- Auto-refresh with configurable intervals
- Memory management controls
- Model loading/unloading actions
- Health status indicators
- Performance metrics display

### 🔀 RoutingVisualization
Interactive visualization of the request routing flow showing how requests are routed between local and external providers.

**Features:**
- Animated request flow simulation
- Decision factor visualization
- Routing statistics
- Performance comparisons
- Interactive controls

## Quick Start

### 1. Basic Usage

```vue
<template>
  <div id="app">
    <!-- Your main application content -->
    <main>
      <!-- ... your app content ... -->
    </main>
    
    <!-- Developer Tools Panel (fixed position) -->
    <DevToolsPanel />
  </div>
</template>

<script>
import { DevToolsPanel } from '@/components/Developer'

export default {
  components: {
    DevToolsPanel
  }
}
</script>
```

### 2. Individual Component Usage

```vue
<template>
  <div>
    <!-- Run Metadata Display -->
    <RunMetadataPanel :metadata="currentMetadata" />
    
    <!-- Local Model Status -->
    <LocalModelStatus />
    
    <!-- Routing Visualization -->
    <RoutingVisualization />
  </div>
</template>

<script>
import { 
  RunMetadataPanel, 
  LocalModelStatus, 
  RoutingVisualization 
} from '@/components/Developer'

export default {
  components: {
    RunMetadataPanel,
    LocalModelStatus,
    RoutingVisualization
  },
  data() {
    return {
      currentMetadata: {
        runId: 'abc123',
        provider: 'ollama',
        model: 'llama3.2:latest',
        tier: 'ultra-fast',
        duration: 1250,
        cost: 0.000000,
        timestamp: new Date().toISOString(),
        inputTokens: 42,
        outputTokens: 156
      }
    }
  }
}
</script>
```

### 3. Integration with LLM Service

To capture metadata automatically, integrate with your LLM service:

```typescript
// In your LLM service
import { EventBus } from '@/utils/eventBus'

class LLMService {
  async generateResponse(prompt: string) {
    const startTime = Date.now()
    
    try {
      // ... make LLM request ...
      
      // Capture metadata
      const metadata = {
        runId: generateRunId(),
        provider: 'ollama',
        model: 'llama3.2:latest',
        tier: 'ultra-fast',
        duration: Date.now() - startTime,
        cost: 0.000000,
        timestamp: new Date().toISOString(),
        inputTokens: inputTokenCount,
        outputTokens: outputTokenCount
      }
      
      // Emit metadata for developer tools
      EventBus.emit('llm-metadata', metadata)
      
      return response
    } catch (error) {
      // Handle error
    }
  }
}
```

## API Integration

The components are designed to work with the production optimization API endpoints:

### Required Endpoints

- `GET /api/llm/production/operations/status` - System health and status
- `GET /api/llm/production/memory/stats` - Memory usage statistics  
- `GET /api/llm/production/monitoring/health` - Model health metrics
- `POST /api/llm/production/memory/optimize` - Memory optimization
- `POST /api/llm/production/operations/emergency-restart` - Emergency restart

### API Response Format

```typescript
// /api/llm/production/operations/status
interface StatusResponse {
  timestamp: string
  system: {
    healthy: boolean
    ollamaConnected: boolean
    modelsTotal: number
    modelsHealthy: number
    modelsUnhealthy: number
    averageResponseTime: number
    uptime: number
  }
  memory: {
    healthy: boolean
    pressure: 'low' | 'medium' | 'high' | 'critical'
    usagePercent: number
    currentUsageGB: number
    totalAllocatedGB: number
    loadedModels: number
    threeTierModels: number
  }
  loadedModels: Array<{
    name: string
    size: string
    tier: string
    lastUsed: string
    useCount: number
    isThreeTier: boolean
  }>
  activeAlerts: Array<{
    id: string
    type: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    message: string
    timestamp: string
  }>
}
```

## Configuration

### Environment Variables

```bash
# API Base URL (if different from current domain)
VITE_API_BASE_URL=http://localhost:7100

# Auto-refresh intervals (milliseconds)
VITE_DEV_TOOLS_REFRESH_INTERVAL=10000
VITE_HEALTH_CHECK_INTERVAL=30000

# Panel persistence
VITE_DEV_TOOLS_PERSIST_STATE=true
```

### CSS Custom Properties

The components support theming via CSS custom properties:

```css
:root {
  /* Colors */
  --primary-color: #3b82f6;
  --primary-hover: #2563eb;
  --danger-color: #ef4444;
  --success-color: #10b981;
  --warning-color: #f59e0b;
  
  /* Backgrounds */
  --panel-bg: #ffffff;
  --card-bg: #ffffff;
  --header-bg: #f8f9fa;
  
  /* Text */
  --text-primary: #1a1a1a;
  --text-secondary: #666666;
  
  /* Borders */
  --border-color: #e1e5e9;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  :root {
    --panel-bg: #1f2937;
    --card-bg: #1f2937;
    --header-bg: #374151;
    --text-primary: #f9fafb;
    --text-secondary: #9ca3af;
    --border-color: #374151;
  }
}
```

## Features

### 🎯 Real-time Monitoring
- Live system health status
- Memory pressure monitoring
- Model performance tracking
- Active alert notifications

### 🔧 Interactive Controls
- Memory optimization triggers
- Model loading/unloading
- Emergency system restart
- Health check execution

### 📱 Responsive Design
- Mobile-friendly interface
- Collapsible panels
- Touch-friendly controls
- Adaptive layouts

### 💾 State Persistence
- Panel visibility state
- Active tab selection
- User preferences
- Auto-refresh settings

### 🎨 Customizable Theming
- CSS custom properties
- Dark mode support
- Consistent design system
- Accessible color contrast

## Browser Support

- Chrome/Edge 88+
- Firefox 85+
- Safari 14+
- Mobile browsers with ES2020 support

## Performance

The components are optimized for performance:
- Lazy loading of heavy components
- Efficient re-rendering with Vue 3 reactivity
- Debounced API calls
- Smart caching of static data
- Minimal DOM updates

## Accessibility

- ARIA labels and roles
- Keyboard navigation support
- Screen reader compatibility
- High contrast mode support
- Focus management

## Development

### Prerequisites
- Vue 3.x
- TypeScript support
- Modern build system (Vite recommended)

### Building
```bash
npm run build
```

### Testing
```bash
npm run test
```

### Linting
```bash
npm run lint
```

## License

Part of the Orchestrator AI project - see main project license.
