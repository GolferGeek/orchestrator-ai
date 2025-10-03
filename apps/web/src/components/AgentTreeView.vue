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
      <ion-button fill="clear" @click="refreshData" :disabled="isLoading">
          <ion-icon :icon="icons.refreshOutline" />
        </ion-button>
      </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-container">
      <ion-spinner />
      <p>Loading agents...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-container">
      <ion-icon :icon="icons.alertCircleOutline" color="danger" />
      <p>{{ error }}</p>
      <ion-button fill="outline" @click="refreshData">Retry</ion-button>
    </div>

    <!-- Hierarchy Display -->
    <div v-else class="hierarchy-container">
      <!-- CEO as accordion (similar to managers) -->
      <div v-for="group in hierarchyGroups.filter(g => g.isCEOAgent)" :key="group.type" class="agent-group">
        <ion-accordion-group>
          <ion-accordion :value="expandedAccordions.includes('ceo') ? 'ceo' : undefined">
            <!-- CEO as accordion header with action buttons -->
            <ion-item slot="header" class="ceo-header">
              <ion-icon :icon="icons.briefcaseOutline" class="ceo-icon" slot="start" />
              <ion-label>
                <h3>{{ formatAgentDisplayName(group.agents[0], true) }}</h3>
              </ion-label>
              <ion-badge :color="group.totalConversations > 0 ? 'primary' : 'medium'" class="ceo-conversation-count">
                {{ group.totalConversations }}
              </ion-badge>
              <!-- Action buttons in header -->
              <div class="header-actions" @click.stop>
                <ion-button
                  fill="clear"
                  size="small"
                  @click="startNewConversation(group.agents[0], 'ceo')"
                  title="Start new conversation"
                  class="header-action-btn"
                >
                  <ion-icon :icon="icons.chatbubbleOutline" />
                </ion-button>
                <ion-button
                  fill="clear"
                  size="small"
                  @click="startNewProject(group.agents[0], 'ceo')"
                  title="Start new project"
                  class="header-action-btn project-btn"
                >
                  <span class="project-icon">P</span>
                </ion-button>
              </div>
            </ion-item>

            <!-- Accordion content: CEO's conversations and projects -->
            <div slot="content" class="accordion-content">
              <!-- CEO's Conversations and Projects -->
              <div v-if="group.agents[0]" class="ceo-content">
                <!-- CEO's Conversations -->
                <div v-if="group.agents[0].conversations && group.agents[0].conversations.length > 0" class="ceo-conversations">
                  <h5 class="section-title">CEO Conversations</h5>
                  <div class="conversations-list">
                    <ion-item
                      v-for="conversation in group.agents[0].conversations"
                      :key="conversation.id"
                      @click="selectConversation(conversation)"
                      button
                      class="conversation-item ceo-conversation"
                    >
                      <ion-icon :icon="icons.chatbubbleOutline" slot="start" color="primary" />
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

                <!-- CEO's Projects -->
                <div v-if="group.agents[0].projects && group.agents[0].projects.length > 0" class="ceo-projects">
                  <h5 class="section-title">CEO Projects</h5>
                  <div class="projects-list">
                    <ion-item
                      v-for="project in group.agents[0].projects"
                      :key="project.id"
                      @click="selectProject(project)"
                      button
                      class="project-item ceo-project"
                    >
                      <ion-icon :icon="icons.folderOutline" slot="start" color="secondary" />
                      <ion-label>
                        <h6>{{ project.name || 'Untitled Project' }}</h6>
                        <p>{{ project.description || 'No description' }}</p>
                      </ion-label>
                      <ion-badge :color="getProjectStatusColor(project.status)" slot="end">
                        {{ project.status }}
                      </ion-badge>
                    </ion-item>
                  </div>
                </div>
              </div>

              <!-- Team Members (for orchestrator's direct agents, not managers) -->
              <div v-if="group.agents.length > 1" class="team-members">
                <h5 class="section-title">Team Members</h5>
                <div v-for="agent in group.agents.slice(1)" :key="agent.name" class="agent-section nested-agent">
                  <!-- Agent Header -->
                  <ion-item class="nested-agent-item">
                    <ion-icon :icon="icons.personOutline" slot="start" color="medium" />
                    <ion-label>
                      <h4>{{ formatAgentDisplayName(agent, false) }}</h4>
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
                </div> <!-- End nested-agent -->
              </div> <!-- End team-members -->
            </div> <!-- End accordion-content -->
          </ion-accordion>
        </ion-accordion-group>
      </div>

      <!-- Managers as accordions -->
      <div v-for="group in hierarchyGroups.filter(g => g.isManager && !g.isCEOAgent)" :key="group.type" class="agent-group">
        <ion-accordion-group>
          <ion-accordion :value="expandedAccordions.includes(group.type) ? group.type : undefined">
            <!-- Manager as accordion header with action buttons -->
            <ion-item slot="header" class="manager-header">
              <ion-icon :icon="icons.briefcaseOutline" class="manager-icon" slot="start" />
              <ion-label>
                <h3>{{ formatAgentDisplayName(group.agents[0], true) }}</h3>
              </ion-label>
              <ion-badge :color="group.totalConversations > 0 ? 'tertiary' : 'medium'" class="manager-conversation-count">
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
            
            <!-- Accordion content: Manager's conversations/projects first, then team members -->
            <div slot="content" class="accordion-content">

              <!-- Manager's Conversations and Projects (first agent in the group) -->
              <div v-if="group.agents[0]" class="manager-content">
                <!-- Manager's Conversations -->
                <div v-if="group.agents[0].conversations && group.agents[0].conversations.length > 0" class="manager-conversations">
                  <h5 class="section-title">Manager Conversations</h5>
                  <div class="conversations-list">
                    <ion-item
                      v-for="conversation in group.agents[0].conversations"
                      :key="conversation.id"
                      @click="selectConversation(conversation)"
                      button
                      class="conversation-item manager-conversation"
                    >
                      <ion-icon :icon="icons.chatbubbleOutline" slot="start" color="primary" />
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

                <!-- Manager's Projects -->
                <div v-if="group.agents[0].projects && group.agents[0].projects.length > 0" class="manager-projects">
                  <h5 class="section-title">Manager Projects</h5>
                  <div class="projects-list">
                    <ion-item
                      v-for="project in group.agents[0].projects"
                      :key="project.id"
                      @click="selectProject(project)"
                      button
                      class="project-item manager-project"
                    >
                      <ion-icon :icon="icons.folderOutline" slot="start" color="secondary" />
                      <ion-label>
                        <h6>{{ project.name || 'Untitled Project' }}</h6>
                        <p>{{ project.description || 'No description' }}</p>
                      </ion-label>
                      <ion-badge :color="getProjectStatusColor(project.status)" slot="end">
                        {{ project.status }}
                      </ion-badge>
                    </ion-item>
                  </div>
                </div>
              </div>

              <!-- Team Members -->
              <div v-if="group.agents.length > 1" class="team-members">
                <h5 class="section-title">Team Members</h5>
                <div v-for="agent in group.agents.slice(1)" :key="agent.name" class="agent-section nested-agent">
                <!-- Agent Header -->
                <ion-item class="nested-agent-item">
                  <ion-icon :icon="icons.personOutline" slot="start" color="medium" />
                  <ion-label>
                    <h4>{{ formatAgentDisplayName(agent, false) }}</h4>
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

              </div> <!-- End nested-agent -->
              </div> <!-- End team-members -->

            </div> <!-- End accordion-content -->
        </ion-accordion>
      </ion-accordion-group>
    </div>

      <!-- Specialists as individual agents (no grouping) -->
      <div v-for="group in hierarchyGroups.filter(g => g.isSpecialists)" :key="group.type">
        <div v-for="agent in group.agents" :key="agent.name" class="agent-section">
          <!-- Agent Header -->
          <ion-item class="specialist-item">
            <ion-icon :icon="icons.personOutline" color="medium" slot="start" />
            <ion-label>
              <h3>{{ formatAgentDisplayName(agent, true) }}</h3>
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
import { storeToRefs } from 'pinia';
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
  'project-selected': [project: any];
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
const { availableAgents, agentHierarchy, isLoading, error, hasAgents } = storeToRefs(agentsStore);
const conversationsStore = useAgentConversationsStore();
const deliverablesStore = useDeliverablesStore();

// Helper functions (defined before computed properties)
const formatAgentDisplayName = (agent: any, removeOrchestrator = false) => {
  // If displayName exists and is different from name, use it as-is
  if (agent.displayName && agent.displayName !== agent.name) {
    return agent.displayName;
  }
  // Otherwise format the name
  let formatted = formatAgentName(agent.name);
  // Remove "Orchestrator" suffix for managers if requested
  if (removeOrchestrator) {
    formatted = formatted.replace(' Manager Orchestrator', ' Manager').replace(' Orchestrator', '');
  }
  return formatted;
};

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

const formatDate = (date: string | Date) => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString();
};

