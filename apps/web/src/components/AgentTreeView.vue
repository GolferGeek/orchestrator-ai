<!-- This is a clean rewrite of the hierarchy processing -->
<template>
  <div class="agent-tree-container">
    <!-- Search -->
    <div class="search-container">
        <ion-searchbar
          v-model="searchQuery"
          placeholder="Search agents..."
        show-clear-button="focus"
        @ionInput="filterAgents"
      />
      <ion-button fill="clear" @click="refreshData" :disabled="agentsStore.isLoadingAgents">
          <ion-icon :icon="icons.refreshOutline" />
        </ion-button>
      </div>

    <!-- Loading State -->
    <div v-if="agentsStore.isLoadingAgents" class="loading-container">
      <ion-spinner />
      <p>Loading agents...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="agentsStore.getAgentError" class="error-container">
      <ion-icon :icon="icons.alertCircleOutline" color="danger" />
      <p>{{ agentsStore.getAgentError }}</p>
      <ion-button fill="outline" @click="refreshData">Retry</ion-button>
    </div>

    <!-- Hierarchy Display -->
    <div v-else class="hierarchy-container">
      <!-- CEO as standalone agent (not accordion) -->
      <div v-for="group in hierarchyGroups.filter(g => g.isCEOAgent)" :key="group.type" class="agent-item">
        <ion-item class="ceo-item">
          <ion-icon :icon="icons.briefcaseOutline" color="primary" slot="start" />
          <ion-label>
            <h3>{{ formatAgentName(group.agents[0].name).replace(' Orchestrator', '') }}</h3>
          </ion-label>
          <ion-badge :color="group.totalConversations > 0 ? 'primary' : 'medium'" class="conversation-count">
            {{ group.totalConversations }}
          </ion-badge>
          <div class="header-actions" @click.stop>
            <ion-button
              fill="clear"
              size="small"
              @click="createNewConversation(group.agents[0])"
              title="Start new conversation"
              class="header-action-btn"
            >
              <ion-icon :icon="icons.chatbubbleOutline" />
            </ion-button>
            <ion-button
              fill="clear"
              size="small"
              @click="createNewProject(group.agents[0])"
              title="Start new project"
              class="header-action-btn project-btn"
            >
              <span class="project-icon">P</span>
            </ion-button>
          </div>
        </ion-item>
      </div>

      <!-- Managers as accordions -->
      <div v-for="group in hierarchyGroups.filter(g => g.isManager && !g.isCEOAgent)" :key="group.type" class="agent-group">
        <ion-accordion-group>
          <ion-accordion :value="expandedAccordions.includes(group.type) ? group.type : undefined">
            <!-- Manager as accordion header with action buttons -->
            <ion-item slot="header" color="light" class="manager-header">
              <ion-icon :icon="icons.briefcaseOutline" color="primary" slot="start" />
              <ion-label>
                <h3>{{ formatAgentName(group.agents[0].name).replace(' Orchestrator', '') }}</h3>
              </ion-label>
              <ion-badge :color="group.totalConversations > 0 ? 'primary' : 'medium'" class="conversation-count">
                {{ group.totalConversations }}
              </ion-badge>
              <!-- Action buttons in header -->
              <div class="header-actions" @click.stop>
                <ion-button
                  fill="clear"
                  size="small"
                  @click="startNewConversation(group.agents[0], group.type)"
                  title="Start new conversation"
                  class="header-action-btn"
                >
                  <ion-icon :icon="icons.chatbubbleOutline" />
                </ion-button>
                <ion-button
                  fill="clear"
                  size="small"
                  @click="startNewProject(group.agents[0], group.type)"
                  title="Start new project"
                  class="header-action-btn project-btn"
                >
                  <span class="project-icon">P</span>
                </ion-button>
              </div>
            </ion-item>
            
            <!-- Team members in accordion content -->
            <div slot="content" class="accordion-content">
              <!-- Skip the first agent (manager) and show the rest (team members) -->
              <div v-for="agent in group.agents.slice(1)" :key="agent.name" class="agent-section nested-agent">
                <!-- Agent Header -->
                <ion-item color="light" class="nested-agent-item">
                  <ion-icon :icon="icons.personOutline" slot="start" color="medium" />
                  <ion-label>
                    <h4>{{ formatAgentName(agent.name).replace(' Orchestrator', '') }}</h4>
                  </ion-label>
                  <ion-badge :color="agent.totalConversations > 0 ? 'secondary' : 'light'" class="conversation-count">
                    {{ agent.totalConversations }}
                  </ion-badge>
                  <div class="header-actions" @click.stop>
                    <ion-button
                      fill="clear"
                      size="small"
                      @click="createNewConversation(agent)"
                      title="Start new conversation"
                      class="header-action-btn"
                    >
                      <ion-icon :icon="icons.chatbubbleOutline" />
                    </ion-button>
                  </div>
                </ion-item>
                
                <!-- Agent's Conversations -->
                <div v-if="agent.conversations && agent.conversations.length > 0" class="conversations-list">
                  <ion-item 
                    v-for="conversation in agent.conversations" 
                    :key="conversation.id"
                    button 
                    @click="selectConversation(conversation)"
                    class="conversation-item"
                  >
                    <ion-icon :icon="icons.chatbubbleOutline" slot="start" color="tertiary" />
                    <ion-label>
                      <p>{{ formatConversationTitle(conversation) }}</p>
                    </ion-label>
                    <ion-badge 
                      v-if="conversation.activeTasks > 0" 
                      slot="end" 
                      color="warning"
                    >
                      {{ conversation.activeTasks }}
                    </ion-badge>
                    <ion-button 
                      fill="clear" 
                      size="small" 
                      color="danger"
                      slot="end"
                      @click="deleteConversation(conversation, $event)"
                    >
                      <ion-icon :icon="icons.trashOutline" />
                    </ion-button>
                  </ion-item>
                </div>
                
              </div>
              
          </div>
        </ion-accordion>
      </ion-accordion-group>
    </div>

      <!-- Specialists as individual agents (no grouping) -->
      <div v-for="group in hierarchyGroups.filter(g => g.isSpecialists)" :key="group.type">
        <div v-for="agent in group.agents" :key="agent.name" class="agent-section">
          <!-- Agent Header -->
          <ion-item color="light" class="specialist-item">
            <ion-icon :icon="icons.personOutline" color="medium" slot="start" />
            <ion-label>
              <h3>{{ formatAgentName(agent.name).replace(' Orchestrator', '') }}</h3>
            </ion-label>
            <ion-badge :color="agent.totalConversations > 0 ? 'primary' : 'medium'" class="conversation-count">
              {{ agent.totalConversations }}
            </ion-badge>
            <div class="header-actions" @click.stop>
              <ion-button
                fill="clear"
                size="small"
                @click="createNewConversation(agent)"
                title="Start new conversation"
                class="header-action-btn"
              >
                <ion-icon :icon="icons.chatbubbleOutline" />
              </ion-button>
            </div>
          </ion-item>
          
          <!-- Agent's Conversations -->
          <div v-if="agent.conversations && agent.conversations.length > 0" class="conversations-list">
            <ion-item 
                  v-for="conversation in agent.conversations"
                  :key="conversation.id"
              button 
              @click="selectConversation(conversation)"
                  class="conversation-item"
            >
              <ion-icon :icon="icons.chatbubbleOutline" slot="start" color="tertiary" />
              <ion-label>
                <p>{{ formatConversationTitle(conversation) }}</p>
              </ion-label>
                        <ion-badge
                          v-if="conversation.activeTasks > 0"
                slot="end" 
                color="warning"
                        >
                {{ conversation.activeTasks }}
                        </ion-badge>
              <ion-button 
                fill="clear" 
                size="small" 
                color="danger"
                slot="end"
                @click="deleteConversation(conversation, $event)"
              >
                <ion-icon :icon="icons.trashOutline" />
              </ion-button>
            </ion-item>
                      </div>
          
                  </div>
                  </div>
                </div>
  </div>

  <!-- Conversation Delete Modal -->
  <ConversationDeleteModal
    :is-open="showDeleteModal"
    :agent-display-name="conversationToDelete?.agentName || 'Unknown Agent'"
    :active-tasks="conversationToDelete?.activeTasks || 0"
    :has-deliverables="conversationToDelete?.hasDeliverables || false"
    @cancel="handleDeleteCancel"
    @confirm="handleDeleteConfirm"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  IonSearchbar,
  IonButton,
  IonIcon,
  IonSpinner,
  IonAccordionGroup,
  IonAccordion,
  IonItem,
  IonLabel,
  IonBadge,
} from '@ionic/vue';
import {
  personOutline,
  refreshOutline,
  alertCircleOutline,
  addOutline,
  folderOutline,
  briefcaseOutline,
  chatbubbleOutline,
  trashOutline,
} from 'ionicons/icons';
import { formatAgentName } from '@/utils/caseConverter';
import { useAgentsStore } from '@/stores/agentsStore';
import { useAgentConversationsStore } from '@/stores/agentConversationsStore';
import { useDeliverablesStore } from '@/stores/deliverablesStore';
import ConversationDeleteModal from './ConversationDeleteModal.vue';

