<template>
  <div class="agent-tree-view" :class="{ 'compact-mode': compactMode }">
    <!-- Header with refresh and search -->
    <div v-if="!compactMode" class="tree-header">
      <h2>Agents & Conversations</h2>
      <div class="header-actions">
        <ion-searchbar
          v-model="searchQuery"
          placeholder="Search agents..."
          :debounce="300"
          @input="filterAgents"
        />
        <ion-button
          fill="outline"
          size="small"
          @click="refreshData"
          :disabled="conversationsStore.isLoading"
        >
          <ion-icon :icon="refreshOutline" />
        </ion-button>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="conversationsStore.isLoading" class="loading-state">
      <ion-spinner />
      <p>Loading agents...</p>
    </div>

    <!-- Error state -->
    <div v-if="conversationsStore.error" class="error-state">
      <ion-icon :icon="alertCircleOutline" color="danger" />
      <p>{{ conversationsStore.error }}</p>
      <ion-button @click="refreshData">Retry</ion-button>
    </div>

    <!-- Tree view -->
    <div v-if="!conversationsStore.isLoading && !conversationsStore.error" class="tree-content">
      <ion-accordion-group :multiple="true" v-model="expandedGroups">
        <!-- Agent Type Groups -->
        <ion-accordion
          v-for="agentType in filteredAgentTypes"
          :key="agentType.type"
          :value="agentType.type"
        >
          <ion-item slot="header" class="organization-header">
            <ion-icon
              :icon="getAgentTypeIcon(agentType.type)"
              slot="start"
              :color="getAgentTypeColor(agentType.type)"
              class="organization-icon"
            />
            <ion-label>
              <h3 class="organization-title">{{ formatAgentTypeName(agentType.type) }}</h3>
              <p class="organization-subtitle">{{ agentType.agents.length }} specialist{{ agentType.agents.length !== 1 ? 's' : '' }}</p>
            </ion-label>
            <ion-badge slot="end" :color="getAgentTypeColor(agentType.type)" class="conversation-count">
              {{ agentType.totalConversations }}
            </ion-badge>
          </ion-item>

          <div slot="content" class="agent-type-content">
            <!-- Individual Agents -->
            <ion-accordion-group 
              :key="`agents-${agentType.type}`" 
              :multiple="true"
              class="nested-accordion-group"
              v-model="getExpandedAgentsForType(agentType.type)"
            >
              <ion-accordion
                v-for="agent in agentType.agents"
                :key="`${agent.type}-${agent.name}`"
                :value="`${agent.type}-${agent.name}`"
              >
                <ion-item slot="header" class="agent-header">
                  <!-- Agent icon to indicate it's a functional specialist -->
                  <ion-icon 
                    :icon="personOutline" 
                    slot="start" 
                    class="agent-specialist-icon"
                    color="medium"
                  />
                  <ion-label>
                    <h3 class="agent-name">{{ formatAgentName(agent.name) }}</h3>
                    <p class="agent-subtitle">AI Specialist</p>
                  </ion-label>
                  <div slot="end" class="agent-badges">
                    <ion-badge
                      v-if="agent.activeConversations > 0"
                      color="success"
                      class="compact-badge active-badge"
                      title="Active conversations"
                    >
                      {{ agent.activeConversations }}
                    </ion-badge>
                    <ion-badge color="medium" class="compact-badge total-badge" title="Total conversations">
                      {{ agent.totalConversations }}
                    </ion-badge>
                  </div>
                </ion-item>

                <div slot="content" class="conversations-content">
                  <!-- Add new conversation button at the top -->
                  <div class="new-conversation-button">
                    <ion-button 
                      fill="clear" 
                      size="small"
                      @click.stop="createNewConversation(agent)"
                      class="start-conversation-btn"
                    >
                      <ion-icon :icon="addOutline" slot="start" />
                      New {{ getConversationLabel(agent) }}
                    </ion-button>
                  </div>
                  
                  <!-- Conversations for this agent -->
                  <div
                    v-if="agent.conversations.length === 0"
                    class="no-conversations"
                  >
                    <p>No {{ getConversationPluralLabel(agent).toLowerCase() }} yet</p>
                  </div>

                  <div
                    v-for="conversation in agent.conversations"
                    :key="conversation.id"
                    class="conversation-item"
                    :class="{ 'selected': selectedConversation?.id === conversation.id }"
                    @click.stop="selectConversation(conversation)"
                  >
                    <div class="conversation-header">
                      <div class="conversation-info">
                        <h4>{{ getConversationLabel(agent) }}</h4>
                        <div class="conversation-meta">
                          <span class="conversation-time">
                            {{ formatTime(conversation.lastActiveAt) }}
                          </span>
                          <ion-badge
                            v-if="conversation.activeTasks > 0"
                            color="primary"
                            class="task-badge"
                          >
                            {{ conversation.activeTasks }} running
                          </ion-badge>
                        </div>
                      </div>
                      <div class="conversation-actions">
                        <ion-button
                          fill="clear"
                          size="small"
                          color="danger"
                          @click.stop="endConversation(conversation)"
                        >
                          <ion-icon :icon="trashOutline" />
                        </ion-button>
                      </div>
                    </div>
                    <div class="conversation-stats">
                      <span class="stat">
                        <ion-icon :icon="checkmarkOutline" />
                        {{ conversation.completedTasks }}
                      </span>
                      <span class="stat">
                        <ion-icon :icon="closeOutline" />
                        {{ conversation.failedTasks }}
                      </span>
                      <span class="stat total">
                        {{ conversation.taskCount }} total tasks
                      </span>
                    </div>
                  </div>
                </div>
              </ion-accordion>
            </ion-accordion-group>
          </div>
        </ion-accordion>
      </ion-accordion-group>
    </div>

    <!-- Task Details Modal removed - conversations now load in main window -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import {
  IonAccordion,
  IonAccordionGroup,
  IonItem,
  IonLabel,
  IonIcon,
  IonBadge,
  IonButton,
  IonSearchbar,
  IonSpinner,
  IonAvatar,
} from '@ionic/vue';
import {
  personOutline,
  refreshOutline,
  alertCircleOutline,
  addOutline,
  closeOutline,
  trashOutline,
  checkmarkOutline,
  serverOutline,
  peopleOutline,
  cloudOutline,
  codeSlashOutline,
  megaphoneOutline,
  callOutline,
  businessOutline,
  settingsOutline,
  cardOutline,
  constructOutline,
  searchOutline,
  cubeOutline,
  scaleOutline,
} from 'ionicons/icons';
import { agentConversationsService } from '@/services/agentConversationsService';
import { formatAgentName } from '@/utils/caseConverter';
import { useAgentsStore } from '@/stores/agentsStore';
import { useAgentConversationsStore } from '@/stores/agentConversationsStore';
import { websocketService } from '@/services/websocketService';
// TaskDetailsModal import removed - conversations now load in main window