const selectConversation = (conversation: any) => {
  emit('conversation-selected', conversation);
};

const selectProject = (project: any) => {
  emit('project-selected', project);
};

const getProjectStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'active':
    case 'in progress':
      return 'primary';
    case 'completed':
    case 'done':
      return 'success';
    case 'paused':
    case 'on hold':
      return 'warning';
    case 'cancelled':
    case 'failed':
      return 'danger';
    default:
      return 'medium';
  }
};

const getConversationStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'active':
    case 'ongoing':
      return 'primary';
    case 'completed':
    case 'done':
      return 'success';
    case 'paused':
    case 'on hold':
      return 'warning';
    case 'archived':
    case 'closed':
      return 'medium';
    case 'error':
    case 'failed':
      return 'danger';
    default:
      return 'tertiary';
  }
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
  const hierarchy = agentHierarchy.value;
  if (!hierarchy?.data) return [];
  
  const groups: any[] = [];
  
  const processNode = (node: any) => {
    // Apply search filter to the manager/orchestrator
    const matchesSearch = !searchQuery.value ||
      node.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      node.displayName?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      node.metadata?.description?.toLowerCase().includes(searchQuery.value.toLowerCase());

    // Check if any children match the search
    let hasMatchingChildren = false;
    if (node.children) {
      hasMatchingChildren = node.children.some((child: any) =>
        !searchQuery.value ||
        child.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        child.displayName?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        child.metadata?.description?.toLowerCase().includes(searchQuery.value.toLowerCase())
      );
    }

    // Skip if neither the node nor its children match the search
    if (!matchesSearch && !hasMatchingChildren) return;

    // Get conversations for this manager/orchestrator
    const nodeConversations = conversationsStore.conversations.filter(conv =>
      conv.agentName === node.name && conv.agentType === node.type
    );

    // Create the manager/orchestrator agent
    const mainAgent = {
      name: node.name,
      displayName: node.displayName || node.metadata?.displayName || node.name,
      type: node.type || 'orchestrator',
      description: node.metadata?.description || node.description || '',
      execution_modes: [],
      execution_profile: node.metadata?.execution_profile,
      execution_capabilities: node.metadata?.execution_capabilities,
      namespace: node.namespace,
      conversations: nodeConversations,
      activeConversations: nodeConversations.filter(c => !c.endedAt).length,
      totalConversations: nodeConversations.length,
    };

    // Build the agents array - manager first, then direct children only
    const agents = [mainAgent];

    // Add direct child agents (not their sub-children)
    if (node.children && node.children.length > 0) {
      node.children.forEach((child: any) => {
        // Check if this direct child matches the search
        const childMatchesSearch = !searchQuery.value ||
          child.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
          child.displayName?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
          child.metadata?.description?.toLowerCase().includes(searchQuery.value.toLowerCase());

        if (childMatchesSearch) {
          const childConversations = conversationsStore.conversations.filter(conv =>
            conv.agentName === child.name && conv.agentType === child.type
          );

          // Add this child as a team member
          agents.push({
            name: child.name,
            displayName: child.displayName || child.metadata?.displayName || child.name,
            type: child.type || 'specialist',
            description: child.metadata?.description || child.description || '',
            execution_modes: [],
            execution_profile: child.metadata?.execution_profile,
            execution_capabilities: child.metadata?.execution_capabilities,
            namespace: child.namespace,
            conversations: childConversations,
            activeConversations: childConversations.filter(c => !c.endedAt).length,
            totalConversations: childConversations.length,
          });
        }

        // If this child has its own children (is a sub-manager), process it separately
        if (child.children && child.children.length > 0) {
          processNode(child);
        }
      });
    }

    // Only create a group if we have agents to show
    if (agents.length > 0) {
      // Determine if this is a manager (has children or name indicates it)
      const isManager = (node.children && node.children.length > 0) ||
                       node.name.toLowerCase().includes('manager') ||
                       node.name.toLowerCase().includes('orchestrator');

      groups.push({
        type: node.name,
        agents: agents,
        totalConversations: agents.reduce((sum, a) => sum + a.totalConversations, 0),
        isManager: isManager,
        isCEO: false // Set in the top orchestrator logic instead
      });
    }
  };
  
  // First, find the top-level orchestrator (could be CEO, Hiverarchy, etc.)
  // Take the first root node that has children as the main orchestrator
  const topOrchestrator = hierarchy.data.find((agent: any) =>
    agent.children && agent.children.length > 0
  ) || hierarchy.data[0]; // Fallback to first node if none have children

  if (topOrchestrator) {
    const orchestratorConversations = conversationsStore.conversations.filter(conv =>
      conv.agentName === topOrchestrator.name && conv.agentType === topOrchestrator.type
    );

    const orchestratorMatchesSearch = !searchQuery.value ||
      topOrchestrator.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      topOrchestrator.displayName?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      topOrchestrator.metadata?.description?.toLowerCase().includes(searchQuery.value.toLowerCase());
    
    if (orchestratorMatchesSearch) {
      // Build the agents array starting with the orchestrator
      const orchestratorAgents = [{
        name: topOrchestrator.name,
        displayName: topOrchestrator.displayName || topOrchestrator.metadata?.displayName || topOrchestrator.name,
        type: topOrchestrator.type || 'orchestrator',
        description: topOrchestrator.metadata?.description || topOrchestrator.description || '',
        execution_modes: [],
        conversations: orchestratorConversations,
        projects: topOrchestrator.projects || [],
        activeConversations: orchestratorConversations.filter(c => !c.endedAt).length,
        totalConversations: orchestratorConversations.length,
      }];

      // Add non-manager children directly to the orchestrator's agents array
      if (topOrchestrator.children) {
        topOrchestrator.children.forEach((child: any) => {
          if (!child.children || child.children.length === 0) {
            // This is a non-manager child - add it to the orchestrator's team
            const childConversations = conversationsStore.conversations.filter(conv =>
              conv.agentName === child.name && conv.agentType === child.type
            );
            orchestratorAgents.push({
              name: child.name,
              displayName: child.displayName || child.metadata?.displayName || child.name,
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

      groups.push({
        type: 'top_orchestrator',
        agents: orchestratorAgents,
        totalConversations: orchestratorAgents.reduce((sum, a) => sum + a.totalConversations, 0),
        isManager: false,
        isCEO: true, // Keep this for backward compatibility with template
        isCEOAgent: true // Keep this for backward compatibility with template
      });
    }

    // Process manager children as separate accordions
    if (topOrchestrator.children) {
      topOrchestrator.children.forEach((child: any) => {
        // Only process as separate group if it has its own children (is a manager)
        if (child.children && child.children.length > 0) {
          processNode(child);
        }
      });
    }
  }
  
  // Process any remaining root nodes that aren't the top orchestrator
  const otherRootNodes = hierarchy.data.filter((agent: any) =>
    topOrchestrator ? agent.name !== topOrchestrator.name : true
  );
  const specialistAgents: any[] = [];

  otherRootNodes.forEach((agent: any) => {
    // If this node has children, it's an orchestrator - process it as a manager group
    if (agent.children && agent.children.length > 0) {
      processNode(agent);
    } else {
      // This is a standalone specialist/agent
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
          displayName: agent.displayName || agent.metadata?.displayName || agent.name,
          type: agent.type || 'specialist',
          description: agent.metadata?.description || agent.description || '',
          execution_modes: [],
          conversations: nodeConversations,
          activeConversations: nodeConversations.filter(c => !c.endedAt).length,
          totalConversations: nodeConversations.length,
        });
      }
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
    console.log('🔍 [AgentTreeView] Creating conversation with agent:', {
      name: agent.name,
      type: agent.type,
      namespace: agent.namespace,
      execution_profile: agent.execution_profile,
      execution_capabilities: agent.execution_capabilities,
      fullAgent: agent
    });
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
  if (!agentHierarchy.value) {
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
  --padding-start: 12px;
}

.nested-agent-item ion-icon {
  margin-right: 8px;
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
  background: var(--ion-color-step-50, #f7f7f7);
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
  --background: rgba(var(--ion-color-tertiary-rgb), 0.08);
  --background-hover: rgba(var(--ion-color-tertiary-rgb), 0.12);
  --color: var(--ion-text-color);
  --padding-start: 12px;
}

.manager-icon {
  color: var(--ion-color-tertiary);
  font-size: 20px;
  margin-right: 8px;
}

.manager-header ion-label {
  flex: 1;
}

.manager-header ion-label h3 {
  color: var(--ion-color-tertiary-shade);
  font-weight: 500;
}

.conversation-count {
  margin-right: 4px;
}

.manager-conversation-count {
  margin-right: 4px;
  background: var(--ion-color-tertiary);
  color: var(--ion-color-tertiary-contrast, #fff);
}

.manager-conversation-count[color="medium"] {
  background: var(--ion-color-medium);
}

.header-actions {
  display: flex;
  gap: 2px;
  align-items: center;
  margin-left: auto;
  padding-right: 4px;
}

.header-action-btn {
  --padding-start: 4px;
  --padding-end: 4px;
  --padding-top: 4px;
  --padding-bottom: 4px;
  min-width: 28px;
  height: 28px;
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

/* CEO header and item styling */
.ceo-header {
  position: relative;
  --background: rgba(var(--ion-color-primary-rgb), 0.08);
  --background-hover: rgba(var(--ion-color-primary-rgb), 0.12);
  --color: var(--ion-text-color);
  --padding-start: 12px;
}

.ceo-icon {
  color: var(--ion-color-primary);
  font-size: 20px;
  margin-right: 8px;
}

.ceo-header ion-label {
  flex: 1;
}

.ceo-header ion-label h3 {
  color: var(--ion-color-primary-shade);
  font-weight: 500;
}

.ceo-conversation-count {
  margin-right: 4px;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast, #fff);
}

.ceo-conversation-count[color="medium"] {
  background: var(--ion-color-medium);
}

/* CEO content sections */
.ceo-content {
  padding: 0;
}

.ceo-conversations,
.ceo-projects {
  margin-bottom: 12px;
}

.ceo-conversation,
.ceo-project {
  --background: var(--ion-color-step-50);
}

.ceo-item {
  --padding-start: 12px;
  --background: var(--ion-item-background, var(--ion-background-color));
}

.ceo-item ion-icon {
  margin-right: 8px;
}

/* Specialist item styling */
.specialist-item {
  --padding-start: 12px;
  --background: var(--ion-color-step-100, #e7e7e7);
}

.specialist-item ion-icon {
  margin-right: 8px;
}

/* Nested agent item styling */
.nested-agent-item {
  --background: var(--ion-color-step-100, #e7e7e7);
}

/* Section titles for manager content and team members */
.section-title {
  text-align: center;
  color: var(--ion-color-primary);
  font-size: 14px;
  font-weight: 600;
  margin: 12px 16px 8px 16px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>
