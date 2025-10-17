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
        <ion-icon :icon="refreshOutline" />
      </ion-button>
    </div>

    <!-- Loading State -->
    <div v-if="agentsStore.isLoadingAgents" class="loading-container">
      <ion-spinner />
      <p>Loading agents...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="agentsStore.getAgentError" class="error-container">
      <ion-icon :icon="alertCircleOutline" color="danger" />
      <p>{{ agentsStore.getAgentError }}</p>
      <ion-button fill="outline" @click="refreshData">Retry</ion-button>
    </div>

    <!-- Hierarchy Display -->
    <div v-else class="hierarchy-container">
      <div v-for="group in hierarchyGroups" :key="group.type" class="agent-group">
        <ion-accordion-group>
          <ion-accordion>
            <ion-item slot="header" color="light">
              <ion-icon 
                :icon="group.isManager ? folderOutline : personOutline" 
                :color="group.isManager ? 'primary' : 'medium'"
                slot="start" 
              />
              <ion-label>
                <h3>{{ formatAgentName(group.type) }}</h3>
                <p>{{ group.agents.length }} {{ group.agents.length === 1 ? 'agent' : 'agents' }}</p>
              </ion-label>
              <ion-badge slot="end" :color="group.totalConversations > 0 ? 'primary' : 'medium'">
                {{ group.totalConversations }}
              </ion-badge>
            </ion-item>
            
            <div slot="content" class="accordion-content">
              <!-- Individual Agents -->
              <div v-for="agent in group.agents" :key="agent.name" class="agent-item">
                <ion-item button @click="createNewConversation(agent)">
                  <ion-icon :icon="personOutline" slot="start" color="medium" />
                  <ion-label>
                    <h4>{{ formatAgentName(agent.name) }}</h4>
                    <p v-if="agent.description">{{ agent.description }}</p>
                  </ion-label>
                  <ion-badge slot="end" :color="agent.totalConversations > 0 ? 'secondary' : 'light'">
                    {{ agent.totalConversations }}
                  </ion-badge>
                </ion-item>
              </div>
              
              <!-- Action Buttons -->
              <div class="hierarchy-actions">
                <div class="action-separator"></div>
                <div class="action-buttons">
                  <ion-button 
                    fill="clear" 
                    size="small"
                    @click.stop="createNewConversation(group.agents[0])"
                    class="hierarchy-action-btn"
                  >
                    <ion-icon :icon="addOutline" slot="start" />
                    💬 Create a conversation
                  </ion-button>
                  <ion-button 
                    fill="clear" 
                    size="small"
                    color="secondary"
                    @click.stop="createNewProject(group.agents[0])"
                    class="hierarchy-action-btn"
                  >
                    <ion-icon :icon="addOutline" slot="start" />
                    📋 Create a project
                  </ion-button>
                </div>
              </div>
            </div>
          </ion-accordion>
        </ion-accordion-group>
      </div>
    </div>
  </div>
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
} from 'ionicons/icons';
import { formatAgentName } from '@/utils/caseConverter';
import { useAgentsStore } from '@/stores/agentsStore';
import { useConversationsStore } from '@/stores/conversationsStore';

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

// Stores
const agentsStore = useAgentsStore();
const conversationsStore = useConversationsStore();

// Simple hierarchy processing - just build the tree as it comes from the backend
const hierarchyGroups = computed(() => {
  const hierarchy = agentsStore.getAgentHierarchy;
  if (!hierarchy?.data) return [];
  
  const groups: any[] = [];
  
  const processNode = (node: any) => {
    // Skip CEO node itself, process its children as top-level groups
    if (node.name === 'ceo_orchestrator' && node.children) {
      node.children.forEach((child: any) => {
        processNode(child);
      });
      return;
    }
    
    // Apply search filter
    const matchesSearch = !searchQuery.value || 
      node.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      node.displayName?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      node.metadata?.description?.toLowerCase().includes(searchQuery.value.toLowerCase());
    
    if (!matchesSearch) return;
    
    // Get conversations for this node and its children
    const getAllConversations = (n: any): any[] => {
      const nodeConversations = conversationsStore.conversations.filter(conv => 
        conv.agentName === n.name && conv.agentType === n.type
      );
      
      let childConversations: any[] = [];
      if (n.children) {
        n.children.forEach((child: any) => {
          childConversations.push(...getAllConversations(child));
        });
      }
      
      return [...nodeConversations, ...childConversations];
    };
    
    const allConversations = getAllConversations(node);
    
    // Create agents array (main agent + children)
    const agents = [];
    
    // Add main agent
    const mainAgentConversations = conversationsStore.conversations.filter(conv => 
      conv.agentName === node.name && conv.agentType === node.type
    );
    
    agents.push({
      name: node.name,
      type: node.type || 'specialist',
      description: node.metadata?.description || node.description || '',
      execution_modes: [],
      conversations: mainAgentConversations,
      activeConversations: mainAgentConversations.filter(c => !c.endedAt).length,
      totalConversations: mainAgentConversations.length,
    });
    
    // Add child agents
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
      totalConversations: allConversations.length,
      isManager: isManager
    });
  };
  
  // Process the hierarchy
  hierarchy.data.forEach((agent: any) => {
    processNode(agent);
  });
  
  return groups;
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
</style>