// Props
const props = defineProps<{
  compactMode?: boolean;
  searchQuery?: string;
}>();

// Emits
const emit = defineEmits<{
  'agent-selected': [agent: any];
  'conversation-selected': [conversation: any];
}>();

// Reactive state
const searchQuery = ref(props.searchQuery || '');
const expandedAccordions = ref<string[]>([]);

// Delete modal state
const showDeleteModal = ref(false);
const conversationToDelete = ref<any>(null);

// Icons (make them reactive for template access)
const icons = {
  personOutline,
  refreshOutline,
  alertCircleOutline,
  addOutline,
  folderOutline,
  briefcaseOutline,
  chatbubbleOutline,
  trashOutline,
};

// Stores
const agentsStore = useAgentsStore();
const conversationsStore = useAgentConversationsStore();
const deliverablesStore = useDeliverablesStore();

// Helper functions (defined before computed properties)
const formatConversationTitle = (conversation: any) => {
  // Use metadata title if available, otherwise just show the relative time
  if (conversation.metadata?.title) {
    return conversation.metadata.title;
  }
  
  // Just use the same relative time format as the meta line
  return formatLastActive(conversation.lastActiveAt || conversation.createdAt);
};

const formatLastActive = (date: Date) => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const selectConversation = (conversation: any) => {
  emit('conversation-selected', conversation);
};

