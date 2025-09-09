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
          <ion-item slot="header" class="organization-header" :data-hierarchy-level="agentType.level || 0">
            <ion-icon
              :icon="getAgentTypeIcon(agentType)"
              slot="start"
              :color="getAgentTypeColor(agentType)"
              class="organization-icon"
            />
            <ion-label>
              <h3 class="organization-title">{{ formatAgentTypeName(agentType) }}</h3>
              <p class="organization-subtitle">{{ getAgentSubtitle(agentType) }}</p>
            </ion-label>
            <ion-badge slot="end" :color="getAgentTypeColor(agentType)" class="conversation-count">
              {{ agentType.totalConversations }}
            </ion-badge>
          </ion-item>
          <div slot="content" class="agent-type-content">
            <!-- Individual Agents - Custom expandable structure -->
            <div
              v-for="agent in agentType.agents"
              :key="`${agent.type}-${agent.name}`"
              class="agent-section"
            >
              <!-- Agent Header - Clickable to expand/collapse -->
              <div 
                class="agent-header-button" 
                @click.stop="toggleAgent(agent)"
              >
                <ion-icon 
                  :icon="personOutline" 
                  class="agent-specialist-icon"
                  color="medium"
                />
                <div class="agent-info">
                  <h3 class="agent-name">{{ cleanAgentName(agent.name) }}</h3>
                </div>
                <div class="agent-badges">
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
                <ion-icon 
                  :icon="isAgentExpanded(agent) ? chevronDownOutline : chevronForwardOutline" 
                  class="expand-icon"
                  color="medium"
                />
              </div>
              <!-- Agent Content - Only show if expanded -->
              <div v-if="isAgentExpanded(agent)" class="conversations-content">
                <!-- Action buttons at the top -->
                <div class="agent-actions">
                  <ion-button 
                    fill="clear" 
                    size="small"
                    @click.stop="createNewConversation(agent)"
                    class="start-conversation-btn"
                  >
                    <ion-icon :icon="addOutline" slot="start" />
                    New {{ getConversationLabel(agent) }}
                  </ion-button>
                  <!-- Create Project button for orchestrator agents -->
                  <ion-button 
                    v-if="agent.type === 'orchestrator'"
                    fill="clear" 
                    size="small"
                    color="secondary"
                    @click.stop="createNewProject(agent)"
                    class="create-project-btn"
                  >
                    <ion-icon :icon="folderOutline" slot="start" />
                    Create Project
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
                      <h4>{{ getConversationDisplayName(conversation) }}</h4>
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
            </div>
            
            <!-- Hierarchy Level Actions -->
            <div class="hierarchy-actions">
              <div class="action-separator"></div>
              <div class="action-buttons">
                <ion-button 
                  fill="clear" 
                  size="small"
                  @click.stop="createNewConversation(agentType.agents[0])"
                  class="hierarchy-action-btn"
                >
                  <ion-icon :icon="addOutline" slot="start" />
                  💬 Create a conversation
                </ion-button>
                <ion-button 
                  fill="clear" 
                  size="small"
                  color="secondary"
                  @click.stop="createNewProject(agentType.agents[0])"
                  class="hierarchy-action-btn"
                >
                  <ion-icon :icon="folderOutline" slot="start" />
                  📋 Create a project
                </ion-button>
              </div>
            </div>
          </div>
        </ion-accordion>
      </ion-accordion-group>
    </div>
    <!-- Task Details Modal removed - conversations now load in main window -->
    <!-- Conversation Delete Modal -->
    <ConversationDeleteModal
      :is-open="showDeleteModal"
      :agent-display-name="deleteModalData?.agentDisplayName || ''"
      :active-tasks="deleteModalData?.activeTasks || 0"
      :has-deliverables="deleteModalData?.hasDeliverables || false"
      @cancel="cancelDelete"
      @confirm="confirmDelete"
    />
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
  chevronDownOutline,
  chevronForwardOutline,
  folderOutline,
} from 'ionicons/icons';
import { agentConversationsService } from '@/services/agentConversationsService';
import { deliverablesService } from '@/services/deliverablesService';
import { formatAgentName } from '@/utils/caseConverter';
import { useAgentsStore } from '@/stores/agentsStore';
import { useAgentConversationsStore } from '@/stores/agentConversationsStore';
import { websocketService } from '@/services/websocketService';
import { useRouter } from 'vue-router';
import ConversationDeleteModal from './ConversationDeleteModal.vue';
// TaskDetailsModal import removed - conversations now load in main window
interface Agent {
  name: string;
  type: string;
  description?: string;
  execution_modes?: string[];
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
  isHierarchyNode?: boolean;
  level?: number;
  hierarchyData?: any;
  isManager?: boolean;
}
// Props
const props = defineProps<{
  compactMode?: boolean;
  searchQuery?: string;
}>();
// Reactive state
const searchQuery = ref(props.searchQuery || '');
const expandedGroups = ref<string[]>([]); // Start with all accordions closed
const expandedAgents = ref<string[]>([]); // Track manually expanded agents
const selectedConversation = ref<Conversation | null>(null);
// showTaskModal removed - conversations now load in main window
const showDeleteModal = ref(false);
const deleteModalData = ref<{
  conversation: Conversation;
  agentDisplayName: string;
  activeTasks: number;
  hasDeliverables: boolean;
} | null>(null);
// Data - removed local agents ref, using store instead
// Stores
const agentsStore = useAgentsStore();
const conversationsStore = useAgentConversationsStore();
const router = useRouter();
// Computed - now using hierarchy instead of type grouping
const filteredAgentTypes = computed(() => {
  const hierarchy = agentsStore.getAgentHierarchy;
  const availableAgents = agentsStore.getAvailableAgents;
  if (!hierarchy) {
    // Fallback to original type-based grouping if hierarchy not available
    const types = new Map<string, AgentType>();
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
      // Get conversations from store - use direct state access for reactivity
      const agentConversations = conversationsStore.conversations.filter(conv => 
        conv.agentName === agent.name && conv.agentType === agent.type
      );
      const agentType = types.get(agent.type)!;
      agentType.agents.push({
        name: agent.name,
        type: agent.type,
        description: agent.description,
        execution_modes: agent.execution_modes,
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
  }
  // Convert hierarchy to display format
  const buildHierarchyGroups = (node: any, level: number = 0): AgentType[] => {
    const groups: AgentType[] = [];
    // Check if this node represents an agent (either has node.agent or is an agent itself)
    const agentData = node.agent || (node.name && node.type ? node : null);
    if (agentData) {
      // This is an actual agent node
      const agent = availableAgents.find(a => a.name === agentData.name);
      if (!agent) {
        // If not found in availableAgents, create from hierarchy data
        const hierarchyAgent = {
          name: agentData.name,
          type: agentData.type || 'specialist',
          description: agentData.metadata?.description || agentData.description || '',
          execution_modes: []
        };
        // Apply search filter
        const matchesSearch = !searchQuery.value || 
          hierarchyAgent.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
          hierarchyAgent.description?.toLowerCase().includes(searchQuery.value.toLowerCase());
        if (matchesSearch) {
          const agentConversations = conversationsStore.conversations.filter(conv => 
            conv.agentName === hierarchyAgent.name && conv.agentType === hierarchyAgent.type
          );
          const agentGroup: AgentType = {
            type: `${hierarchyAgent.name}_hierarchy_${level}`, // Unique identifier
            agents: [{
              name: hierarchyAgent.name,
              type: hierarchyAgent.type,
              description: hierarchyAgent.description,
              execution_modes: hierarchyAgent.execution_modes,
              conversations: agentConversations,
              activeConversations: agentConversations.filter(c => !c.endedAt).length,
              totalConversations: agentConversations.length,
            }],
            totalConversations: agentConversations.length,
            isHierarchyNode: true,
            level: level,
            hierarchyData: agentData
          };
          groups.push(agentGroup);
        }
        return groups;
      }
      // Apply search filter for found agent
      const matchesSearch = !searchQuery.value || 
        agent.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        agent.description?.toLowerCase().includes(searchQuery.value.toLowerCase());
      if (matchesSearch) {
        const agentConversations = conversationsStore.conversations.filter(conv => 
          conv.agentName === agent.name && conv.agentType === (agent.type || 'specialist')
        );
        const agentGroup: AgentType = {
          type: `${agent.name}_hierarchy_${level}`, // Unique identifier
          agents: [{
            name: agent.name,
            type: agent.type || 'specialist',
            description: agent.description || '',
            execution_modes: agent.execution_modes,
            conversations: agentConversations,
            activeConversations: agentConversations.filter(c => !c.endedAt).length,
            totalConversations: agentConversations.length,
          }],
          totalConversations: agentConversations.length,
          isHierarchyNode: true,
          level: level,
          hierarchyData: agentData
        };
        groups.push(agentGroup);
      }
    }
    // Process children
    if (node.children && node.children.length > 0) {
      node.children.forEach((child: any) => {
        groups.push(...buildHierarchyGroups(child, level + 1));
      });
    }
    return groups;
  };
  // Use the proper hierarchical structure
  const hierarchyGroups: AgentType[] = [];
  const topLevelAgents = hierarchy.data || hierarchy.topLevel || [];
  
  if (topLevelAgents && topLevelAgents.length > 0) {
    // Process each top-level agent (like CEO) normally
    topLevelAgents.forEach((agent: any) => {
      const agentGroup = buildAgentGroup(agent, 0);
      if (agentGroup) {
        hierarchyGroups.push(agentGroup);
      }
    });
  }
  
  // Helper function to build agent group with children
  function buildAgentGroup(agent: any, level: number): AgentType | null {
    // Check if agent matches search
    const matchesSearch = !searchQuery.value || 
      agent.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      agent.displayName?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      agent.metadata?.description?.toLowerCase().includes(searchQuery.value.toLowerCase());
    
    if (!matchesSearch && (!agent.children || agent.children.length === 0)) {
      return null; // Skip if no match and no children
    }
    
    // Get conversations for this agent
    const agentConversations = conversationsStore.conversations.filter(conv => 
      conv.agentName === agent.name && conv.agentType === agent.type
    );
    
    // Build the main agent item
    const agentItem = {
      name: agent.name,
      type: agent.type || 'specialist',
      description: agent.metadata?.description || agent.description || '',
      execution_modes: [],
      conversations: agentConversations,
      activeConversations: agentConversations.filter(c => !c.endedAt).length,
      totalConversations: agentConversations.length,
    };
    
    // Process children
    const childAgents: any[] = [];
    if (agent.children && agent.children.length > 0) {
      agent.children.forEach((child: any) => {
        const childConversations = conversationsStore.conversations.filter(conv => 
          conv.agentName === child.name && conv.agentType === child.type
        );
        
        const childMatchesSearch = !searchQuery.value || 
          child.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
          child.displayName?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
          child.metadata?.description?.toLowerCase().includes(searchQuery.value.toLowerCase());
        
        if (childMatchesSearch) {
          childAgents.push({
            name: child.name,
            type: child.type || 'specialist',
            description: child.metadata?.description || child.description || '',
            execution_modes: [],
            conversations: childConversations,
            activeConversations: childConversations.filter(c => !c.endedAt).length,
            totalConversations: childConversations.length,
          });
        }
      });
    }
    
    // Include main agent if it matches search or has matching children
    const allAgents = [];
    if (matchesSearch) {
      allAgents.push(agentItem);
    }
    allAgents.push(...childAgents);
    
    if (allAgents.length === 0) {
      return null;
    }
    
    // Determine if this is a manager (has children or name contains manager/orchestrator)
    const isManager = (agent.children && agent.children.length > 0) || 
                     agent.name.toLowerCase().includes('manager') || 
                     agent.name.toLowerCase().includes('orchestrator');
    
    return {
      type: agent.name, // Use agent name as unique identifier
      agents: allAgents,
      totalConversations: allAgents.reduce((sum, a) => sum + a.totalConversations, 0),
      isHierarchyNode: true,
      level: level,
      hierarchyData: agent,
      isManager: isManager
    };
  }
  return hierarchyGroups;
});
// Methods
const refreshData = async () => {
  try {
    // Force refresh both stores and hierarchy
    await agentsStore.fetchAvailableAgents();
    await agentsStore.fetchAgentHierarchy();
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
// Custom agent expand/collapse methods
const toggleAgent = (agent: Agent) => {
  const agentKey = `${agent.type}-${agent.name}`;
  const index = expandedAgents.value.indexOf(agentKey);
  if (index === -1) {
    // Agent not expanded, add it
    expandedAgents.value.push(agentKey);
  } else {
    // Agent is expanded, remove it
    expandedAgents.value.splice(index, 1);
  }
};
const isAgentExpanded = (agent: Agent): boolean => {
  const agentKey = `${agent.type}-${agent.name}`;
  return expandedAgents.value.includes(agentKey);
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
const createNewProject = async (agent: Agent) => {
  try {
    // Navigate to project creation page with pre-selected orchestrator
    await router.push({
      path: '/app/projects/new',
      query: {
        orchestrator: agent.name,
        orchestratorType: agent.type
      }
    });
  } catch (err) {

  }
};
// viewConversationTasks removed - clicking conversation directly loads it
const endConversation = async (conversation: Conversation) => {
  try {
    // Check if conversation has deliverables
    let hasDeliverables = false;
    try {
      const deliverables = await deliverablesService.getConversationDeliverables(conversation.id);
      hasDeliverables = deliverables.length > 0;
    } catch (error) {

      // Continue with hasDeliverables = false
    }
    // Set up modal data
    deleteModalData.value = {
      conversation,
      agentDisplayName: cleanAgentName(conversation.agentName),
      activeTasks: conversation.activeTasks,
      hasDeliverables,
    };
    // Show the modal
    showDeleteModal.value = true;
  } catch (err) {

  }
};
const cancelDelete = () => {
  showDeleteModal.value = false;
  deleteModalData.value = null;
};
const confirmDelete = async (deleteDeliverables: boolean) => {
  try {
    if (!deleteModalData.value) {

      return;
    }
    const conversation = deleteModalData.value.conversation;
    // Close modal first
    showDeleteModal.value = false;
    // Delete deliverables if requested
    if (deleteDeliverables && deleteModalData.value.hasDeliverables) {
      try {
        const deliverables = await deliverablesService.getConversationDeliverables(conversation.id);
        for (const deliverable of deliverables) {
          await deliverablesService.deleteDeliverable(deliverable.id);
        }
      } catch (error) {

        // Continue with conversation deletion even if deliverable deletion fails
      }
    }
    // Use store method - this will update the UI reactively
    await conversationsStore.deleteConversation(conversation.id);
  } catch (err) {

    // Error is already handled in the store
  } finally {
    deleteModalData.value = null;
  }
};
// handleTaskAction removed - no longer needed without modal
// Utility functions
const getConversationDisplayName = (conversation: Conversation) => {
  const date = new Date(conversation.startedAt);
  const now = new Date();
  // If it's today, show time only
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  }
  // If it's this week, show day and time
  const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff === 1) {
    return `Yesterday ${date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    })}`;
  }
  if (daysDiff < 7) {
    return `${date.toLocaleDateString([], { weekday: 'short' })} ${date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    })}`;
  }
  // For older conversations, show date and time
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};
const getConversationLabel = (agent: Agent) => {
  return agent.type === 'orchestrator' ? 'Session' : 'Conversation';
};
const getConversationPluralLabel = (agent: Agent) => {
  return agent.type === 'orchestrator' ? 'Sessions' : 'Conversations';
};
const cleanAgentName = (name: string) => {
  // Remove 'orchestrator' suffix and clean up names for better UX
  return formatAgentName(name)
    .replace(/\s*Orchestrator$/i, '')  // Remove 'Orchestrator' at the end
    .replace(/\s*Manager\s*Orchestrator$/i, ' Manager')  // Replace 'Manager Orchestrator' with just 'Manager'
    .replace(/\s*Ceo\s*Orchestrator$/i, 'CEO')  // Replace 'Ceo Orchestrator' with 'CEO'
    .trim();
};
const formatAgentTypeName = (agentType: AgentType) => {
  // For hierarchy nodes, use the cleaned agent name
  if (agentType.isHierarchyNode && agentType.agents.length > 0) {
    const agent = agentType.agents[0];
    return cleanAgentName(agent.name);
  }
  // Fallback to original type-based naming
  const type = agentType.type;
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
const getAgentTypeIcon = (agentType: AgentType | string) => {
  // If it's the new hierarchy structure, determine icon based on manager status
  if (typeof agentType === 'object' && agentType.isHierarchyNode) {
    if (agentType.isManager) {
      return folderOutline; // Manager icon
    } else {
      return personOutline; // Individual agent icon
    }
  }
  
  // Fallback to original type-based icons
  const type = typeof agentType === 'string' ? agentType : agentType.type;
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

const getAgentSubtitle = (agentType: AgentType) => {
  if (agentType.isHierarchyNode && agentType.isManager) {
    const childCount = agentType.agents.length - 1; // Subtract 1 for the manager itself
    return `${childCount} report${childCount !== 1 ? 's' : ''}`;
  }
  return `${agentType.agents.length} specialist${agentType.agents.length !== 1 ? 's' : ''}`;
};
const getAgentTypeColor = (agentType: AgentType | string) => {
  // If it's the new hierarchy structure, use manager-based colors
  if (typeof agentType === 'object' && agentType.isHierarchyNode) {
    if (agentType.isManager) {
      return 'primary'; // Manager color
    } else {
      return 'medium'; // Individual agent color
    }
  }
  
  // Fallback to original type-based colors
  const type = typeof agentType === 'string' ? agentType : agentType.type;
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
      const conversation = conversationsStore.getConversationById(event.conversationId);
      if (conversation) {
        conversationsStore.updateConversationTaskCounts(event.conversationId, {
          activeTasks: conversation.activeTasks + 1,
          taskCount: conversation.taskCount + 1,
        });
      } else {

      }
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
      } else {

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
      } else {

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
// Watch for changes to the search query prop
watch(() => props.searchQuery, (newSearchQuery) => {
  searchQuery.value = newSearchQuery || '';
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
/* Hierarchy Level Styling */
.organization-header[data-hierarchy-level="1"] {
  --padding-start: 32px;
  --background: var(--ion-color-step-50);
}
.organization-header[data-hierarchy-level="2"] {
  --padding-start: 48px;
  --background: var(--ion-color-step-75);
}
.organization-header[data-hierarchy-level="3"] {
  --padding-start: 64px;
  --background: var(--ion-color-step-100);
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
.agent-section {
  margin-bottom: 8px;
}
.agent-header-button {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  background: var(--ion-color-step-50);
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  gap: 12px;
}
.agent-header-button:hover {
  background: var(--ion-color-step-100);
}
.agent-specialist-icon {
  font-size: 1em;
  flex-shrink: 0;
}
.agent-info {
  flex: 1;
  min-width: 0;
}
.agent-name {
  font-weight: 500;
  font-size: 1em;
  margin: 0 0 2px 0;
}
.agent-subtitle {
  font-size: 0.8em;
  color: var(--ion-color-medium);
  margin: 0;
  font-style: italic;
}
.agent-badges {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
.active-badge {
  background: var(--ion-color-success);
}
.total-badge {
  background: var(--ion-color-medium);
}
.expand-icon {
  font-size: 1.2em;
  flex-shrink: 0;
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
  border-color: #1976d2;
  background: #e3f2fd;
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
/* Hierarchy Actions */
.hierarchy-actions {
  margin-top: 16px;
  padding: 0 16px 16px 16px;
}

.action-separator {
  height: 1px;
  background: var(--ion-color-step-150);
  margin-bottom: 12px;
}

.action-buttons {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.hierarchy-action-btn {
  --padding-start: 12px;
  --padding-end: 12px;
  font-size: 0.9em;
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
  /* Agent actions */
  .agent-actions {
    padding: 8px 16px;
    border-bottom: 1px solid var(--ion-color-light);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .start-conversation-btn {
    --color: var(--ion-color-primary);
    font-size: 0.9em;
    text-transform: none;
    font-weight: 500;
    justify-content: flex-start;
  }
  .create-project-btn {
    --color: var(--ion-color-secondary);
    font-size: 0.9em;
    text-transform: none;
    font-weight: 500;
    justify-content: flex-start;
  }
  .agent-tree-view.compact-mode .start-conversation-btn,
  .agent-tree-view.compact-mode .create-project-btn {
    font-size: 0.8em;
  }
/* Dark theme support */
@media (prefers-color-scheme: dark), 
html[data-theme="dark"] {
  .agent-tree-view {
    background: #1f2937;
    color: #f3f4f6;
  }
  .tree-content {
    background: #1f2937;
  }
  .agent-header {
    background: #374151;
    border-color: #4b5563;
  }
  .agent-header ion-label h3 {
    color: #f3f4f6;
  }
  .agent-header ion-label p {
    color: #9ca3af;
  }
  .conversation-item {
    background: #2d3748;
    border-color: #4a5568;
    color: #e2e8f0;
  }
  .conversation-item:hover {
    background: #4a5568;
  }
  .conversation-item.selected {
    border-color: #3b82f6;
    background: #1e40af;
    color: #dbeafe;
  }
  .conversation-meta {
    color: #a0aec0;
  }
  .conversation-item.selected .conversation-meta {
    color: #bfdbfe;
  }
  .conversation-stats {
    color: #9ca3af;
  }
  .conversation-item.selected .conversation-stats {
    color: #bfdbfe;
  }
  .compact-badge {
    background: #4a5568;
    color: #e2e8f0;
  }
  .agent-actions {
    background: #374151;
    border-color: #4b5563;
  }
  .start-conversation-btn {
    --color: #60a5fa;
  }
  .create-project-btn {
    --color: #a78bfa;
  }
}
</style>