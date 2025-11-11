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
              </div>
            </ion-item>

            <!-- Accordion content: CEO's conversations -->
            <div slot="content" class="accordion-content">
              <!-- CEO's Conversations -->
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
              </div>
            </ion-item>

            <!-- Accordion content: Manager's conversations first, then team members -->
            <div slot="content" class="accordion-content">

              <!-- Manager's Conversations (first agent in the group) -->
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
import { useConversationsStore } from '@/stores/conversationsStore';
import { useDeliverablesStore } from '@/stores/deliverablesStore';
import { deliverablesService } from '@/services/deliverablesService';
import { agentsService } from '@/services/agentsService';
import { useAuthStore } from '@/stores/authStore';
import ConversationDeleteModal from './ConversationDeleteModal.vue';

// Props
const props = defineProps<{
  compactMode?: boolean;
  searchQuery?: string;
}>();

import type { Agent, AgentConversation } from '@/types/conversation';

// Emits
const emit = defineEmits<{
  'agent-selected': [agent: Agent];
  'conversation-selected': [conversation: AgentConversation];
}>();

// Reactive state
const searchQuery = ref(props.searchQuery || '');
const expandedAccordions = ref<string[]>([]);

// Delete modal state
const showDeleteModal = ref(false);
const conversationToDelete = ref<AgentConversation | null>(null);

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
const { agentHierarchy, isLoading, error } = storeToRefs(agentsStore);
const conversationsStore = useConversationsStore();
const deliverablesStore = useDeliverablesStore();

// Convert conversations Map to array for easier filtering
const storeConversations = computed(() => Array.from(conversationsStore.conversations.values()));

// Helper functions (defined before computed properties)
const formatAgentDisplayName = (agent: Agent, removeOrchestrator = false) => {
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

const formatConversationTitle = (conversation: AgentConversation) => {
  // Just show relative time, not agent name
  return formatLastActive(conversation.lastActiveAt || conversation.createdAt);
};

const formatLastActive = (date: Date | string) => {
  const now = new Date();
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - dateObj.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins === 1) return '1 minute';
  if (diffMins < 60) return `${diffMins} minutes`;
  if (diffHours === 1) return '1 hour';
  if (diffHours < 24) return `${diffHours} hours`;
  if (diffDays === 1) return '1 day';
  if (diffDays < 7) return `${diffDays} days`;
  return dateObj.toLocaleDateString();
};

const selectConversation = (conversation: AgentConversation) => {
  emit('conversation-selected', conversation);
};