const deleteConversation = async (conversation: any, event: Event) => {
  // Prevent the conversation selection when clicking delete
  event.stopPropagation();
  
  // Check if conversation has deliverables before showing modal
  let hasDeliverables = false;
  try {
    const deliverables = await deliverablesStore.loadDeliverablesByConversation(conversation.id);
    hasDeliverables = deliverables && deliverables.length > 0;
  } catch (error) {
    console.warn('Failed to check deliverables for conversation:', error);
    // Default to false if we can't check
    hasDeliverables = false;
  }
  
  // Show the delete modal with deliverable information
  conversationToDelete.value = {
    ...conversation,
    hasDeliverables
  };
  showDeleteModal.value = true;
};

const handleDeleteCancel = () => {
  showDeleteModal.value = false;
  conversationToDelete.value = null;
};

const handleDeleteConfirm = async (deleteDeliverables: boolean) => {
  try {
    if (!conversationToDelete.value) {
      console.warn('No conversation to delete');
      return;
    }
    
    const conversation = conversationToDelete.value;
    
    // Close modal first
    showDeleteModal.value = false;
    
    // Delete deliverables if requested
    if (deleteDeliverables && conversationToDelete.value.hasDeliverables) {
      try {
        const { deliverablesService } = await import('@/services/deliverablesService');
        const deliverables = await deliverablesService.getConversationDeliverables(conversation.id);
        for (const deliverable of deliverables) {
          await deliverablesService.deleteDeliverable(deliverable.id);
        }
      } catch (error) {
        console.warn('Failed to delete deliverables:', error);
        // Continue with conversation deletion even if deliverable deletion fails
      }
    }
    
    // Use store method - this will update the UI reactively and handle tab closure
    await conversationsStore.deleteConversation(conversation.id);
    
  } catch (err) {
    console.error('Failed to delete conversation:', err);
    // Error is already handled in the store
  } finally {
    conversationToDelete.value = null;
  }
};

