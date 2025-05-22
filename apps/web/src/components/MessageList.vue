<template>
  <div class="message-list-container">
    <div v-if="!messages || messages.length === 0" class="empty-chat-placeholder">
      <p>No messages yet. Send a message to start the conversation!</p>
    </div>
    <transition-group name="message-fade" tag="div" v-else>
      <MessageItem
        v-for="message in messages"
        :key="message.id"
        :message="message"
        @returnToOrchestrator="handleReturnToOrchestratorPassthrough"
      />
    </transition-group>
    <div ref="scrollTarget"></div> <!-- Element to scroll to -->
  </div>
</template>

<script setup lang="ts">
import { watch, nextTick, ref, defineProps, PropType } from 'vue';
import MessageItem from './MessageItem.vue';
import type { Message } from '@/services/sessionService';
import { onMounted } from 'vue';

// Define props
const props = defineProps({
  messages: {
    type: Array as PropType<Message[]>,
    required: true,
    default: () => []
  }
});

const emit = defineEmits(['messages-rendered', 'returnToOrchestrator']); // Define emit

const scrollTarget = ref<HTMLElement | null>(null);

const handleReturnToOrchestratorPassthrough = () => {
  console.log('[MessageList.vue] handleReturnToOrchestratorPassthrough method called');
  emit('returnToOrchestrator');
};

// Watch for new messages from the prop and scroll to the bottom
watch(() => props.messages.length, async (newLength, oldLength) => {
  console.log("[MessageList] Watcher for props.messages.LENGTH triggered.");
  console.log("[MessageList] newLength:", newLength, "oldLength:", oldLength);

  // We are primarily interested when new messages are added, causing length to increase.
  // Also handles the initial case where oldLength might be undefined.
  if (typeof oldLength === 'undefined' || newLength > oldLength) { 
    console.log("[MessageList] props.messages.length has changed (or initial run with messages). newLength:", newLength);
    await nextTick(); 
    console.log("[MessageList] DOM updated after props.messages.length change. Emitting messages-rendered.");
    emit('messages-rendered');
  } else {
    console.log("[MessageList] props.messages.length watcher triggered, but length did not increase meaningfully.");
  }
}/*, No deep: true needed for .length */);

// Emit on mount if messages are already present
onMounted(async () => {
  if (props.messages && props.messages.length > 0) {
    console.log("[MessageList] onMounted: Messages present. Waiting for nextTick and emitting messages-rendered.");
    await nextTick();
    emit('messages-rendered');
  }
});

</script>

<style scoped>
.message-list-container {
  display: flex;
  flex-direction: column;
  height: 100%; /* Ensure it tries to fill parent (ion-content) */
  overflow-y: auto; /* Should be handled by ion-content, but good as a fallback */
}

.empty-chat-placeholder {
  flex-grow: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ion-color-medium-shade);
  text-align: center;
  padding: 20px;
}

/* Basic fade transition for new messages */
.message-fade-enter-active {
  transition: opacity 0.5s ease;
}
.message-fade-enter-from {
  opacity: 0;
}

</style> 