const deleteConversation = async (conversation: AgentConversation, event: Event) => {
  // Prevent the conversation selection when clicking delete
  event.stopPropagation();
  
  // Check if conversation has deliverables before showing modal
  let hasDeliverables = false;
  try {
    const deliverables = await deliverablesService.getConversationDeliverables(conversation.id);
    deliverables.forEach(d => {
      deliverablesStore.addDeliverable(d);
    });
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
  
  const groups: Agent[] = [];
  
  const processNode = (node: Agent) => {
    // Debug: Log the raw node data to see if namespace exists
    if (node.name === 'blog_post_writer') {
      console.log('🔍 [AgentTreeView.processNode] Raw node data for blog_post_writer:', {
        name: node.name,
        namespace: node.namespace,
        hasNamespace: !!node.namespace,
        fullNode: node,
        totalConversationsInStore: storeConversations.value.length,
        conversationsInStore: storeConversations.value.map(c => ({
          id: c.id,
          agentName: c.agentName,
          organizationSlug: c.organizationSlug,
          agentType: c.agentType
        }))
      });
    }
    
    // Apply search filter to the manager/orchestrator
    const matchesSearch = !searchQuery.value ||
      node.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      node.displayName?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      node.metadata?.description?.toLowerCase().includes(searchQuery.value.toLowerCase());

    // Check if any children match the search
    let hasMatchingChildren = false;
    if (node.children) {
      hasMatchingChildren = node.children.some((child: Agent) =>
        !searchQuery.value ||
        child.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        child.displayName?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        child.metadata?.description?.toLowerCase().includes(searchQuery.value.toLowerCase())
      );
    }

    // Skip if neither the node nor its children match the search
    if (!matchesSearch && !hasMatchingChildren) return;

    // Get conversations for this manager/orchestrator
    // All agents now filter by organizationSlug/namespace
    const nodeConversations = storeConversations.value.filter(conv => {
      const match = conv.agentName === node.name && conv.organizationSlug === (node.namespace || 'demo');
      if (node.name === 'blog_post_writer') {
        console.log('🔍 [AgentTreeView] Filtering conversation for blog_post_writer:', {
          convAgentName: conv.agentName,
          nodeAgentName: node.name,
          convOrgSlug: conv.organizationSlug,
          nodeNamespace: node.namespace || 'demo',
          match
        });
      }
      return match;
    });

    // Create the manager/orchestrator agent
    const mainAgent = {
      name: node.name,
      displayName: node.displayName || node.metadata?.displayName || node.name,
      type: node.type || 'orchestrator',
      description: node.metadata?.description || node.description || '',
      execution_modes: node.execution_modes || node.metadata?.execution_modes || [],
      execution_profile: node.metadata?.execution_profile,
      execution_capabilities: node.metadata?.execution_capabilities,
      namespace: node.namespace,
      conversations: nodeConversations,
      activeConversations: nodeConversations.filter(c => !c.endedAt).length,
      totalConversations: nodeConversations.length, // Will be updated after child agents are processed
    };

    // Build the agents array - manager first, then direct children only
    const agents = [mainAgent];

    // Add direct child agents (not their sub-children)
    if (node.children && node.children.length > 0) {
      node.children.forEach((child: Agent) => {
        // Check if this direct child matches the search
        const childMatchesSearch = !searchQuery.value ||
          child.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
          child.displayName?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
          child.metadata?.description?.toLowerCase().includes(searchQuery.value.toLowerCase());

        if (childMatchesSearch) {
          // All agents now filter by organizationSlug/namespace
          const childConversations = storeConversations.value.filter(conv =>
            conv.agentName === child.name && conv.organizationSlug === (child.namespace || 'demo')
          );

          // Add this child as a team member
          console.log('🔍 [AgentTreeView] Building child agent object:', {
            name: child.name,
            type: child.type,
            namespace: child.namespace,
            hasNamespace: !!child.namespace,
            metadata: child.metadata,
            execution_profile_from_metadata: child.metadata?.execution_profile,
            execution_capabilities_from_metadata: child.metadata?.execution_capabilities,
            fullChild: child
          });
          
          agents.push({
            name: child.name,
            displayName: child.displayName || child.metadata?.displayName || child.name,
            type: child.type || 'specialist',
            description: child.metadata?.description || child.description || '',
            execution_modes: child.execution_modes || child.metadata?.execution_modes || [],
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
      // Update the main agent's (orchestrator's) conversation count to include all child conversations
      if (agents.length > 1) { // Only if there are child agents
        const totalChildConversations = agents.slice(1).reduce((sum, a) => sum + a.totalConversations, 0);
        mainAgent.totalConversations = nodeConversations.length + totalChildConversations;
        mainAgent.activeConversations = nodeConversations.filter(c => !c.endedAt).length + 
          agents.slice(1).reduce((sum, a) => sum + a.activeConversations, 0);
      }

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
  const topOrchestrator = hierarchy.data.find((agent: Agent) =>
    agent.children && agent.children.length > 0
  ) || hierarchy.data[0]; // Fallback to first node if none have children

  if (topOrchestrator) {
    // For database orchestrators (with namespace), match by organizationSlug; otherwise match by agentType
    const orchestratorConversations = topOrchestrator.namespace
      ? conversationsStore.conversationsByAgent(topOrchestrator.name, topOrchestrator.namespace)
      : conversationsStore.conversationsByAgentType(topOrchestrator.type)
          .filter(conv => conv.agentName === topOrchestrator.name);

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
        execution_modes: topOrchestrator.execution_modes || topOrchestrator.metadata?.execution_modes || [],
        conversations: orchestratorConversations,
        activeConversations: orchestratorConversations.filter(c => !c.endedAt).length,
        totalConversations: orchestratorConversations.length, // Will be updated after child agents are processed
      }];

      // Add non-manager children directly to the orchestrator's agents array
      if (topOrchestrator.children) {
        topOrchestrator.children.forEach((child: Agent) => {
          if (!child.children || child.children.length === 0) {
            // This is a non-manager child - add it to the orchestrator's team
            // For database agents (with namespace), match by organizationSlug; otherwise match by agentType
            const childConversations = child.namespace
              ? conversationsStore.conversationsByAgent(child.name, child.namespace)
              : conversationsStore.conversationsByAgentType(child.type)
                  .filter(conv => conv.agentName === child.name);
            orchestratorAgents.push({
              name: child.name,
              displayName: child.displayName || child.metadata?.displayName || child.name,
              type: child.type || 'specialist',
              description: child.metadata?.description || child.description || '',
              execution_modes: child.execution_modes || child.metadata?.execution_modes || [],
              conversations: childConversations,
              activeConversations: childConversations.filter(c => !c.endedAt).length,
              totalConversations: childConversations.length,
            });
          }
        });
      }

      // Update the orchestrator's conversation count to include all child conversations
      if (orchestratorAgents.length > 1) { // Only if there are child agents
        const totalChildConversations = orchestratorAgents.slice(1).reduce((sum, a) => sum + a.totalConversations, 0);
        orchestratorAgents[0].totalConversations = orchestratorConversations.length + totalChildConversations;
        orchestratorAgents[0].activeConversations = orchestratorConversations.filter(c => !c.endedAt).length + 
          orchestratorAgents.slice(1).reduce((sum, a) => sum + a.activeConversations, 0);
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
      topOrchestrator.children.forEach((child: Agent) => {
        // Only process as separate group if it has its own children (is a manager)
        if (child.children && child.children.length > 0) {
          processNode(child);
        }
      });
    }
  }
  
  // Process any remaining root nodes that aren't the top orchestrator
  const otherRootNodes = hierarchy.data.filter((agent: Agent) =>
    topOrchestrator ? agent.name !== topOrchestrator.name : true
  );
  const specialistAgents: Agent[] = [];

  otherRootNodes.forEach((agent: Agent) => {
    // If this node has children, it's an orchestrator - process it as a manager group
    if (agent.children && agent.children.length > 0) {
      processNode(agent);
    } else {
      // This is a standalone specialist/agent
      // For database agents (with namespace), match by organizationSlug; otherwise match by agentType
      const nodeConversations = agent.namespace
        ? conversationsStore.conversationsByAgent(agent.name, agent.namespace)
        : conversationsStore.conversationsByAgentType(agent.type)
            .filter(conv => conv.agentName === agent.name);

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
          execution_modes: agent.execution_modes || agent.metadata?.execution_modes || [],
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
  
  // Debug: Log all agents and their conversations
  console.log('🔍 [AgentTreeView.hierarchyGroups] Final groups:', {
    totalGroups: groups.length,
    totalConversations: storeConversations.value.length,
    allConversations: storeConversations.value.map(c => ({
      id: c.id,
      agentName: c.agentName,
      organizationSlug: c.organizationSlug,
      agentType: c.agentType,
      hasOrgSlug: !!c.organizationSlug,
      orgSlugValue: c.organizationSlug || 'MISSING'
    })),
    groupSummary: groups.map(g => ({
      type: g.type,
      totalConversations: g.totalConversations,
      agents: g.agents.map((a: Agent) => ({
        name: a.name,
        namespace: a.namespace,
        conversationCount: a.conversations?.length || 0,
        conversations: a.conversations?.map((c: AgentConversation) => ({
          id: c.id,
          agentName: c.agentName,
          organizationSlug: c.organizationSlug
        })) || []
      }))
    }))
  });

  return groups;
});

// Removed unused computed property

// Methods
const refreshData = async () => {
  try {
    const authStore = useAuthStore();
    const namespace = authStore.currentNamespace;

    if (!namespace) {
      console.warn('No namespace available for refreshing agents');
      return;
    }

    agentsStore.setLoading(true);
    agentsStore.clearError();

    // Load agents and hierarchy from service
    const [agents, hierarchy] = await Promise.all([
      agentsService.getAvailableAgents(),
      agentsService.getAgentHierarchy(namespace).catch(() => null),
    ]);

    // Filter agents by namespace
    const filteredAgents = Array.isArray(agents)
      ? agents.filter((agent) => {
          if (!agent || typeof agent !== 'object') return false;
          if (!('namespace' in agent) || !agent.namespace) return true;
          return agent.namespace === namespace || agent.namespace === 'global';
        })
      : [];

    // Filter hierarchy by namespace
    const { filterHierarchyByNamespace } = await import('@/stores/agentsStore');
    const filteredHierarchy = hierarchy
      ? filterHierarchyByNamespace(hierarchy, namespace)
      : null;

    // Update store via mutations
    agentsStore.setAvailableAgents(filteredAgents);
    agentsStore.setAgentHierarchy(filteredHierarchy);
    agentsStore.setLastLoadedNamespace(namespace);
    agentsStore.setLoading(false);

    await conversationsStore.fetchConversations(true);
  } catch (err) {
    console.error('Failed to refresh data:', err);
    agentsStore.setError('Failed to refresh agents');
    agentsStore.setLoading(false);
  }
};

const filterAgents = () => {
  // Filtering is handled in computed property
};

const createNewConversation = async (agent: Agent) => {
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

// Wrapper methods for header buttons that also expand the accordion
const startNewConversation = async (agent: Agent, groupType: string) => {
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

.ceo-conversations {
  margin-bottom: 12px;
}

.ceo-conversation {
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