// Simple hierarchy processing - just build the tree as it comes from the backend
const hierarchyGroups = computed(() => {
  const hierarchy = agentsStore.getAgentHierarchy;
  if (!hierarchy?.data) return [];
  
  const groups: any[] = [];
  
  const processNode = (node: any) => {
        // Apply search filter
        const matchesSearch = !searchQuery.value || 
      node.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      node.displayName?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      node.metadata?.description?.toLowerCase().includes(searchQuery.value.toLowerCase());
    
    if (!matchesSearch && (!node.children || node.children.length === 0)) return;
    
    // Get conversations for this node
    const nodeConversations = conversationsStore.conversations.filter(conv => 
      conv.agentName === node.name && conv.agentType === node.type
    );
    
    // Create main agent
    const mainAgent = {
      name: node.name,
      type: node.type || 'specialist',
      description: node.metadata?.description || node.description || '',
      execution_modes: [],
      conversations: nodeConversations,
      activeConversations: nodeConversations.filter(c => !c.endedAt).length,
      totalConversations: nodeConversations.length,
    };
    
    // Add child agents if they exist
    const agents = [mainAgent];
    if (node.children) {
      node.children.forEach((child: any) => {
        const childConversations = conversationsStore.conversations.filter(conv => 
          conv.agentName === child.name && conv.agentType === child.type
        );
        
        const childMatchesSearch = !searchQuery.value || 
          child.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
          child.displayName?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
          child.metadata?.description?.toLowerCase().includes(searchQuery.value.toLowerCase());
        
        if (childMatchesSearch) {
          agents.push({
            name: child.name,
            type: child.type || 'specialist',
            description: child.metadata?.description || child.description || '',
            execution_modes: [],
            conversations: childConversations,
            activeConversations: childConversations.filter(c => !c.endedAt).length,
            totalConversations: childConversations.length,
          });
        }
        
        // Recursively process child nodes that have their own children
        if (child.children && child.children.length > 0) {
          processNode(child);
        }
      });
    }
    
    // Determine if this is a manager
    const isManager = (node.children && node.children.length > 0) || 
                     node.name.toLowerCase().includes('manager') || 
                     node.name.toLowerCase().includes('orchestrator');
    
    // Create the group
    groups.push({
      type: node.name,
      agents: agents,
      totalConversations: agents.reduce((sum, a) => sum + a.totalConversations, 0),
      isManager: isManager,
      isCEO: node.name === 'ceo_orchestrator'
    });
  };
  
  // First, add CEO as a standalone agent (not as a group with children)
  const ceoNode = hierarchy.data.find((agent: any) => agent.name === 'ceo_orchestrator');
  
  if (ceoNode) {
    const ceoConversations = conversationsStore.conversations.filter(conv => 
      conv.agentName === ceoNode.name && conv.agentType === ceoNode.type
    );
    
    const ceoMatchesSearch = !searchQuery.value || 
      ceoNode.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      ceoNode.displayName?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      ceoNode.metadata?.description?.toLowerCase().includes(searchQuery.value.toLowerCase());
    
    if (ceoMatchesSearch) {
      groups.push({
        type: 'ceo_agent',
          agents: [{
          name: ceoNode.name,
          type: ceoNode.type || 'orchestrator',
          description: ceoNode.metadata?.description || ceoNode.description || '',
          execution_modes: [],
          conversations: ceoConversations,
          activeConversations: ceoConversations.filter(c => !c.endedAt).length,
          totalConversations: ceoConversations.length,
        }],
        totalConversations: ceoConversations.length,
        isManager: false,
        isCEO: true,
        isCEOAgent: true
      });
    }
    
    // Then process CEO's children (managers) as separate groups
    if (ceoNode.children) {
      ceoNode.children.forEach((child: any) => {
        processNode(child);
      });
    }
  }
  
  // Process any remaining root nodes that aren't under CEO (shouldn't be many if hierarchy is correct)
  const otherRootNodes = hierarchy.data.filter((agent: any) => agent.name !== 'ceo_orchestrator');
  const specialistAgents: any[] = [];
  
  otherRootNodes.forEach((agent: any) => {
    const nodeConversations = conversationsStore.conversations.filter(conv => 
      conv.agentName === agent.name && conv.agentType === agent.type
    );
    
        const matchesSearch = !searchQuery.value || 
          agent.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      agent.displayName?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
          agent.metadata?.description?.toLowerCase().includes(searchQuery.value.toLowerCase());
    
    if (matchesSearch) {
      specialistAgents.push({
              name: agent.name,
              type: agent.type || 'specialist',
              description: agent.metadata?.description || agent.description || '',
              execution_modes: [],
        conversations: nodeConversations,
        activeConversations: nodeConversations.filter(c => !c.endedAt).length,
        totalConversations: nodeConversations.length,
      });
    }
  });
  
  // Add "Specialists" group only if there are agents not properly under CEO
  if (specialistAgents.length > 0) {
    groups.push({
      type: 'specialists',
      agents: specialistAgents,
      totalConversations: specialistAgents.reduce((sum, a) => sum + a.totalConversations, 0),
      isManager: false,
      isSpecialists: true
    });
  }
  
  return groups;
});