interface Agent {
  name: string;
  type: string;
  description?: string;
  conversations: Conversation[];
  activeConversations: number;
  totalConversations: number;
}

interface Conversation {
  id: string;
  agentName: string;
  agentType: string;
  startedAt: Date;
  lastActiveAt: Date;
  endedAt?: Date;
  taskCount: number;
  completedTasks: number;
  failedTasks: number;
  activeTasks: number;
  metadata?: Record<string, any>;
}

interface AgentType {
  type: string;
  agents: Agent[];
  totalConversations: number;
}

// Props
const props = defineProps<{
  compactMode?: boolean;
}>();

// Reactive state
const searchQuery = ref('');
const expandedGroups = ref<string[]>([]); // Start with all accordions closed
const expandedAgents = ref<Record<string, string[]>>({}); // Track expanded agents per organization
const selectedConversation = ref<Conversation | null>(null);
// showTaskModal removed - conversations now load in main window

// Data - removed local agents ref, using store instead

// Stores
const agentsStore = useAgentsStore();
const conversationsStore = useAgentConversationsStore();

// Computed
const filteredAgentTypes = computed(() => {
  const types = new Map<string, AgentType>();
  
  // Get agents from store instead of local ref
  const availableAgents = agentsStore.getAvailableAgents;
  
  const filteredAgents = availableAgents.filter((agent: any) => {
    const matchesSearch = !searchQuery.value || 
      agent.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      agent.description?.toLowerCase().includes(searchQuery.value.toLowerCase());
    return matchesSearch;
  });

  filteredAgents.forEach((agent: any) => {
    if (!types.has(agent.type)) {
      types.set(agent.type, {
        type: agent.type,
        agents: [],
        totalConversations: 0,
      });
    }
    
    // Get conversations from store
    const agentConversations = conversationsStore.getConversationsByAgent(agent.name, agent.type);
    
    const agentType = types.get(agent.type)!;
    agentType.agents.push({
      name: agent.name,
      type: agent.type,
      description: agent.description,
      conversations: agentConversations,
      activeConversations: agentConversations.filter(c => !c.endedAt).length,
      totalConversations: agentConversations.length,
    });
    agentType.totalConversations += agentConversations.length;
  });

  return Array.from(types.values()).sort((a, b) => {
    const order = ['orchestrator', 'marketing', 'sales', 'operations', 'engineering', 'research', 'finance', 'hr', 'specialist', 'product', 'legal'];
    return order.indexOf(a.type) - order.indexOf(b.type);
  });
});

