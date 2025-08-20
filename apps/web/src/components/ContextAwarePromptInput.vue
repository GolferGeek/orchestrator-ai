<template>
  <div class="context-aware-prompt-input" :class="contextClass">
    <!-- Context Indicator -->
    <div v-if="showContextIndicator" class="context-indicator">
      <ion-chip :color="contextColor" outline>
        <ion-icon :icon="contextIcon" />
        <ion-label>{{ contextIndicatorText }}</ion-label>
      </ion-chip>
    </div>

    <!-- Input Form -->
    <form @submit.prevent="submitPrompt" class="prompt-form">
      <ion-item>
        <ion-textarea
          v-model="promptText"
          :placeholder="placeholderText"
          :rows="2"
          :disabled="!canSubmit"
          @keydown.enter.prevent="handleEnterKey"
          class="context-textarea"
        />
        <ion-button
          slot="end"
          type="submit"
          :disabled="!canSubmit || !promptText.trim()"
          fill="clear"
          :color="contextColor"
        >
          <ion-icon :icon="sendOutline" />
        </ion-button>
      </ion-item>
    </form>

    <!-- Context Actions (for deliverable/project contexts) -->
    <div v-if="showContextActions" class="context-actions">
      <ion-button
        v-if="contextStore.isDeliverableContext"
        size="small"
        fill="outline"
        @click="switchToConversation"
      >
        <ion-icon :icon="chatboxOutline" slot="start" />
        Switch to Conversation
      </ion-button>
      
      <ion-button
        v-if="contextStore.isProjectContext"
        size="small"
        fill="outline"
        @click="switchToConversation"
      >
        <ion-icon :icon="chatboxOutline" slot="start" />
        Switch to Conversation
      </ion-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  IonTextarea,
  IonButton,
  IonIcon,
  IonItem,
  IonChip,
  IonLabel,
} from '@ionic/vue';
import {
  sendOutline,
  chatboxOutline,
  documentTextOutline,
  folderOutline,
} from 'ionicons/icons';
import { useContextStore } from '@/stores/contextStore';
import { useAgentChatStore } from '@/stores/agentChatStore';

// Props
interface Props {
  disabled?: boolean;
  showContextActions?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  showContextActions: true,
});

// Stores
const contextStore = useContextStore();
const agentChatStore = useAgentChatStore();

// Reactive state
const promptText = ref('');

// Computed properties
const contextClass = computed(() => `context-${contextStore.activeContext}`);

const showContextIndicator = computed(() => 
  contextStore.activeContext !== 'conversation'
);

const contextColor = computed(() => {
  switch (contextStore.activeContext) {
    case 'deliverable':
      return 'primary';
    case 'project':
      return 'secondary';
    default:
      return 'medium';
  }
});

const contextIcon = computed(() => {
  switch (contextStore.activeContext) {
    case 'deliverable':
      return documentTextOutline;
    case 'project':
      return folderOutline;
    default:
      return chatboxOutline;
  }
});

const contextIndicatorText = computed(() => {
  switch (contextStore.activeContext) {
    case 'deliverable':
      return `Deliverable ${contextStore.activeDeliverableId?.slice(0, 8)}...`;
    case 'project':
      return `Project ${contextStore.activeProjectId?.slice(0, 8)}...`;
    default:
      return 'Conversation';
  }
});

const placeholderText = computed(() => {
  switch (contextStore.activeContext) {
    case 'deliverable':
      return 'Enter instructions for this deliverable (e.g., "make the intro shorter", "fix the conclusion")...';
    case 'project':
      return 'Enter project instructions (e.g., "add testing phase", "update timeline")...';
    default:
      return 'Ask me anything...';
  }
});

const canSubmit = computed(() => 
  !props.disabled && agentChatStore.getActiveConversation()?.agent
);

const showContextActions = computed(() => 
  props.showContextActions && contextStore.activeContext !== 'conversation'
);

// Methods
const handleEnterKey = (event: KeyboardEvent) => {
  if (event.ctrlKey || event.metaKey) {
    submitPrompt();
  }
};

const submitPrompt = async () => {
  if (!promptText.value.trim() || !canSubmit.value) return;

  const content = promptText.value.trim();
  promptText.value = '';

  try {
    // Use context-aware message sending
    await agentChatStore.sendContextAwareMessage(content);
  } catch (error) {
    console.error('Failed to send context-aware message:', error);
    // Restore the input text on error
    promptText.value = content;
  }
};

const switchToConversation = () => {
  contextStore.setConversationContext();
};
</script>

<style scoped>
.context-aware-prompt-input {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--ion-color-light);
  border-radius: 8px;
}

.context-indicator {
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.prompt-form {
  width: 100%;
}

.context-textarea {
  font-size: 14px;
}

.context-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  align-items: center;
}

/* Context-specific styling */
.context-conversation {
  border-left: 3px solid var(--ion-color-medium);
}

.context-deliverable {
  border-left: 3px solid var(--ion-color-primary);
}

.context-project {
  border-left: 3px solid var(--ion-color-secondary);
}

/* Responsive design */
@media (max-width: 768px) {
  .context-actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