// Flat list of all agents for display
const flatAgentList = computed(() => {
  const allAgents: any[] = [];
  
  hierarchyGroups.value.forEach(group => {
    group.agents.forEach((agent: any) => {
      allAgents.push({
        ...agent,
        isManager: group.isManager || group.isCEOAgent,
        isCEO: group.isCEOAgent
      });
    });
  });
  
  return allAgents;
});

// Methods
const refreshData = async () => {
  try {
    await agentsStore.fetchAvailableAgents();
    await agentsStore.fetchAgentHierarchy();
    await conversationsStore.fetchConversations(true);
  } catch (err) {
    console.error('Failed to refresh data:', err);
  }
};

const filterAgents = () => {
  // Filtering is handled in computed property
};

const createNewConversation = async (agent: any) => {
  try {
    emit('agent-selected', agent);
  } catch (err) {
    console.error('Failed to create conversation:', err);
  }
};

const createNewProject = async (agent: any) => {
  try {
    // Emit event for parent to handle project creation
    emit('agent-selected', { ...agent, createProject: true });
  } catch (err) {
    console.error('Failed to create project:', err);
  }
};

// Wrapper methods for header buttons that also expand the accordion
const startNewConversation = async (agent: any, groupType: string) => {
  try {
    // Expand the accordion if not already expanded
    if (!expandedAccordions.value.includes(groupType)) {
      expandedAccordions.value.push(groupType);
    }
    // Create the conversation
    await createNewConversation(agent);
  } catch (err) {
    console.error('Failed to start conversation:', err);
  }
};

const startNewProject = async (agent: any, groupType: string) => {
  try {
    // Expand the accordion if not already expanded
    if (!expandedAccordions.value.includes(groupType)) {
      expandedAccordions.value.push(groupType);
    }
    // Create the project
    await createNewProject(agent);
  } catch (err) {
    console.error('Failed to start project:', err);
  }
};

// Lifecycle
onMounted(async () => {
  // Fetch data if not already loaded
  if (!agentsStore.getAgentHierarchy) {
    await refreshData();
  }
});
</script>

<style scoped>
.agent-tree-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.search-container {
  display: flex;
  align-items: center;
  padding: 8px;
  border-bottom: 1px solid var(--ion-color-step-150);
}

.search-container ion-searchbar {
  flex: 1;
}

.loading-container,
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  text-align: center;
}

.hierarchy-container {
  flex: 1;
  overflow-y: auto;
}

.agent-group {
  margin-bottom: 8px;
}

.accordion-content {
  padding: 0;
}

.agent-item {
  border-bottom: 1px solid var(--ion-color-step-100);
}

.agent-item:last-of-type {
  border-bottom: none;
}

.nested-agent ion-item {
  --padding-start: 8px; /* Reduce indentation by half */
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

/* Agent section styling */
.agent-section {
  margin-bottom: 8px;
}

/* Conversations list styling */
.conversations-list {
  background: var(--ion-color-light-tint);
  border-radius: 8px;
  margin: 4px 8px;
}

.conversation-item {
  --padding-start: 24px;
  --min-height: 40px;
}

.conversation-item ion-label p {
  margin: 2px 0;
  font-size: 0.9em;
}

.conversation-meta {
  color: var(--ion-color-medium);
  font-size: 0.8em !important;
}

/* Agent actions styling */
  .agent-actions {
  padding: 4px 16px 8px 16px;
}

.agent-action-btn {
    --color: var(--ion-color-primary);
    font-size: 0.9em;
}

/* Header buttons styling */
.manager-header {
  position: relative;
}

.manager-header ion-label {
  flex: 1;
}

.conversation-count {
  margin-right: 8px;
}

.header-actions {
  display: flex;
  gap: 4px;
  align-items: center;
  margin-left: auto;
  padding-right: 8px;
}

.header-action-btn {
  --padding-start: 6px;
  --padding-end: 6px;
  --padding-top: 4px;
  --padding-bottom: 4px;
  min-width: 32px;
  height: 32px;
}

.header-action-btn ion-icon {
  font-size: 18px;
}

.project-btn .project-icon {
  font-weight: bold;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: 2px solid currentColor;
  border-radius: 50%;
  line-height: 1;
}

/* Prevent accordion toggle when clicking buttons */
.header-actions {
  z-index: 10;
}
</style>