// Methods

const refreshData = async () => {
  try {
    // Force refresh both stores
    await agentsStore.fetchAvailableAgents();
    await conversationsStore.fetchConversations(true); // Force refresh
  } catch (err) {
  }
};

const filterAgents = () => {
  // Filtering is handled in computed property
};

const selectConversation = (conversation: Conversation) => {
  selectedConversation.value = conversation;
  // Emit event for parent components
  emit('conversation-selected', conversation);
};

// Helper method to get/create expanded agents array for a specific organization
const getExpandedAgentsForType = (agentType: string) => {
  if (!expandedAgents.value[agentType]) {
    expandedAgents.value[agentType] = [];
  }
  return expandedAgents.value[agentType];
};

const createNewConversation = async (agent: Agent) => {
  try {
    // No automatic accordion manipulation - let user control accordions manually
    
    // With lazy conversation creation, we don't create conversations upfront
    // Instead, emit an event for the parent to handle (e.g., open chat interface)
    // The conversation will be created when the first task is sent
    
    // Emit event to parent with agent info
    emit('agent-selected', agent);
    
    // Give user feedback that something is happening
    // In a full implementation, this would transition to a chat interface
    
  } catch (err) {
  }
};

// viewConversationTasks removed - clicking conversation directly loads it

const endConversation = async (conversation: Conversation) => {
  try {
    let message = `Are you sure you want to delete this conversation with ${conversation.agentName}? This will permanently delete all tasks and data associated with this conversation.`;
    
    // Add warning if there are active tasks
    if (conversation.activeTasks > 0) {
      message += `\n\nWarning: This conversation has ${conversation.activeTasks} running task${conversation.activeTasks > 1 ? 's' : ''} that will be cancelled.`;
    }
    
    const result = await confirm(message);
    
    if (!result) return;

    // Use store method - this will update the UI reactively
    await conversationsStore.deleteConversation(conversation.id);
  } catch (err) {
    // Error is already handled in the store
  }
};

// handleTaskAction removed - no longer needed without modal

// Utility functions

const getConversationLabel = (agent: Agent) => {
  return agent.type === 'orchestrator' ? 'Session' : 'Conversation';
};

const getConversationPluralLabel = (agent: Agent) => {
  return agent.type === 'orchestrator' ? 'Sessions' : 'Conversations';
};

const formatAgentTypeName = (type: string) => {
  const names = {
    orchestrator: 'Orchestrator',
    specialist: 'Cross-Functional',
    marketing: 'Marketing',
    sales: 'Sales',
    hr: 'Human Resources',
    operations: 'Operations',
    finance: 'Finance',
    engineering: 'Engineering',
    research: 'Research',
    product: 'Product',
    legal: 'Legal',
  };
  return names[type as keyof typeof names] || type.charAt(0).toUpperCase() + type.slice(1);
};

const formatTime = (date: Date) => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
};

const getAgentTypeIcon = (type: string) => {
  const icons = {
    orchestrator: serverOutline,
    specialist: peopleOutline,
    marketing: megaphoneOutline,
    sales: callOutline,
    hr: businessOutline,
    operations: settingsOutline,
    finance: cardOutline,
    engineering: constructOutline,
    research: searchOutline,
    product: cubeOutline,
    legal: scaleOutline,
  };
  return icons[type as keyof typeof icons] || personOutline;
};

const getAgentTypeColor = (type: string) => {
  const colors = {
    orchestrator: 'success',
    specialist: 'primary',
    marketing: 'secondary',
    sales: 'tertiary',
    hr: 'warning',
    operations: 'dark',
    finance: 'success',
    engineering: 'danger',
    research: 'medium',
    product: 'light',
    legal: 'primary',
  };
  return colors[type as keyof typeof colors] || 'medium';
};

// Events
const emit = defineEmits<{
  'conversation-selected': [conversation: Conversation];
  'agent-selected': [agent: Agent];
  'task-completed': [event: { taskId: string; conversationId: string }];
  'task-failed': [event: { taskId: string; conversationId: string }];
  'task-updated': [event: { taskId: string; conversationId: string }];
}>();

// Lifecycle
onMounted(() => {
  refreshData();
  
  // Listen for task events to update conversation states
  websocketService.onTaskEvent('created', (event) => {
    // Update task counts in store without full refresh - use reactive task count updates instead
    if (event.conversationId) {
      conversationsStore.updateConversationTaskCounts(event.conversationId, {
        activeTasks: (conversationsStore.getConversationById(event.conversationId)?.activeTasks || 0) + 1,
        taskCount: (conversationsStore.getConversationById(event.conversationId)?.taskCount || 0) + 1,
      });
    }
  });
  
  websocketService.onTaskEvent('completed', (event) => {
    if (event.conversationId) {
      const conversation = conversationsStore.getConversationById(event.conversationId);
      if (conversation) {
        conversationsStore.updateConversationTaskCounts(event.conversationId, {
          activeTasks: Math.max(0, conversation.activeTasks - 1),
          completedTasks: conversation.completedTasks + 1,
        });
        
        // For long-running tasks, we need to trigger a refresh of the conversation data
        // to get the latest task results. This is a partial refresh that won't reset UI state.
        emit('task-completed', { taskId: event.taskId, conversationId: event.conversationId });
      }
    }
  });
  
  websocketService.onTaskEvent('failed', (event) => {
    if (event.conversationId) {
      const conversation = conversationsStore.getConversationById(event.conversationId);
      if (conversation) {
        conversationsStore.updateConversationTaskCounts(event.conversationId, {
          activeTasks: Math.max(0, conversation.activeTasks - 1),
          failedTasks: conversation.failedTasks + 1,
        });
        
        // For failed tasks, also notify parent components
        emit('task-failed', { taskId: event.taskId, conversationId: event.conversationId });
      }
    }
  });
  
  websocketService.onTaskEvent('updated', (event) => {
    if (event.conversationId) {
      // For task updates (progress, intermediate results), update the lastActiveAt timestamp
      // and notify parent components so they can refresh the task details
      conversationsStore.updateConversationTaskCounts(event.conversationId, {
        // Just update the timestamp to show activity
      });
      
      // Notify parent components about the task update
      emit('task-updated', { taskId: event.taskId, conversationId: event.conversationId });
    }
  });
});

// Watch for WebSocket connection changes
watch(() => websocketService.connected.value, (connected) => {
  if (connected) {
    // Subscribe to user's task events
    // This will be handled automatically by the websocket service
  }
});
</script>

<style scoped>
.agent-tree-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* Organization Level Styling */
.organization-header {
  --background: var(--ion-color-step-25);
  border-bottom: 1px solid var(--ion-color-step-100);
}

.organization-icon {
  font-size: 1.2em;
  margin-right: 4px;
}

.organization-title {
  font-weight: 600;
  font-size: 1.1em;
  margin-bottom: 2px;
}

.organization-subtitle {
  font-size: 0.85em;
  color: var(--ion-color-medium);
  margin: 0;
}

.conversation-count {
  font-weight: 600;
}

/* Agent/Specialist Level Styling */
.agent-header {
  --background: var(--ion-color-step-50);
  --padding-start: 20px;
}

.agent-specialist-icon {
  font-size: 1em;
  margin-right: 8px;
}

.agent-name {
  font-weight: 500;
  font-size: 1em;
  margin-bottom: 2px;
}

.agent-subtitle {
  font-size: 0.8em;
  color: var(--ion-color-medium);
  margin: 0;
  font-style: italic;
}

.active-badge {
  background: var(--ion-color-success);
  margin-right: 4px;
}

.total-badge {
  background: var(--ion-color-medium);
}

.tree-header {
  padding: 16px;
  border-bottom: 1px solid var(--ion-color-step-150);
}

.tree-header h2 {
  margin: 0 0 12px 0;
  color: var(--ion-color-primary);
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.header-actions ion-searchbar {
  flex: 1;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  text-align: center;
}

.error-state {
  color: var(--ion-color-danger);
}

.tree-content {
  flex: 1;
  overflow-y: auto;
}

.agent-type-content {
  padding-left: 16px;
}

.agent-header {
  --padding-start: 16px;
}

.agent-header ion-label h3 {
  font-size: 0.95em;
  font-weight: 500;
  white-space: nowrap;
  overflow: visible;
  text-overflow: unset;
  margin-bottom: 0;
}

.agent-avatar {
  width: 32px;
  height: 32px;
}

.agent-badges {
  display: flex;
  gap: 4px;
  align-items: center;
}

.conversations-content {
  padding: 8px 16px;
}

.no-conversations {
  text-align: center;
  padding: 24px;
  color: var(--ion-color-medium);
}

.conversation-item {
  background: var(--ion-color-step-50);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid transparent;
}

.conversation-item:hover {
  background: var(--ion-color-step-100);
}

.conversation-item.selected {
  border-color: var(--ion-color-primary);
  background: var(--ion-color-primary-tint);
}

.conversation-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
  gap: 8px;
}

.conversation-info {
  flex: 1;
  min-width: 0;
}

.conversation-info h4 {
  margin: 0 0 4px 0;
  font-size: 1em;
  font-weight: 500;
}

.conversation-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.task-badge {
  font-size: 0.7em;
  flex-shrink: 0;
}

.conversation-time {
  margin: 0;
  font-size: 0.85em;
  color: var(--ion-color-medium);
  flex-shrink: 0;
}

.conversation-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.conversation-stats {
  display: flex;
  gap: 12px;
  font-size: 0.85em;
  color: var(--ion-color-medium);
}

.stat {
  display: flex;
  align-items: center;
  gap: 4px;
}

.stat.total {
  margin-left: auto;
  font-weight: 500;
}

/* Compact Mode Styles */
.agent-tree-view.compact-mode {
  padding: 0;
}

.agent-tree-view.compact-mode .tree-content {
  padding: 0;
}

.agent-tree-view.compact-mode ion-item {
  --padding-start: 12px;
  --padding-end: 12px;
  font-size: 0.9em;
}

.agent-tree-view.compact-mode .conversation-item {
  padding: 6px 16px;
  font-size: 0.85em;
}

.agent-tree-view.compact-mode .conversation-meta {
  font-size: 0.75em;
}

.agent-tree-view.compact-mode .conversation-stats {
  font-size: 0.75em;
}

/* Compact mode styling for all agents */
.agent-tree-view.compact-mode .agent-header {
  --padding-start: 12px;
  --padding-end: 8px;
}

.agent-tree-view.compact-mode .agent-header ion-label h3 {
  font-size: 0.9em;
}
  
  /* Compact badge styles */
  .compact-badge {
    min-width: 20px;
    font-size: 0.8em;
    font-weight: 600;
    border-radius: 12px;
    margin-left: 4px;
  }
  
  .agent-tree-view.compact-mode .compact-badge {
    font-size: 0.7em;
    min-width: 18px;
  }
  
  /* New conversation button */
  .new-conversation-button {
    padding: 8px 16px;
    border-bottom: 1px solid var(--ion-color-light);
  }
  
  .start-conversation-btn {
    --color: var(--ion-color-primary);
    font-size: 0.9em;
    text-transform: none;
    font-weight: 500;
  }
  
  .agent-tree-view.compact-mode .start-conversation-btn {
    font-size: 0.8em;
  }
</style>